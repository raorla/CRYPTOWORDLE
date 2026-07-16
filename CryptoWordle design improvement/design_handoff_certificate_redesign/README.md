# Handoff: CryptoWordle — "Treasury Certificate" Redesign

> **Prompt for Claude Code** — paste this to start:
> *"Implement the redesign described in `design_handoff_certificate_redesign/README.md` in the CryptoWordle frontend (`frontend/`). It replaces the current dark-violet arcade theme with the 'Treasury Certificate' visual direction. Keep ALL game logic, chain code, state management and accessibility behavior intact — this is a presentation-layer redesign only. Match the reference screenshots pixel-perfectly."*

## Overview
CryptoWordle is an on-chain Wordle (Vite + TypeScript + viem, no framework) where the secret word is encrypted in a TEE (iExec Nox) and the winner takes an ETH pot. This redesign replaces the current "confidential arcade" look (dark navy + electric violet, rounded tiles) with a **"Treasury certificate / security printing"** direction: engraved banknote aesthetic — ivory paper, deep green ink, gold metal accents, guilloché rings, stamped tiles, certificate-style modals. The confidentiality story (sealed word, provable fairness) is told through the visual language of certificates, seals and banknotes.

## About the Design Files
The files in this bundle are **design references created in HTML** (`*.dc.html` — open them directly in a browser; `support.js` must sit next to them). They are prototypes showing intended look and behavior, **not production code to copy directly**. The task is to **recreate this design inside the existing frontend** (`frontend/index.html`, `frontend/src/style.css`, `frontend/src/ui/*.ts`) using its established patterns: CSS custom properties + classes, idempotent DOM rendering in `render.ts`, string-template modals in `modals.ts`.

- `CryptoWordle Redesign.dc.html` — **the target design** (all states: playing / won / revealed, light + dark, 3 modals).
- `CryptoWordle Current.dc.html` — faithful recreation of the current UI, for before/after reference only.
- `screenshots/` — reference captures (NN-*.png = new design; 08/09-OLD-* = current design for comparison).

## Fidelity
**High-fidelity.** Colors, typography, spacing, borders and copy are final. Recreate pixel-perfectly.

## Design Tokens
Implement as CSS custom properties on `:root` (light = default) and `[data-theme="dark"]`, replacing the existing token set in `src/style.css`. **Note the theme polarity flips: light "specimen paper" becomes the default; dark "midnight ledger" is the alternate.** (Current app defaults to dark — keep `theme.ts` logic, just swap which value is default.)

### Light — "Specimen paper" (default)
| Token | Value | Use |
|---|---|---|
| `--paper` | `#f1ecdd` | page background |
| `--paper-2` | `#f6f2e6` | key background |
| `--panel` | `#f6f2e6` | panels, board plate |
| `--ink` | `#1d3229` | primary text |
| `--muted` | `#67746a` | secondary text |
| `--line` | `#cfc5a8` | hairline rules/borders |
| `--line-strong` | `#a89a76` | strong rules, key borders |
| `--tile-line` | `#bdb193` | empty tile border |
| `--metal` | `#b8912f` | gold accent (buttons, seal ring) |
| `--metal-deep` | `#8a6d1f` | gold text/borders |
| `--metal-soft` | `rgba(184,145,47,0.16)` | gold tint fills |
| `--ok` | `#1e6b47` | correct / green stamp |
| `--warm` | `#a5761d` | present / ochre stamp |
| `--dim` | `#a09a86` | absent / faded stamp |
| `--stamp-text` | `#f5f0de` | letter color on stamped tiles/keys |
| `--danger` | `#9c3b32` | errors/toasts |

### Dark — "Midnight ledger"
Overrides: `--paper #0d1410`, `--paper-2 #121a14`, `--panel #121a14`, `--ink #e9e0c5`, `--muted #8d9480`, `--line #2c3a2e`, `--line-strong #48583f`, `--tile-line #33422f`, `--metal-soft rgba(184,145,47,0.14)`, `--ok #27754f`, `--dim #3c463c`, `--stamp-text #f0ead2`. (`--metal`, `--metal-deep`, `--warm`, `--danger` unchanged.)

### Page background (both themes)
```css
background:
  radial-gradient(1100px 500px at 50% -8%, rgba(184,145,47,0.10), transparent 70%),   /* 0.08 in dark */
  repeating-linear-gradient(0deg, rgba(29,50,41,0.022) 0 1px, transparent 1px 3px),   /* rgba(233,224,197,0.016) in dark */
  var(--paper);
background-attachment: fixed;
```
Plus two fixed decorative **guilloché rings** (pointer-events: none, opacity 0.3): circles of `repeating-radial-gradient(circle at center, var(--line) 0 1px, transparent 1px 11px)`; one 620px at top:-260px/left:-260px, one 720px at bottom:-300px/right:-300px, `border-radius: 50%`.

