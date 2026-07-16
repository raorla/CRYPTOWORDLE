// CryptoWordle ABI — extracted from the compiled artifact so the frontend
// and any fresh clone build without running hardhat compile first.
// Regenerate after contract changes: npm run export-abi

export const CRYPTOWORDLE_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "DeadlinePassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyPot",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      }
    ],
    "name": "GuessDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "GuessLimitReached",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "durationSeconds",
        "type": "uint64"
      }
    ],
    "name": "InvalidDuration",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "letter",
        "type": "uint8"
      }
    ],
    "name": "LetterOutOfRange",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "MalformedDecryptedData",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      }
    ],
    "name": "NotAWinningGuess",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "PotTransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundNotExpired",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundNotOpen",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundStillOpen",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32[5]",
        "name": "colorHandles",
        "type": "bytes32[5]"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "winHandle",
        "type": "bytes32"
      }
    ],
    "name": "Guessed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pot",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "deadline",
        "type": "uint64"
      }
    ],
    "name": "RoundCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundExpired",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pot",
        "type": "uint256"
      }
    ],
    "name": "RoundSolved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32[5]",
        "name": "letterHandles",
        "type": "bytes32[5]"
      }
    ],
    "name": "SecretRevealed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ALPHABET_SIZE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CLAIM_GRACE_PERIOD",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_GUESSES_PER_PLAYER",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "WORD_LENGTH",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "winDecryptionProof",
        "type": "bytes"
      }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint256[5]",
        "name": "letterHandles",
        "type": "bytes32[5]"
      },
      {
        "internalType": "bytes[5]",
        "name": "proofs",
        "type": "bytes[5]"
      },
      {
        "internalType": "uint64",
        "name": "durationSeconds",
        "type": "uint64"
      }
    ],
    "name": "createRound",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      }
    ],
    "name": "getGuess",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "player",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint8[5]",
            "name": "letters",
            "type": "uint8[5]"
          },
          {
            "internalType": "bytes32[5]",
            "name": "colorHandles",
            "type": "bytes32[5]"
          },
          {
            "internalType": "bytes32",
            "name": "winHandle",
            "type": "bytes32"
          }
        ],
        "internalType": "struct CryptoWordle.Guessed_",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "getGuesses",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "player",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint8[5]",
            "name": "letters",
            "type": "uint8[5]"
          },
          {
            "internalType": "bytes32[5]",
            "name": "colorHandles",
            "type": "bytes32[5]"
          },
          {
            "internalType": "bytes32",
            "name": "winHandle",
            "type": "bytes32"
          }
        ],
        "internalType": "struct CryptoWordle.Guessed_[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "getRound",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "pot",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "deadline",
        "type": "uint64"
      },
      {
        "internalType": "enum CryptoWordle.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "guessCount",
        "type": "uint32"
      },
      {
        "internalType": "bytes32[5]",
        "name": "revealedLetterHandles",
        "type": "bytes32[5]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "getSecretHandles",
    "outputs": [
      {
        "internalType": "bytes32[5]",
        "name": "handles",
        "type": "bytes32[5]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint8[5]",
        "name": "letters",
        "type": "uint8[5]"
      }
    ],
    "name": "guess",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "guessIndex",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "guessCountOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "latestRoundId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "revealExpired",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "roundCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
