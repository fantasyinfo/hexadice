# HEXADROP — Game Design Document
### Current Build: MVP v0.1 · Next Target: v0.2 (Full Gamification Overhaul)

---

## What Is HexaDrop?

HexaDrop is a **2-player tactical survival board game** played on a collapsing hex grid.

The board shrinks every round. Players roll dice, move across a concentric spiral, bump opponents, complete hunt targets, and race for Domination Points.

> **Core Loop (v0.2):** Roll → Move → Hunt Target → Bump → Ring Control → Collapse → Score → Repeat

---

## PART 1 — Current Rules (MVP v0.1 — Live & Accurate)

### Board
- **61 hexagonal tiles** in 5 concentric rings
- Ring 4 (outermost): Tiles 1–24 · Ring 3: 25–42 · Ring 2: 43–54 · Ring 1: 55–60 · Ring 0: Tile 61 (center)

### Player Spawn
- Both players spawn randomly on **Ring 4** at two different tiles (no shared spawn)

### Turn Order
```
Player A rolls & moves
↓
Player B rolls & moves
↓
Collapse Phase (2 tiles destroyed)
↓
Next Round
```

### Dice (D8)
| Roll | Effect |
|------|--------|
| 1–6  | Move exactly N BFS grid steps (active tiles only, ±1 ring constraint) |
| 7    | **Leap** — 7 BFS steps |
| 8    | **Overdrive** — 8 BFS steps + stronger bump |

### Bump Rules (Step-by-Step Walk)
| Type | Distance |
|------|----------|
| Normal (roll 1–7) | Opponent slides -3 tiles backward |
| Overdrive (roll 8) | Opponent slides -6 tiles backward |

- Walk is step-by-step — stops at first destroyed tile (player eliminated there)
- Goes off board (past Tile 1) → eliminated

### Collapse Phase
- After every round: **2 random active tiles** permanently destroyed
- Player on collapsing tile → immediately eliminated

### Win Condition (v0.1)
- Last player alive wins

---

## PART 2 — NEW SYSTEMS (v0.2 Design Spec)

---

### 🎯 SYSTEM 1: HUNT TARGET SYSTEM

**The Big One. Transforms every round into a mission.**

At the start of each round, **each player receives a random secret target**.
If achieved this round → bonus Domination Points (DP) rewarded.

#### Target Pool

**Tile Targets:**
- "Land on Tile [X]" (X = a specific active tile near current position)
- "Reach Ring [N]" (move into an inner ring)
- "Escape to Ring 4" (move outward — defensive target)

**Combat Targets:**
- "Land 1 Bump this round"
- "Land 1 Overdrive this round"
- "Force opponent backward into Ring 4"

**Survival Targets:**
- "Survive this round without being bumped"
- "Stay on same ring for the full round"
- "Don't land on a Ring 4 tile this round"

#### Target Rules
- Targets are **per-player, per-round** — opponent does NOT see your target
- Target resets each round regardless of success/failure
- Targets are **generated contextually** — based on player's current position and available tiles (no impossible targets)
- Bonus DP awarded at **end of round** if target was met
- Target shown in player's HUD panel at round start

#### Target DP Rewards
| Target Type | DP Reward |
|------------|-----------|
| Tile Target (easy) | +10 DP |
| Ring Target | +15 DP |
| Combat Target | +20 DP |
| Survival Target | +8 DP |

**Why This Works:**
Every turn now has a sub-question: *"Can I reach my target AND also play well?"* Targets create private stories. Players will say *"I was going for a bump but I needed to hit tile 42 first."*

---

### ⚔️ SYSTEM 2: DOMINATION POINTS (DP)

**Replaces passive survival with active scoring.**

Every meaningful action earns DP. You are no longer just waiting to be the last one standing — you are actively competing for dominance every single turn.