### Typography
- Display: **Cinzel** (Google Fonts, weights 400/700/900) — wordmark, pot figure, tile letters, modal titles, roman numerals.
- Everything else: **IBM Plex Mono** (weights 400/500/600/700).
- Micro-labels pattern: `font-size 10px; letter-spacing 0.24–0.34em; text-transform uppercase`.
- **No emoji anywhere** (replaces current 🔒/🔊/🌙 usage). Icon buttons use text glyphs: `?`, `♪`/`∅` (sound on/off), `☀`/`☾` (theme).

### Shape language
- **No border-radius** anywhere except circles (icon buttons, seal, spinner). Sharp corners = certificate. (Replaces current 9–18px radii.)
- Double-border panel effect: `border: 1px solid var(--line); box-shadow: inset 0 0 0 4px var(--paper), inset 0 0 0 5px var(--line);`
- Sizing vars: `--tile: clamp(50px, 6.6vh, 70px)`, `--key-h: clamp(44px, 5.6vh, 52px)`.

## Screens / Views

### 1. Header (replaces `.topbar`)
Full-width, centered content max-width 1240px.
- **Utility row** (flex, space-between, padding `16px 28px 0`): left — `ETH SEPOLIA · ROUND № 42` (10px caps, letter-spacing 0.24em, muted; round number in `--metal-deep` 600). Right — three 34px circular icon buttons (1px `--line-strong` border, transparent bg; hover: border+text gold) + **Connect button**: 34px tall, padding 0 18px, sharp corners, 1px `--metal-deep` border, `--metal-soft` bg, 11px/600/0.18em caps; hover: solid `--metal` bg, `--stamp-text` text, soft gold shadow. Connected state: show truncated address, keep quiet style.
- **Masthead** (centered): kicker `✦ IEXEC NOX · CONFIDENTIAL COMPUTE ✦` (10px, 0.34em, `--metal-deep`); wordmark `CRYPTOWORDLE` — Cinzel 900, `clamp(34px, 4.6vw, 58px)`, letter-spacing 0.14em, "CRYPTO" in `--ink`, "WORDLE" in `--metal-deep`; tagline `THE WORDLE NOBODY CAN CHEAT — NOT EVEN US` (11px, 0.26em, muted).
- Bottom rule: `border-bottom: 3px double var(--line-strong)`.

### 2. Main layout (desktop-first, replaces single 560px column)
`max-width 1240px; display flex; flex-wrap: wrap; justify-content center; align-items flex-start; gap 26px; padding 26px 28px 10px`. Three children: left aside (`flex: 1 1 250px; max-width 300px; min-width 240px`), center board column (`flex: 0 1 auto`), right aside (same flex as left). Wraps naturally on narrow screens (asides above/below board) — no media query needed for the columns.

### 3. Left aside — THE POT + LEDGER (replaces `.round-banner`)
- **Pot panel** (double-border panel, padding `22px 20px 20px`): label row "THE POT" between two 1px `--line` fills; centered `0.05` Cinzel 900 52px `--metal-deep` + `ETHER` 12px/0.3em caps; caption "Winner takes all — paid out trustlessly against an on-chain KMS proof." (10.5px muted, line-height 1.65). Divider. Three data rows (label 10px caps muted / value 17px bold tabular-nums): `ROUND ENDS {countdown}`, `GUESSES {total}`, `YOURS {n} of 6`. Countdown shows `settled` when the round is over.
- **Ledger panel** (plain 1px border, padding 16px 18px): "LEDGER" label; rows: Contract → etherscan link `0x5246…490f ↗`, Enclave → `Intel TDX`, Ops per guess → `≈ 95 on ciphertext`. 10.5px.

