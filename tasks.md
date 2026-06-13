# HEXADROP — v0.2 Task Board
> Follow one phase at a time. Do NOT start next phase until current phase is complete and tested.

**Legend:**
- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `[~]` Skipped / deferred

---

## PHASE 1 — Domination Points + Dual Win + Match Summary ✅ COMPLETE
> **Goal:** Every move now earns points. Two ways to win. Game ends with a stats screen.
> **Files:** `GameServer.js`, `GameInterface.jsx`, `GameScene.js`
> **Status: ✅ DONE — All tasks implemented and deployed**

---

### 1.1 — GameServer.js: Add DP to State

- [x] Add `dp: 0` to Player A and Player B in `reset()` state
- [x] Add `addDP(playerId, amount, reason)` helper method
  - Clamps DP to minimum 0 (cannot go negative)
  - Adds a combat log entry with reason
- [x] Call `addDP` in the following places:
  - [x] After player moves to inner ring → `+1 DP` ("Moved closer to center")
  - [x] When player enters a new ring (ring number smaller than previous) → `+5 DP` ("Entered Ring N!")
  - [x] After successful bump → `+10 DP` for attacker ("Bump landed!")
  - [x] When bump forces opponent to outer ring → `+15 DP` for attacker ("Forced to Ring N!")
  - [x] When bump eliminates opponent → `+25 DP` for attacker ("Opponent eliminated by bump!")
  - [x] When collapse eliminates opponent (not by bump) → `+15 DP` for surviving player
  - [x] Player receives bump → `-3 DP` for the bumped player
  - [x] Turn auto-passed (no valid moves) → `-2 DP`
  - [x] Opponent eliminated by collapse while on Tile 61 → `+20 DP` (holding center)

### 1.2 — GameServer.js: Dual Win Condition

- [x] Update `checkWinConditions()` to add DP win check:
  - If player A's DP >= 100 → Player A wins (type: 'domination')
  - If player B's DP >= 100 → Player B wins (type: 'domination')
  - Check DP win BEFORE survival win check
- [x] Add `winType: null` to state (`'domination'` or `'survival'`)
- [x] Add `winType` to the state when game ends

### 1.3 — GameServer.js: Track Ring Changes

- [x] Add `previousRing: getRingNumber(startPos)` to each player in state
- [x] After each move, compare player's new ring to `previousRing`
- [x] If ring decreased (moved inward) → award ring entry DP, update `previousRing`

### 1.4 — GameInterface.jsx: DP Display in HUD

- [x] Add DP bar to Player A panel:
  - Show numeric value: `107 DP`
  - Show a progress bar that fills toward 100 (clamp display at 100 even if over)
  - Bar color: blue for A, orange for B
  - Flash animation when DP increases (use a brief CSS class toggle)
- [x] Add same DP bar to Player B panel
- [x] Show DP milestone toasts at 25, 50, 75 DP: e.g. *"Player A — 50 DP!"*

### 1.5 — GameScene.js: DP Gain Visual Feedback

- [x] When DP is earned, emit a floating `+10 DP` text from the player token
  - Green text, floats upward and fades
  - Use the same pattern as existing dice roll floating text
- [x] When DP is lost (`-3 DP`), emit a red floating text downward

### 1.6 — GameInterface.jsx: Match Summary Screen

- [x] Replace the current `playVictorySplash` (just a banner) with a full summary modal
- [x] Summary modal shows:
  - [x] Winner name + win type (`🏆 Domination Win` or `💀 Survival Win`)
  - [x] Final DP for both players
  - [x] Rounds survived
  - [x] Bumps landed (track in state: `bumpsLanded: 0`)
  - [x] Bumps received (track in state: `bumpsReceived: 0`)
  - [x] Hunt Targets hit (placeholder for Phase 2)
- [x] Two buttons: `[PLAY AGAIN]` and `[COPY RESULT]`
  - PLAY AGAIN → calls `handleRestart()`
  - COPY RESULT → copies a text summary to clipboard

### 1.7 — Testing Checklist (Phase 1)

- [x] DP increases correctly for all trigger actions
- [x] DP does not go below 0
- [x] Domination win at 100 DP fires correctly and stops the game
- [x] Survival win still works if no one reaches 100 DP
- [x] Match summary shows correct data
- [x] DP bars display and update in real time
- [x] Floating DP text appears on correct player token

---

## PHASE 2 — Hunt Target System
> **Goal:** Each player gets a secret round target. Completing it earns bonus DP.
> **Files:** `GameServer.js`, `GameInterface.jsx`, `GameScene.js`
> **Estimated effort:** 1–2 sessions
> ⚠️ Requires Phase 1 complete first (uses DP system)

---

### 2.1 — GameServer.js: Target Data Structure

