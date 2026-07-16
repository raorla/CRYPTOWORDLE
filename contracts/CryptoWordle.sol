// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    Nox,
    ebool,
    euint256,
    externalEuint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/// @title CryptoWordle — a provably-fair, un-leakable Wordle on iExec Nox.
///
/// @notice The secret 5-letter word lives as five encrypted `euint256` handles
/// (one letter each, encoded 0–25). While a round is Open the ONLY principal
/// with access to those handles is this contract (`Nox.allowThis`) — no wallet,
/// no server, no player can decrypt them. Letter-color hints are computed ON
/// CIPHERTEXT inside the Nox TEE; only the per-letter colors (0 = absent,
/// 1 = present, 2 = correct) and the win flag are ever made publicly
/// decryptable. The word itself is revealed only after the round is Solved or
/// Expired, so anyone can verify post-hoc that every hint was honest.
///
/// @dev Nox is TEE-based confidential compute: every `Nox.*` operation emits
/// an on-chain event that an off-chain runner executes on plaintext inside an
/// Intel TDX enclave, producing a NEW handle. Results (and therefore
/// decryptions) materialize asynchronously, a few seconds after the tx.
/// Winning is settled trustlessly: the KMS decryption proof for the win
/// handle is verified ON-CHAIN via `Nox.publicDecrypt` (the same pattern as
/// ConfidentialToken.finalizeUnwrap), so anyone can crank `claim` — the pot
/// always pays the player who made the winning guess.
contract CryptoWordle is ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    uint256 public constant WORD_LENGTH = 5;
    uint256 public constant ALPHABET_SIZE = 26;
    /// @notice Max guesses a single player may submit per round (classic Wordle board).
    uint256 public constant MAX_GUESSES_PER_PLAYER = 6;
    /// @notice Grace period after the deadline during which `revealExpired` is
    /// still blocked, so a buzzer-beater winning guess (whose KMS decryption
    /// takes a few seconds to materialize) cannot be robbed of its claim.
    uint256 public constant CLAIM_GRACE_PERIOD = 15 minutes;
    /// @dev Color encoding of a fully-green row: 5 letters × 2 = 10. The
    /// maximum a non-winning row can reach is 4×2 + 1×1 = 9, so
    /// `sum(colors) == 10 ⇔ win`.
    uint256 private constant WIN_COLOR_SUM = 10;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        Open,
        Solved,
        Expired
    }

    struct Guessed_ {
        /// @notice Player who submitted this guess (receives the pot if it wins).
        address player;
        /// @notice Submission time.
        uint64 timestamp;
        /// @notice The guessed letters (0–25). Guesses are public by design —
        /// the player typed them in public calldata; only the SECRET is sealed.
        uint8[5] letters;
        /// @notice Publicly-decryptable euint256 handles: 0 gray / 1 yellow / 2 green.
        bytes32[5] colorHandles;
        /// @notice Publicly-decryptable ebool handle: true iff all 5 are green.
        bytes32 winHandle;
    }

    struct Round {
        /// @dev Encrypted secret letters. ACL: `allowThis` ONLY while Open.
        euint256[5] secret;
        address creator;
        uint96 pot;
        uint64 deadline;
        Status status;
        address winner;
        uint32 guessCount;
        /// @notice Post-round only: publicly-decryptable handles of the secret
        /// letters (fresh handles migrated via `add(secret, 0)`), zero while Open.
        bytes32[5] revealedLetterHandles;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 public roundCount;
    mapping(uint256 roundId => Round) private _rounds;
    mapping(uint256 roundId => Guessed_[]) private _guesses;
    mapping(uint256 roundId => mapping(address player => uint256)) public guessCountOf;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice A new round opened: the word is sealed in the TEE, the pot is live.
    event RoundCreated(
        uint256 indexed roundId,
        address indexed creator,
        uint256 pot,
        uint64 deadline
    );

    /// @notice A guess was evaluated on ciphertext. Only handles are emitted —
    /// decrypt them via the KMS (`publicDecrypt`) to see the colors.
    event Guessed(
        uint256 indexed roundId,
        address indexed player,
        uint256 guessIndex,
        bytes32[5] colorHandles,
        bytes32 winHandle
    );

    /// @notice The winning guess was proven on-chain and the pot paid out.
    event RoundSolved(
        uint256 indexed roundId,
        address indexed winner,
        uint256 guessIndex,
        uint256 pot
    );

    /// @notice The round expired with no winner; the pot returned to the creator.
    event RoundExpired(uint256 indexed roundId);

    /// @notice The secret letters are now publicly decryptable — anyone can
    /// verify the answer matched every hint that was handed out.
    event SecretRevealed(uint256 indexed roundId, bytes32[5] letterHandles);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error RoundDoesNotExist(uint256 roundId);
    error RoundNotOpen(uint256 roundId);
    error RoundStillOpen(uint256 roundId);
    error RoundNotExpired(uint256 roundId);
    error DeadlinePassed(uint256 roundId);
    error EmptyPot();
    error InvalidDuration(uint64 durationSeconds);
    error LetterOutOfRange(uint8 letter);
    error GuessLimitReached(address player);
    error GuessDoesNotExist(uint256 roundId, uint256 guessIndex);
    error NotAWinningGuess(uint256 roundId, uint256 guessIndex);
    error PotTransferFailed(address to);

    // ---------------------------------------------------------------------
    // Round creation
    // ---------------------------------------------------------------------

    /// @notice Opens a new round with an encrypted secret word and an ETH pot.
    ///
    /// @dev The five letters MUST be encrypted client-side with
    /// `handleClient.encryptInput(letter, "uint256", <this contract>)` by the
    /// caller — `Nox.fromExternal` binds each proof to both `msg.sender` and
    /// this contract, so nobody can replay someone else's ciphertext. The
    /// caller is the only party that ever saw the plaintext; the honest
    /// round-generator discards it immediately after encryption.
    ///
    /// ACL: each letter gets `Nox.allowThis` ONLY. No viewer, no admin, no
    /// public decryption — that is the un-leakability guarantee.
    ///
    /// @param letterHandles The five encrypted letters (each 0–25), in order.
    /// @param proofs The five input proofs returned by `encryptInput`.
    /// @param durationSeconds Round lifetime; deadline = now + duration.
    /// @return roundId The id of the newly created round.
    function createRound(
        externalEuint256[5] calldata letterHandles,
        bytes[5] calldata proofs,
        uint64 durationSeconds
    ) external payable returns (uint256 roundId) {
        require(msg.value > 0, EmptyPot());
        require(
            durationSeconds >= 10 minutes && durationSeconds <= 30 days,
            InvalidDuration(durationSeconds)
        );

        roundId = roundCount++;
        Round storage r = _rounds[roundId];
        r.creator = msg.sender;
        r.pot = uint96(msg.value);
        r.deadline = uint64(block.timestamp) + durationSeconds;
        r.status = Status.Open;

        for (uint256 i = 0; i < WORD_LENGTH; ++i) {
            euint256 letter = Nox.fromExternal(letterHandles[i], proofs[i]);
            // The contract is the ONLY principal ever granted access while
            // the round is live. Nothing else. Ever.
            Nox.allowThis(letter);
            r.secret[i] = letter;
        }

        emit RoundCreated(roundId, msg.sender, msg.value, r.deadline);
    }

    // ---------------------------------------------------------------------
    // Guessing
    // ---------------------------------------------------------------------

    /// @notice Submits a public 5-letter guess and computes the color hints on
    /// ciphertext inside the TEE. Colors: 0 = gray (absent), 1 = yellow
    /// (present elsewhere), 2 = green (exact match). The per-letter colors and
    /// the all-green win flag are made publicly decryptable; the secret is not.
    ///
    /// @dev Nox has no encrypted OR, so "present anywhere" is a counting
    /// argument: cnt_i = Σ_j (guess_i == secret_j ? 1 : 0), present ⇔ cnt > 0.
    /// Win detection folds into the color sum: a row sums to 10 iff all five
    /// are green (max non-win sum is 9), saving ~10 TEE ops per guess.
    /// NOTE: like the counting version of Wordle logic, duplicate guess
    /// letters each show yellow if the letter appears anywhere — a documented
    /// simplification that keeps the op count (and gas) bounded.
    ///
    /// Encrypted comparisons never revert on a "wrong" guess — wrongness only
    /// exists as ciphertext until the KMS decrypts the colors. Drive UIs from
    /// the decrypted values, never from tx success.
    ///
    /// @param roundId The round to guess in.
    /// @param letters The guessed letters, each 0–25 (a–z).
    /// @return guessIndex Index of this guess within the round.
    function guess(
        uint256 roundId,
        uint8[5] calldata letters
    ) external returns (uint256 guessIndex) {
        Round storage r = _roundCheckedForGuess(roundId);

        uint256 already = guessCountOf[roundId][msg.sender];
        require(already < MAX_GUESSES_PER_PLAYER, GuessLimitReached(msg.sender));
        guessCountOf[roundId][msg.sender] = already + 1;

        for (uint256 i = 0; i < WORD_LENGTH; ++i) {
            require(letters[i] < ALPHABET_SIZE, LetterOutOfRange(letters[i]));
        }

        // Plaintext-wrapped constants, reused across all 5 letters.
        euint256 zero = Nox.toEuint256(0);
        euint256 one = Nox.toEuint256(1);
        euint256 two = Nox.toEuint256(2);

        bytes32[5] memory colorHandles;
        euint256 colorSum = zero;

        for (uint256 i = 0; i < WORD_LENGTH; ++i) {
            // Guess letters are public, so wrapping them on-chain is fine.
            euint256 g = Nox.toEuint256(letters[i]);

            // One encrypted comparison of guess letter i against every secret
            // position: match[i][i] is the green check, the row feeds the
            // presence count.
            ebool isGreen;
            euint256 cnt = zero;
            for (uint256 j = 0; j < WORD_LENGTH; ++j) {
                ebool m = Nox.eq(g, r.secret[j]);
                if (j == i) isGreen = m;
                cnt = Nox.add(cnt, Nox.select(m, one, zero));
            }
            ebool present = Nox.gt(cnt, zero);

            euint256 color = Nox.select(isGreen, two, Nox.select(present, one, zero));
            // Result handles are brand new — re-grant, then open them to the
            // world. Revealing the COLOR is the entire game; revealing the
            // word would end it.
            Nox.allowThis(color);
            Nox.allowPublicDecryption(color);

            colorHandles[i] = euint256.unwrap(color);
            colorSum = Nox.add(colorSum, color);
        }

        ebool win = Nox.eq(colorSum, Nox.toEuint256(WIN_COLOR_SUM));
        Nox.allowThis(win);
        Nox.allowPublicDecryption(win);

        guessIndex = _guesses[roundId].length;
        _guesses[roundId].push(
            Guessed_({
                player: msg.sender,
                timestamp: uint64(block.timestamp),
                letters: letters,
                colorHandles: colorHandles,
                winHandle: ebool.unwrap(win)
            })
        );
        r.guessCount += 1;

        emit Guessed(roundId, msg.sender, guessIndex, colorHandles, ebool.unwrap(win));
    }

    // ---------------------------------------------------------------------
    // Claiming — trustless, proof-verified on-chain
    // ---------------------------------------------------------------------

    /// @notice Settles a winning guess. ANYONE may call this (it's a crank):
    /// the KMS decryption proof for the guess's win handle is verified
    /// on-chain by `Nox.publicDecrypt`, and the pot always pays the player who
    /// made the guess — the caller cannot redirect it.
    ///
    /// @dev Mirrors ConfidentialToken.finalizeUnwrap: fetch
    /// `handleClient.publicDecrypt(winHandle)` off-chain and pass its
    /// `decryptionProof` here. Reverts InvalidProof on forged proofs and
    /// NotAWinningGuess when the (genuine) decrypted value is false.
    /// Re-play safe: the status flip to Solved is the one-shot latch.
    ///
    /// @param roundId The round being claimed.
    /// @param guessIndex The index of the winning guess in that round.
    /// @param winDecryptionProof KMS proof for that guess's win handle.
    function claim(
        uint256 roundId,
        uint256 guessIndex,
        bytes calldata winDecryptionProof
    ) external nonReentrant {
        Round storage r = _existingRound(roundId);
        require(r.status == Status.Open, RoundNotOpen(roundId));
        require(
            guessIndex < _guesses[roundId].length,
            GuessDoesNotExist(roundId, guessIndex)
        );

        Guessed_ storage g = _guesses[roundId][guessIndex];
        bool won = Nox.publicDecrypt(ebool.wrap(g.winHandle), winDecryptionProof);
        require(won, NotAWinningGuess(roundId, guessIndex));

        // Effects before interaction; the Solved latch is the replay guard.
        r.status = Status.Solved;
        r.winner = g.player;
        uint256 pot = r.pot;
        r.pot = 0;

        _revealSecret(roundId, r);

        emit RoundSolved(roundId, g.player, guessIndex, pot);

        (bool ok, ) = g.player.call{value: pot}("");
        require(ok, PotTransferFailed(g.player));
    }

    // ---------------------------------------------------------------------
    // Expiry
    // ---------------------------------------------------------------------

    /// @notice After the deadline (plus a claim grace period) with no winner,
    /// anyone can expire the round: the secret is revealed for verifiability
    /// and the pot returns to the round creator.
    function revealExpired(uint256 roundId) external nonReentrant {
        Round storage r = _existingRound(roundId);
        require(r.status == Status.Open, RoundNotOpen(roundId));
        require(
            block.timestamp > uint256(r.deadline) + CLAIM_GRACE_PERIOD,
            RoundNotExpired(roundId)
        );

        r.status = Status.Expired;
        uint256 pot = r.pot;
        r.pot = 0;

        _revealSecret(roundId, r);

        emit RoundExpired(roundId);

        (bool ok, ) = r.creator.call{value: pot}("");
        require(ok, PotTransferFailed(r.creator));
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Round metadata (everything public about a round).
    function getRound(
        uint256 roundId
    )
        external
        view
        returns (
            address creator,
            uint256 pot,
            uint64 deadline,
            Status status,
            address winner,
            uint32 guessCount,
            bytes32[5] memory revealedLetterHandles
        )
    {
        Round storage r = _existingRound(roundId);
        return (
            r.creator,
            r.pot,
            r.deadline,
            r.status,
            r.winner,
            r.guessCount,
            r.revealedLetterHandles
        );
    }

    /// @notice A single guess with its color/win handles.
    function getGuess(
        uint256 roundId,
        uint256 guessIndex
    ) external view returns (Guessed_ memory) {
        _existingRound(roundId);
        require(
            guessIndex < _guesses[roundId].length,
            GuessDoesNotExist(roundId, guessIndex)
        );
        return _guesses[roundId][guessIndex];
    }

    /// @notice All guesses of a round (colors are handles; decrypt via KMS).
    function getGuesses(uint256 roundId) external view returns (Guessed_[] memory) {
        _existingRound(roundId);
        return _guesses[roundId];
    }

    /// @notice The raw secret-letter handles. Handles are opaque 32-byte
    /// pointers — exposing them leaks nothing and lets anyone audit their ACL
    /// on the NoxCompute contract (they must NEVER be publicly decryptable or
    /// viewer-granted while the round is Open).
    function getSecretHandles(
        uint256 roundId
    ) external view returns (bytes32[5] memory handles) {
        Round storage r = _existingRound(roundId);
        for (uint256 i = 0; i < WORD_LENGTH; ++i) {
            handles[i] = euint256.unwrap(r.secret[i]);
        }
    }

    /// @notice Id of the most recently created round (reverts if none exist).
    function latestRoundId() external view returns (uint256) {
        require(roundCount > 0, RoundDoesNotExist(0));
        return roundCount - 1;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Post-round transparency: migrate each secret letter to a FRESH
    /// handle via `add(letter, 0)` and make that public. Two reasons for the
    /// migration instead of opening the original handles: (1) public
    /// decryption is only permitted on computed handles (raw external inputs
    /// may be refused), and (2) the original input handles keep their
    /// contract-only ACL — tidy hygiene.
    function _revealSecret(uint256 roundId, Round storage r) private {
        euint256 zero = Nox.toEuint256(0);
        bytes32[5] memory letterHandles;
        for (uint256 i = 0; i < WORD_LENGTH; ++i) {
            euint256 revealed = Nox.add(r.secret[i], zero);
            Nox.allowThis(revealed);
            Nox.allowPublicDecryption(revealed);
            letterHandles[i] = euint256.unwrap(revealed);
        }
        r.revealedLetterHandles = letterHandles;
        emit SecretRevealed(roundId, letterHandles);
    }

    function _existingRound(uint256 roundId) private view returns (Round storage r) {
        require(roundId < roundCount, RoundDoesNotExist(roundId));
        r = _rounds[roundId];
    }

    function _roundCheckedForGuess(uint256 roundId) private view returns (Round storage r) {
        r = _existingRound(roundId);
        require(r.status == Status.Open, RoundNotOpen(roundId));
        require(block.timestamp <= r.deadline, DeadlinePassed(roundId));
    }
}