### 4. Center — status + board + keyboard
- **Status line** (replaces `.status-pill`): no pill chrome; 10.5px/0.22em caps + 11px gold spinner ring (2px border, `--metal-soft` with `--metal` top, spin 0.9s) when busy. Texts: playing `DECRYPTING COLOURS VIA THE KMS…` (muted); won `ALL GREEN — THE VAULT IS YOURS. CLAIM THE POT.` (`--metal-deep`); settled `ROUND SETTLED — THE WORD IS UNSEALED FOR AUDIT.` (`--ok`). Keep existing statusNote strings from game.ts but strip emojis.
- **Board plate**: the 6×5 grid sits on a double-border panel with padding 18px and drop shadow `0 18px 40px -22px rgba(29,50,41,0.45)`. Grid: `repeat(6/5, var(--tile))`, gap 8px.
- **Tiles**:
  - *Empty*: `border: 1px solid var(--tile-line); box-shadow: inset 0 0 0 3px var(--panel), inset 0 0 0 4px var(--line);` (double hairline inset).
  - *Typing*: same + letter in `--ink`, Cinzel 700; keep existing pop animation.
  - *Pending (decrypting)*: `border: 1px solid var(--metal)`; gold scanline shimmer: `linear-gradient(110deg, var(--panel) 32%, var(--metal-soft) 46%, var(--panel) 60%); background-size: 230% 100%; animation: scanline 1.5s linear infinite` (`to { background-position: -230% 0 }`); letter in `--muted`.
  - *Stamped (colored)*: solid `--ok`/`--warm`/`--dim` bg, letter `--stamp-text`, Cinzel 700 at `calc(var(--tile) * 0.44)`, **tiny per-tile rotation** alternating within ±0.5deg (e.g. -0.5, 0.4, -0.3, 0.5, -0.4) for a hand-stamped feel; winning row adds `box-shadow: 0 0 18px rgba(30,107,71,0.35)`.
  - *Color-blind symbols* (keep the existing `data-sym` mechanism): `✓`/`≈`/`×` bottom-right, IBM Plex Mono 700 at `calc(var(--tile) * 0.17)`, opacity 0.8.
  - *Stamp reveal animation* (replaces flip): `stampIn 0.4s ease backwards` — `0% { opacity 0; transform scale(1.25) rotate(-1deg) } 55% { opacity 1; transform scale(0.97) } 100% { transform scale(1) }` — staggered ~60–90ms per tile (keep the existing per-tile reveal timing driven by decryption events; apply stampIn instead of flip when a color lands).
  - Keep the existing shake animation for invalid guesses.
- **Keyboard** (max-width 520px): keys `flex:1; max-width 46px; height var(--key-h)`; sharp corners; unplayed: 1px `--line-strong` border, `--paper-2` bg, `--ink`, 12.5px/600 uppercase, hover border gold, active `scale(0.93)`. Colored keys: borderless stamps — `--warm` + `--stamp-text`; absent: `--dim` + `--stamp-text` at opacity 0.55. **ENTER** is a gold call-to-action key (`flex 1.7; max-width 78px`, 1px `--metal-deep` border, `--metal-soft` bg, 10px/700/0.14em caps; hover solid gold) — `⌫` same size, neutral style.

### 5. Right aside — THE SEAL + HOW THE VAULT WORKS (replaces sealed badge + footer tagline)
- **Seal panel** (double-border panel, centered): wax-seal motif — outer 118px circle, 2px `--metal` border, breathing glow `sealGlow 3s ease-in-out infinite` (`50% { box-shadow: 0 0 26px 2px rgba(184,145,47,0.35) }`); inner 94px circle, 1px `--metal-deep` border, `--metal-soft` bg, containing the **existing lock SVG** from `index.html` (34px, `--metal-deep`). Caption `WORD SEALED IN A TEE` (11px/0.28em/700). Body copy (10.5px, muted, lh 1.7): "Encrypted on Sepolia inside iExec Nox. While the round is live, **nobody can read it** — not the server, not the devs, not us. Hints are computed on ciphertext; only the colours ever decrypt."
  - **Unsealed state** (round settled): ring turns `--ok`, lock replaced by Cinzel `✓` 34px `--ok` on `rgba(30,107,71,0.12)`, caption `UNSEALED — IT WAS "VAPOR"` in `--ok`. (Wire to `revealedWord` like the current sealed-badge logic.)
- **How-it-works panel** (plain border): label "HOW THE VAULT WORKS"; three rows — Cinzel roman numeral `I. II. III.` (14px/700 `--metal-deep`, 22px column) + 10.5px text: **Sealed.** "A CSPRNG picks the word; only encrypted handles ever touch the chain." / **Hinted.** "Each guess is scored inside an Intel TDX enclave — ≈95 encrypted ops per row." / **Audited.** "When the round ends the word is unsealed — replay every hint yourself." (Bold lead-ins in `--ink`.)
- Below panels: legend `✓ CORRECT · ≈ PRESENT · × ABSENT` (10px/0.2em caps muted, centered).