- [ ] Add `huntTarget: null` to each player in state
  - Shape: `{ type, label, param, achieved, dpReward }`
- [ ] Add `generateTarget(playerId)` method
  - Receives playerId and current state
  - Returns a contextually valid target (no impossible targets):
    - If player on Ring 4 → can target Ring 3 or Ring 2
    - If player on Ring 1 → target Ring 2 (move outward) or center
    - "Bump" target only if opponent is within reachable range
  - Target types pool:
    - `{ type: 'reach_ring', label: 'Reach Ring 2', param: 2, dpReward: 15 }`
    - `{ type: 'land_tile', label: 'Land on Tile 42', param: 42, dpReward: 10 }`
    - `{ type: 'land_bump', label: 'Land a Bump this round', param: null, dpReward: 20 }`
    - `{ type: 'land_overdrive', label: 'Land an Overdrive bump', param: null, dpReward: 25 }`
    - `{ type: 'survive_no_bump', label: 'Survive without being bumped', param: null, dpReward: 8 }`
    - `{ type: 'force_outer', label: 'Push opponent to Ring 4', param: null, dpReward: 20 }`

### 2.2 — GameServer.js: Generate Targets at Round Start

- [ ] At start of each round (when `round` increments), call `generateTarget` for both players
- [ ] Also generate on game start (Round 1)
- [ ] Reset `huntTarget.achieved = false` for each new round

### 2.3 — GameServer.js: Check Target Completion

- [ ] Add `checkTargetCompletion(playerId)` — call after every move and bump
- [ ] Check each target type:
  - `reach_ring` → player's current ring === param
  - `land_tile` → player's position === param
  - `land_bump` → bump occurred this turn (attacker only)
  - `land_overdrive` → bump occurred with Overdrive roll
  - `survive_no_bump` → player was not bumped this round (check at round end)
  - `force_outer` → opponent's ring after bump === 4
- [ ] If achieved: mark `huntTarget.achieved = true`, call `addDP(playerId, dpReward, 'Hunt Target!')`
- [ ] Log to combat log: `"Player A completed Hunt Target: Reach Ring 2! (+15 DP)"`

### 2.4 — GameInterface.jsx: Display Target in HUD

- [ ] Show Hunt Target card in player's HUD panel (below position/status)
  - Label: `🎯 THIS ROUND: Land a Bump`
  - Status: `[ ]` pending, `[✓]` achieved (green), `[✗]` failed (shown at round end)
  - DP reward shown: `+20 DP`
- [ ] Pulse the target card when it is achieved (brief glow animation)
- [ ] Do NOT show opponent's target — only your own target on your side

### 2.5 — GameScene.js: Target Achievement Animation

- [ ] When target is achieved, show a floating badge on the board:
  - Text: `🎯 TARGET HIT! +15 DP`
  - Cyan/gold color, larger than regular DP text
  - Stays visible for 1.5s before fading

### 2.6 — Testing Checklist (Phase 2)

- [ ] Targets generate each round for both players
- [ ] No impossible targets generated (e.g., Reach Ring 2 when tiles are all destroyed)
- [ ] Targets reset correctly each round
- [ ] All 6 target types check and complete correctly
- [ ] DP awarded on achievement (not double-awarded)
- [ ] Target hidden from opponent's panel
- [ ] Target achievement animation fires correctly

---

## PHASE 3 — Collapse Intent (Pressure Timer)
> **Goal:** Replace random silent collapse with telegraphed 1-round warning. Players see which tiles will collapse next round.
> **Files:** `GameServer.js`, `GameScene.js`, `GameInterface.jsx`
> **Estimated effort:** 1 session
> ⚠️ Requires Phase 1 complete first

---

### 3.1 — GameServer.js: Warned Tiles State

- [ ] Add `warnedTiles: []` to state in `reset()`
- [ ] Refactor `triggerCollapse()` to two-phase system:
  - **Phase A (warn):** Select 2 new tiles → store in `warnedTiles`
  - **Phase B (destroy):** Destroy the previous round's `warnedTiles`, then warn new ones
- [ ] On first round collapse: warn 2 tiles (nothing destroyed yet — first round is the warning)
- [ ] From Round 2 onward: destroy previous warned tiles → warn 2 new ones
- [ ] Emit `warnedTiles` in state so client can render them

### 3.2 — GameServer.js: Elimination on Warned Tile Collapse

- [ ] After destroying warned tiles, check if any player was standing there
- [ ] Eliminate them (same as current collapse elimination)
- [ ] Players CAN legally move onto warned tiles — they just risk collapse next round

### 3.3 — GameScene.js: Warn Visual Rendering