#### DP Earn Table
| Action | DP Earned |
|--------|-----------|
| Move closer to center (reduce ring) | +1 DP |
| Enter a new inner ring for the first time | +5 DP |
| Bump opponent successfully | +10 DP |
| Force opponent back to a lower (outer) ring | +15 DP |
| Opponent eliminated via your bump | +25 DP |
| Opponent eliminated via collapse (you weren't bumped) | +15 DP |
| Hold center tile (Tile 61) full round | +20 DP |
| Complete Hunt Target | +8 to +20 DP (see above) |
| Survive a round where your tile was adjacent to a collapse | +5 DP ("Close Call") |

#### DP Deductions
| Action | DP Lost |
|--------|---------|
| Receive a bump | -3 DP |
| Turn auto-passed (no valid moves) | -2 DP |

#### DP Display
- Both players' DP shown live in their HUD panels
- DP bar fills toward 100 — visible progress like a health/XP bar
- Flash animation when DP milestones hit (25, 50, 75, 100)

---

### 🏆 SYSTEM 3: DUAL WIN CONDITION

**Two valid strategies. Two paths to victory.**

#### Win Path A — DOMINATION WIN 🏆
First player to reach **100 Domination Points** wins instantly.
- Aggressive player's win path
- Rewards: bumping, targeting, center control
- Can end game early if one player dominates

#### Win Path B — SURVIVAL WIN 💀
If neither player reaches 100 DP, game continues until **last player alive**.
- Defensive/cautious player's win path
- Board collapse will eventually decide things
- Forces aggressive player to also care about staying alive

#### Strategy Identity
```
AGGRESSIVE PLAYER: Chase 100 DP → bump hard, hold center, complete targets
DEFENSIVE PLAYER: Survive collapse → avoid risky moves, let board shrink
```
*Both are valid. Neither is obviously correct. This is what creates real rivalry.*

---

### 🔥 SYSTEM 4: RING CONTROL

**Makes positioning feel like chess.**

A player **controls a ring** when they have been the ONLY player on that ring for 2+ consecutive turns.

#### Control Benefits (for the controlling player)
- **+1 BFS movement bonus** — can reach tiles 1 step farther in that ring
- **Bump power +1** — bump distance increases by 1 in their controlled ring
- Visual: controlled ring tiles glow with player's color (subtle edge tint)

#### Control Penalty (for the opponent in a controlled ring)
- **-1 BFS movement** — tiles 1 step closer are the max reach in that ring
- This makes the opponent feel "squeezed"

#### Control Rules
- Control is **lost immediately** when opponent enters that ring
- Control is ring-specific — you can control Ring 3 while opponent controls Ring 2
- Center tile (Tile 61) cannot be "controlled" — it's always neutral

#### HUD Display
- Small icon next to ring indicator: 🔵 (controlled by A), 🟠 (controlled by B), ⬜ (neutral)

**Why This Works:**
Players now think *"I need to lock down Ring 2 before he gets there."* Movement becomes about territory, not just distance. This is the chess-like layer the game needs.

> **⚠️ Design Note:** Ring Control is the most complex system. Must be displayed very clearly in HUD or it will confuse players. Keep visual feedback extremely obvious.

---

### 💀 SYSTEM 5: PRESSURE TIMER — COLLAPSE INTENT

**Replaces random collapse with telegraphed collapse.**

Instead of 2 random tiles being destroyed with no warning:

#### New Collapse Flow
```
Round N:
  → Server selects 2 tiles to "warn" (mark as endangered)
  → Warned tiles shown with PULSING RED border + ⚠️ icon
  → Players can see which tiles are marked this round
  
Round N+1 (next collapse phase):
  → Those 2 warned tiles are DESTROYED
  → 2 new tiles are warned for Round N+2
```

#### Strategic Impact
Players now face a decision every turn:
- *"Do I chase the opponent or escape the marked tile?"*
- *"Can I bait him onto a warned tile?"*
- *"The tile I want is marked — is it worth the risk?"*

#### Warning Rules
- Warned tiles are **public** — both players see them
- Players CAN still move onto warned tiles (risky but valid)
- If a player is on a warned tile when it collapses → eliminated (same as now)
- Warned tiles still generate from anywhere on board (not ring-restricted)

**Why This Works:**
Random collapse feels like a coinflip. Telegraphed collapse feels like a threat you can respond to. *"I saw it coming and I chose to risk it"* vs *"RNG killed me."* Players blame themselves, not the game.

---

### ⚡ SYSTEM 6: COMBO SYSTEM

**Streaks and momentum. This is what makes games addictive.**

When a player performs consecutive high-value actions, a **Combo State** activates.

#### Combo Triggers
| Combo Name | Trigger | Bonus |
|-----------|---------|-------|
| 🔥 **RAMPAGE** | 2 bumps in a row (consecutive turns) | +15 DP bonus, bump visual effect upgrades |
| ⚡ **ASCEND** | 3 consecutive moves toward center | +10 DP + movement animation effect |
| 💥 **BERSERK** | 2 Overdrive rolls (8) in one match | +20 DP + "Berserk" badge |
| 🛡️ **IRONWALL** | Survive 3 rounds without receiving a bump | +10 DP + shield visual on token |
| 🎯 **PRECISION** | 3 Hunt Targets completed in a row | +25 DP + target upgrades to "rare" tier |

#### Combo Display
- Combo name flashes in large text on the Phaser board (like a fighting game)
- Combo counter shown in player HUD
- Breaking a combo (getting bumped, passing turn) resets it
- Opponent sees a small alert: *"Player A is on a RAMPAGE!"*

**Why This Works:**
Humans love streaks. When you're on a combo, you play more carefully to protect it. When you're NOT on a combo, you chase one. Both states keep the player intensely engaged. Candy Crush, PUBG kill streaks, Chess momentum — same psychology.

---

## PART 3 — Updated Win Condition Summary

```
GAME ENDS WHEN:
Either player reaches 100 DP → DOMINATION WIN 🏆
OR
One player is eliminated (last alive) → SURVIVAL WIN 💀

DRAW: Both eliminated simultaneously → no winner, 0 DP gained
```

---

## PART 4 — Match Summary Screen (v0.2)

After every match:

```
╔══════════════════════════════════╗
║  🏆  PLAYER A — DOMINATION WIN!  ║
╠══════════════════════════════════╣
║  Domination Points:    107 DP    ║
║  Rounds Survived:      8         ║
║  Bumps Landed:         3         ║
║  Hunt Targets Hit:     5/8       ║
║  Combos Triggered:     2         ║
║  Rings Controlled:     Ring 2, 3 ║
║  Win Streak:           🔥 3 Wins  ║
╠══════════════════════════════════╣
║  [REMATCH]        [SHARE RESULT] ║
╚══════════════════════════════════╝
```

---

## PART 5 — Implementation Priority

| Priority | System | Effort | Impact | Build First? |
|----------|--------|--------|--------|-------------|
| 🔴 P0 | **Domination Points (DP)** | Low | Critical | YES |
| 🔴 P0 | **Dual Win Condition** | Low | Critical | YES |
| 🔴 P0 | **Match Summary Screen** | Low | Very High | YES |
| 🟡 P1 | **Hunt Target System** | Medium | Very High | Yes |
| 🟡 P1 | **Collapse Intent (Warning)** | Medium | High | Yes |
| 🟡 P1 | **Combo System** | Medium | High | Yes |
| 🟢 P2 | **Ring Control** | High | High | After P1 |
| 🟢 P2 | Player Names + Share Card | Low | High | After P1 |
| 🔵 P3 | Win Streak Multiplier | Low | Medium | Later |
| 🔵 P3 | In-Session Badges | Medium | Medium | Later |

---

## PART 6 — Technical Notes (How to Build)

### DP System
- Add `dp: 0` to each player in `GameServer.js` state
- Add `addDP(playerId, amount, reason)` helper in GameServer
- Call `addDP` after every bump, ring change, collapse survival, etc.
- DP win check inside `checkWinConditions()`

### Hunt Target System
- Add `huntTarget: null` to each player in state
- `generateTarget(playerId)` runs at round start — contextual logic based on position
- `checkTargetCompletion(playerId)` runs after each move
- Targets stored as `{ type, param, achieved, dpReward }`

### Collapse Intent
- Add `warnedTiles: []` to state
- Server selects 2 tiles during current collapse phase → stores in `warnedTiles`
- Next collapse phase: destroy `warnedTiles`, generate new `warnedTiles`
- Phaser: render warned tiles with pulsing red border

### Ring Control
- Add `ringControl: { 0: null, 1: null, 2: null, 3: null, 4: null }` to state
- After each move: check which player is sole occupant of each ring for 2+ turns
- Apply movement modifier during `rollDice` valid target calculation

### Combo System
- Add `combo: { name, count, lastAction }` to each player
- Track last N actions per player
- Pattern-match against combo triggers after each action
- Trigger animation event to Phaser for combo flash

---

## PART 7 — Tech Stack

- **Frontend:** React + Phaser (existing)
- **Game Logic:** GameServer.js (authoritative, client-side)
- **Persistence:** localStorage — names, scores, streaks, head-to-head record
- **No backend needed** for v0.2

---

*Last updated: v0.1 complete → v0.2 full design spec locked*
