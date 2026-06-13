# HEXADROP MVP v0.1

## Objective

Build the smallest playable version of HexaDrop to validate gameplay.

This MVP is focused only on answering:

"Is the core gameplay fun?"

No monetization, no progression, no accounts, no cosmetics.

---

# Game Overview

HexaDrop is a 2-player survival board game played on a collapsing spiral path.

Players race toward the center while trying to push opponents into destroyed sections of the board.

There is no finish line.

The winner is the last surviving player.

---

# MVP Scope

## Included

* 2 Players
* Single Match
* 61 Tile Spiral Board
* D8 Dice
* Bumping System
* Board Collapse System
* Elimination System
* Win Detection

## Not Included

* Login
* Matchmaking
* Chat
* Ranking
* Energy System
* Powerups
* Skins
* Ads
* Purchases
* Bots

---

# Board Layout

Total Tiles: 61

Tile IDs:

1 → 61

Movement can go in any direction (both inward and outward) on the hex grid.

The spiral path layout defines tile IDs (1 to 61) and their starting concentric rings, but players are not forced to follow a single forward direction.

Tile 61 is the center tile.

---

# Player Setup

Player A starts on Tile 1.

Player B starts on Tile 1.

Both players can occupy the same starting tile.

---

# Turn System

Players play one at a time.

Turn Order:

Player A
↓
Player B
↓
Round Ends
↓
Collapse Phase
↓
Next Round

Turn Timer:

No timer. Players manually roll and choose their tiles. No auto-roll.

---

# Dice System

Use one D8 dice.

Possible Values:

1
2
3
4
5
6
7
8

---

# Dice Effects & Manual Selection

## Roll 1-6

Move grid-wise by rolled value. Valid targets at exact grid distance $N$ in any direction (both inward and outward) will highlight.
- **Ring Constraint**: Valid targets must be in the **same concentric ring** or an **immediate adjacent ring** (one ring inward or outward, i.e., `|targetRing - currentRing| <= 1`). Jumps that skip rings are blocked to keep matches highly tactical.
- **Auto-Pass**: If no valid target exists at distance $N$ within the allowed rings, the turn automatically passes.

---

## Roll 7 (Leap)

Move grid-wise 7 tiles. Targets must satisfy the same adjacent ring constraints.

---

## Roll 8 (Overdrive)

Move grid-wise 8 tiles. Targets must satisfy the same adjacent ring constraints.
If landing on opponent, special bump (-6 tiles backward along the spiral) applies.

---

# Bumping Rules

A bump happens when a player lands exactly on the opponent's tile.

---

## Normal Bump

Triggered by rolls:

1
2
3
4
5
6
7

Opponent moves:

-3 Tiles

Example:

Opponent at Tile 30

Opponent becomes Tile 27

---

## Overdrive Bump

Triggered by roll 8.

Opponent moves:

-6 Tiles

Example:

Opponent at Tile 30

Opponent becomes Tile 24

---

# Abyss Rule

Destroyed tiles cannot be occupied.

If a player is pushed onto a destroyed tile:

Player is immediately eliminated.

Example:

Tile 18 already destroyed.

Opponent gets bumped backward onto Tile 18.

Opponent dies instantly.

---

# Collapse Phase

Collapse occurs after both players finish their turns.

Example:

Player A plays
Player B plays

Collapse triggers

---

# Collapse Logic

At the end of every round:

Server randomly destroys 2 tiles from anywhere on the board (any active, undestroyed tiles).

Destroyed tiles remain destroyed forever.

They never return.

---

# Collapse Elimination

If a player is standing on a tile that collapses:

Player immediately dies.

Example:

Player standing on Tile 9.

Tile 9 selected for collapse.

Player eliminated.

---

# Valid Tiles

Server tracks:

alive
destroyed

Destroyed tiles are invalid.

Players cannot exist on destroyed tiles.

---

# Win Condition

Winner = Last Player Alive.

Examples:

Player A Alive
Player B Dead

Winner = Player A

OR

Player B Alive
Player A Dead

Winner = Player B

---

# Match Duration Goal

Target Match Time:

3–5 Minutes

Average Rounds:

6–10

---

# MVP Visual Style

Board:

Simple 2D spiral path.

Tiles:

Gray Hexagons

Destroyed Tile:

Dark Red

Collapse Animation:

Flash Red
Fade Out

Player A:

Blue Circle

Player B:

Orange Circle

Background:

Dark Space Theme

#05070c

---

# Server Authority Rules

Server controls:

* Dice Roll
* Movement
* Bump Calculation
* Tile Destruction
* Elimination
* Winner Detection

Client only:

* Sends Roll Request
* Renders Animation
* Displays State

No gameplay calculation on client.

---

# Success Criteria

The MVP is successful if:

1. Two players understand rules within 30 seconds.
2. Average match lasts 3-5 minutes.
3. Players want to immediately play another match.
4. Bumping creates memorable moments.
5. Board collapse creates tension.

# Tech stack
React + Phaser only