- [ ] In `handleSyncState`, detect which tiles are in `state.warnedTiles`
- [ ] Render warned tiles with:
  - Pulsing red/orange border (looped tween on border opacity 0.4 → 1.0)
  - Small `⚠️` or `💣` label floating above the tile number
  - Tile fill color slightly shifts toward dark orange (not full destroyed red)
- [ ] When warned tiles are destroyed (next round), play normal collapse animation

### 3.4 — GameInterface.jsx: Collapse Warning Banner

- [ ] In the header or board area, show a warning line when warned tiles exist:
  - `💣 2 tiles will collapse next round — Tile 18, Tile 33`
  - Amber color, visible to both players

### 3.5 — Testing Checklist (Phase 3)

- [ ] Warned tiles show correct visual on board
- [ ] Warned tiles are destroyed exactly one round later
- [ ] Players can still move onto warned tiles
- [ ] Player on warned tile when it collapses → eliminated
- [ ] New warned tiles selected after each collapse
- [ ] Warning banner shows correct tile IDs
- [ ] First round behavior correct (warn only, no destroy)

---

## PHASE 4 — Combo System + Player Identity
> **Goal:** Streak actions trigger named combos with DP bonuses. Players enter names and choose colors.
> **Files:** `GameServer.js`, `GameInterface.jsx`, `GameScene.js`
> **Estimated effort:** 1–2 sessions

---

### 4.1 — GameServer.js: Combo Tracking State

- [ ] Add `combo: { name: null, count: 0, actionHistory: [] }` to each player in state
- [ ] Add `updateCombo(playerId, action)` method
  - `action` is one of: `'bump'`, `'overdrive'`, `'move_inward'`, `'survived_no_bump'`
  - Appends action to `actionHistory` (keep last 5 only)
  - Pattern matches against combo definitions:

```
RAMPAGE:   last 2 actions both 'bump'                → +15 DP
ASCEND:    last 3 actions all 'move_inward'           → +10 DP
BERSERK:   2 'overdrive' actions in last 5            → +20 DP
IRONWALL:  last 3 actions all 'survived_no_bump'      → +10 DP
PRECISION: 3 consecutive hunt targets achieved        → +25 DP (needs target data)
```

- [ ] When combo detected: set `combo.name`, award DP, log to combat log
- [ ] Breaking combo: receiving a bump OR auto-pass resets `actionHistory`
- [ ] Emit combo event in animationReport so Phaser can animate it

### 4.2 — GameScene.js: Combo Flash Animation

- [ ] When `animationReport.combo` is set, show combo flash text on board:
  - Large text (e.g. `🔥 RAMPAGE!`) centered on board
  - Scale punch-in animation (like a fighting game)
  - Player's color accent (blue for A, orange for B)
  - Fades after 1.2s
- [ ] Show smaller floating text near player token: `+15 DP COMBO`

### 4.3 — GameInterface.jsx: Combo Display in HUD

- [ ] Show active combo name in player HUD if combo is active:
  - `🔥 RAMPAGE ×2` (small badge below position)
  - Pulse/glow effect while combo is active
  - Disappears when combo breaks

### 4.4 — Player Identity: Name Entry

- [ ] Add a "name entry" screen before game starts (or overlay on first load)
  - Two text input fields: `Player A Name` and `Player B Name`
  - Default: "Player A" and "Player B"
  - Stored in `localStorage` as `hexadrop_nameA` and `hexadrop_nameB`
- [ ] Replace all "Player A / Player B" text in HUD and logs with entered names
- [ ] Load name from localStorage on page reload (persist between sessions)

### 4.5 — Player Identity: Token Color Picker

- [ ] Add color picker for each player (6 preset colors):
  - Blue (default A), Orange (default B), Green, Purple, Red, Cyan
- [ ] Stored in `localStorage` as `hexadrop_colorA` and `hexadrop_colorB`
- [ ] Apply selected color to:
  - Token circle in Phaser
  - HUD panel border/accent color
  - DP bar color

### 4.6 — LocalStorage: Session Score History

- [ ] After each match, save to localStorage:
  - `hexadrop_lastScores` = last 3 match DP scores per player
  - `hexadrop_winStreak` = current win streak per player
  - `hexadrop_headToHead` = `{ winsA: 0, winsB: 0 }` for current session
- [ ] Display in HUD panel:
  - `Last 3: 107 · 82 · 45 DP`
  - Head-to-head: `Gaurav 3 — 2 Rohan`

### 4.7 — Share Card (Copy Result)

- [ ] "Copy Result" button in match summary generates text:
  ```
  🎮 I won HexaDrop!
  💥 3 Bumps · 🔥 107 DP · 🏆 Domination Win
  Streak: 3 Wins
  Can you beat that? → hexadrop.game
  ```
- [ ] Uses `navigator.clipboard.writeText()` with fallback
- [ ] Button changes to "Copied! ✓" for 2s after clicking