### 6. Footer
Max-width 1240px; 1px `--line` top rule; **microprint line**: "THE WORD IS MATHEMATICALLY UN-LEAKABLE WHILE THE ROUND IS LIVE · " repeated to overflow, 7.5px/0.3em caps, opacity 0.65, `white-space: nowrap; overflow: hidden`, centered. Below: `contract ↗ · MIT · word list from Knuth's Stanford GraphBase` (10px muted; contract links to Etherscan address from config).

### 7. Modals (restyle `modals.ts` — same open/close/backdrop mechanics)
Backdrop: `rgba(15,20,14,0.55)` + blur(3px). Card: max-width 460px, sharp corners, `--panel` bg, double-border via `box-shadow: inset 0 0 0 5px var(--panel), inset 0 0 0 6px <border-color>`, outer shadow `0 30px 80px -20px rgba(10,15,10,0.6)`, entrance `certIn 0.35s cubic-bezier(0.22,1.2,0.36,1)` (from `opacity 0; scale(0.94) translateY(14px)`). Every modal: gold kicker line `✦ … ✦` (10px/0.34em) + Cinzel title.
- **Win** ("Certificate of Claim", `--metal-deep` frame): kicker `ROUND № 42 · KMS-SIGNED`; Cinzel 900 26px title; body 11px; the winning word as five 44px green stamped tiles (with rotations); pot `0.05 ETH` Cinzel 900 40px gold; primary button **CLAIM THE POT** (50px, solid `--metal`, `--stamp-text`, 12px/700/0.24em caps, gold glow shadow); secondary **LATER** (42px, 1px `--line-strong` outline, muted).
- **Round settled** ("The Vault Is Open", `--line-strong` frame): kicker `ROUND № 42 · SETTLED`; revealed word as green stamped tiles; primary **WAIT FOR THE NEXT ROUND**; `PAYOUT TX ↗` micro-link below (9.5px/0.18em caps muted). Covers both solved-by-other and expired (adjust body copy per case as in current `modals.ts`).
- **Help** ("How to Play", `--line-strong` frame): kicker `✦ RULES OF PLAY ✦`; rules paragraph (11.5px, lh 1.75); legend of three 40px stamped tiles ✓/≈/× + caption; divider; "the twist" paragraph; **GOT IT** gold button (46px).
- Buttons all sharp-cornered.

### 8. Toast
Keep mechanics; restyle: `--ink` bg / `--paper` text (inverted), sharp corners, 11px 600; error variant `--danger` bg + `#fff`.

## Interactions & Behavior
- All existing behavior preserved: typing, physical + on-screen keyboard, guess submission, polling, decryption-driven tile reveals, keyboard color absorption (green > yellow > gray), win flow, claim flow, countdown tick, theme persistence (`cw-theme` in localStorage), sound toggle, confetti on win (keep; consider gold/green/ivory particle colors to match).
- Page-load entrance: staggered `riseIn 0.5s ease backwards` (fade + 10px rise) — header 0s, left aside 0.08s, board 0.14s, right aside 0.18s, keyboard 0.22s, footer 0.26s.
- Hover states as specified per component (gold borders/fills). Active keys scale 0.93.
- Keep `@media (prefers-reduced-motion: reduce)` kill-switch and the `@media (max-width: 400px)` brand adjustments if still needed.
- Seal "sealing" slam animation on new round: keep the existing `sealSlam` trigger, retargeted at the seal circle.

## State Management
Unchanged — reuse `state.ts` phases. Visual mapping: `sealing/computing/decrypting` → status line + pending scanline row; `won` → win certificate modal + green stamped row + status; `solved-by-other`/`expired` → settled modal + unsealed seal; `paid` → keep paid modal (style like the win certificate, title "Pot claimed", body from current copy).

## Assets
- Lock icon: the inline SVG path already in `frontend/index.html` (reuse verbatim).
- Fonts via Google Fonts: `https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap`.
- No images. Guilloché rings and paper texture are pure CSS (specs above).

## Optional
The prototype includes a "metal" finish variant (gold `#b8912f/#8a6d1f`, copper `#b06b3f/#8a4f2a`, verdigris `#4f8a76/#33604f`). Ship gold; the others are one-line token swaps if wanted later.

## Files
- `CryptoWordle Redesign.dc.html` + `support.js` — interactive reference (open in browser; use its Tweaks/props `phase` = playing/won/revealed).
- `CryptoWordle Current.dc.html` — current UI recreation (before/after).
- `screenshots/01…07` — new design: light playing, dark playing, help modal, keyboard/footer detail, win certificate, revealed modal, revealed board.
- `screenshots/08–09` — OLD design for comparison.