### 4.8 — Testing Checklist (Phase 4)

- [ ] All 5 combo patterns trigger correctly
- [ ] Combo resets on bump received or auto-pass
- [ ] DP awarded once per combo (no double trigger)
- [ ] Combo animation shows correct player color
- [ ] Player names load from localStorage on refresh
- [ ] Color picker updates token and HUD correctly
- [ ] Session history saves and displays correctly
- [ ] Share card copies correct result text

---

## PHASE 5 — Ring Control System
> **Goal:** Holding a ring solo gives movement and bump bonuses — chess-style board control.
> **Files:** `GameServer.js`, `GameInterface.jsx`, `GameScene.js`
> **Estimated effort:** 2 sessions
> ⚠️ Most complex phase — do not start until Phases 1–4 are stable

---

### 5.1 — GameServer.js: Ring Control State

- [ ] Add `ringControl: { 0: null, 1: null, 2: null, 3: null, 4: null }` to state
  - Value: `'A'`, `'B'`, or `null` (neutral)
- [ ] Add `ringPresenceStreak: { A: {}, B: {} }` — counts how many consecutive rounds each player was sole occupant of each ring
- [ ] Add `updateRingControl()` — called at end of each turn:
  - For each ring: check who is currently on it
  - If only Player A is on ring N for 2+ consecutive turns → `ringControl[N] = 'A'`
  - If only Player B is on ring N for 2+ consecutive turns → `ringControl[N] = 'B'`
  - If both players or neither → `ringControl[N] = null`
  - Log control changes to combat log

### 5.2 — GameServer.js: Apply Control Modifiers to Movement

- [ ] In `rollDice()`, after calculating valid targets:
  - If player controls target tile's ring → allow BFS distance ±1 (effectively +1 reach)
  - If opponent controls target tile's ring → only accept BFS distance that is 1 less (effectively -1 reach)
- [ ] Be careful: do not let movement modifier cause BFS distance = 0 or negative

### 5.3 — GameServer.js: Apply Control Modifier to Bump

- [ ] In `selectTile()` bump section:
  - If attacker controls the ring where bump occurs → bump distance +1
  - If defender controls that ring → bump distance -1 (min 1)

### 5.4 — GameScene.js: Ring Control Visuals

- [ ] In `handleSyncState`, read `state.ringControl`
- [ ] For each controlled ring, add a subtle glow tint to all tiles in that ring:
  - Player A controls → faint blue edge tint on ring tiles
  - Player B controls → faint orange edge tint on ring tiles
  - Neutral → no tint (default)
- [ ] Tint should be subtle — not overpower the tile colors

### 5.5 — GameInterface.jsx: Ring Control HUD Display

- [ ] Add small ring control indicators in each player panel:
  ```
  CONTROLS:  Ring 2  Ring 3
  ```
  - Show controlled rings as small colored badges
- [ ] Show `🔒 Contested` if both players share a ring (no control)
- [ ] Alert line when control changes: *"Player A seized Ring 2 control!"*

### 5.6 — Testing Checklist (Phase 5)

- [ ] Ring control correctly assigned after 2 consecutive solo turns
- [ ] Ring control lost immediately when opponent enters
- [ ] Movement modifier applies correctly (not causing impossible states)
- [ ] Bump modifier applies correctly
- [ ] Ring tint visuals update in sync with server state
- [ ] HUD control badges update correctly
- [ ] Control alert messages fire correctly
- [ ] Edge case: both players on same tile — ring = contested, no control

---

## FINAL INTEGRATION CHECKLIST

- [ ] All 5 phases working together without state conflicts
- [ ] DP win check doesn't interrupt animations mid-way
- [ ] Hunt targets generate correctly in late game (few tiles left)
- [ ] Combo system works alongside ring control modifiers
- [ ] Match summary shows all phase data (DP, targets hit, combos, rings controlled)
- [ ] localStorage persists correctly across page reloads
- [ ] Rules modal updated to explain DP, Hunt Targets, Collapse Intent, Ring Control, Combos
- [ ] Game tested for minimum 10 full matches end-to-end

---

## Quick Reference — Files Changed Per Phase

| Phase | GameServer.js | GameInterface.jsx | GameScene.js |
|-------|:---:|:---:|:---:|
| 1 — DP + Win + Summary | ✅ Major | ✅ Major | ✅ Minor |
| 2 — Hunt Targets | ✅ Major | ✅ Medium | ✅ Minor |
| 3 — Collapse Intent | ✅ Medium | ✅ Minor | ✅ Medium |
| 4 — Combos + Identity | ✅ Medium | ✅ Major | ✅ Minor |
| 5 — Ring Control | ✅ Major | ✅ Medium | ✅ Medium |

---

*Created: HexaDrop v0.2 planning — follow phases in order.*
