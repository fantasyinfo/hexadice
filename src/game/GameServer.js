// GameServer.js
// HexaDrop v0.2 — Phase 1: Domination Points + Dual Win Condition
// Authoritative game logic — all state changes happen here.

import { getRingTiles, getRingNumber, getBfsDistance } from './BoardGeometry';

// NOTE: getBfsDistance (BFS through active tiles) is used instead of axial hex distance.
// Axial distance ignores destroyed tiles; BFS correctly treats them as obstacles.

export class GameServer {
  constructor() {
    this.reset();
  }

  reset() {
    // Pick 2 different random starting tiles from Ring 4 (tiles 1–24)
    const ring4Tiles = Array.from({ length: 24 }, (_, i) => i + 1);
    const idxA = Math.floor(Math.random() * ring4Tiles.length);
    let idxB;
    do { idxB = Math.floor(Math.random() * ring4Tiles.length); } while (idxB === idxA);
    const startA = ring4Tiles[idxA];
    const startB = ring4Tiles[idxB];

    this.state = {
      players: {
        A: {
          id: 'A', name: 'Player A', position: startA, isAlive: true,
          dp: 0,                        // Domination Points
          previousRing: getRingNumber(startA), // Track ring changes
          bumpsLanded: 0,               // stat for match summary
          bumpsReceived: 0,             // stat for match summary
          huntTarget: null,
          huntTargetsHit: 0,
          bumpedThisRound: false,
        },
        B: {
          id: 'B', name: 'Player B', position: startB, isAlive: true,
          dp: 0,
          previousRing: getRingNumber(startB),
          bumpsLanded: 0,
          bumpsReceived: 0,
          huntTarget: null,
          huntTargetsHit: 0,
          bumpedThisRound: false,
        }
      },
      destroyedTiles: {},   // tileId -> true
      activeRing: 4,
      currentTurn: 'A',
      round: 1,
      winner: null,         // 'A', 'B', 'Draw', or null
      winType: null,        // 'domination' | 'survival' | 'draw'
      isGameOver: false,
      activeRoll: null,     // { roll, isOverdrive, isLeap, movement, validTargets }
      combatLog: []
    };
    this.logCounter = 0;
    this.addLog(`Game started! Player A on Tile ${startA}, Player B on Tile ${startB}. First to 100 DP or last alive wins!`, 'system');
    this.generateTarget('A');
    this.generateTarget('B');
  }

  // ─── Logging ────────────────────────────────────────────────────────────────

  addLog(text, type = 'system') {
    this.state.combatLog.push({
      id: ++this.logCounter,
      text,
      type,
      round: this.state.round,
      turn: this.state.currentTurn
    });
  }

  // ─── Hunt Target System ─────────────────────────────────────────────────────

  generateTarget(playerId) {
    const player = this.state.players[playerId];
    if (!player || !player.isAlive) return;

    const currentRing = getRingNumber(player.position);
    const opponentId = playerId === 'A' ? 'B' : 'A';
    const opponent = this.state.players[opponentId];
    const opponentRing = getRingNumber(opponent.position);

    const activeTiles = [];
    for (let id = 1; id <= 61; id++) {
      if (!this.state.destroyedTiles[id]) activeTiles.push(id);
    }

    const possibleTargets = [];

    // 1. Reach Ring X (only if there are active tiles in that ring)
    let targetRing = null;
    if (currentRing === 4) targetRing = [2, 3][Math.floor(Math.random() * 2)];
    else if (currentRing === 3) targetRing = [1, 2][Math.floor(Math.random() * 2)];
    else if (currentRing === 2) targetRing = [1, 3][Math.floor(Math.random() * 2)];
    else if (currentRing === 1) targetRing = [2, 3][Math.floor(Math.random() * 2)];

    if (targetRing !== null) {
      const ringTiles = getRingTiles(targetRing);
      const hasActiveTileInRing = ringTiles.some(t => !this.state.destroyedTiles[t]);
      if (hasActiveTileInRing) {
        possibleTargets.push({ type: 'reach_ring', label: `Reach Ring ${targetRing}`, param: targetRing, dpReward: 15 });
      }
    }

    // 2. Land on specific tile
    if (activeTiles.length > 0) {
      let targetTile = activeTiles[Math.floor(Math.random() * activeTiles.length)];
      while (targetTile === player.position && activeTiles.length > 1) {
        targetTile = activeTiles[Math.floor(Math.random() * activeTiles.length)];
      }
      possibleTargets.push({ type: 'land_tile', label: `Land on Tile ${targetTile}`, param: targetTile, dpReward: 10 });
    }

    // 3. Bump based (if opponent is alive)
    if (opponent.isAlive) {
      possibleTargets.push({ type: 'land_bump', label: 'Land a Bump this round', param: null, dpReward: 20 });
      possibleTargets.push({ type: 'land_overdrive', label: 'Land an Overdrive bump', param: null, dpReward: 25 });
      
      if (opponentRing < 4) {
        possibleTargets.push({ type: 'force_outer', label: 'Push opponent to Ring 4', param: null, dpReward: 20 });
      }
    }

    // 4. Survive no bump
    possibleTargets.push({ type: 'survive_no_bump', label: 'Survive without being bumped', param: null, dpReward: 8 });

    const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    target.achieved = false;
    player.huntTarget = target;
  }

  checkTargetCompletion(playerId, actionContext) {
    const player = this.state.players[playerId];
    if (!player || !player.isAlive || !player.huntTarget || player.huntTarget.achieved) return;

    const target = player.huntTarget;
    let achieved = false;

    if (target.type === 'reach_ring') {
      if (getRingNumber(player.position) === target.param) achieved = true;
    } else if (target.type === 'land_tile') {
      if (player.position === target.param) achieved = true;
    } else if (target.type === 'land_bump') {
      if (actionContext && actionContext.bumpedOpponent) achieved = true;
    } else if (target.type === 'land_overdrive') {
      if (actionContext && actionContext.bumpedOpponent && actionContext.isOverdrive) achieved = true;
    } else if (target.type === 'force_outer') {
      if (actionContext && actionContext.bumpedOpponent && actionContext.opponentNewRing === 4) achieved = true;
    } else if (target.type === 'survive_no_bump') {
      if (actionContext && actionContext.roundEnded && !actionContext.wasBumped) achieved = true;
    }

    if (achieved) {
      target.achieved = true;
      player.huntTargetsHit++;
      this.addDP(playerId, target.dpReward, 'Hunt Target!');
      if (actionContext && actionContext.dpEvents) {
        actionContext.dpEvents.push({ playerId, amount: target.dpReward, label: `🎯 TARGET HIT! +${target.dpReward} DP`, isTarget: true });
      }
    }
  }

  // ─── DP System ──────────────────────────────────────────────────────────────

  /**
   * Award or deduct Domination Points.
   * Clamps DP to a minimum of 0 (cannot go negative).
   * Logs the reason to the combat log.
   */
  addDP(playerId, amount, reason) {
    const player = this.state.players[playerId];
    if (!player || !player.isAlive) return;

    const before = player.dp;
    player.dp = Math.max(0, player.dp + amount);
    const actual = player.dp - before;

    if (actual === 0) return;

    const sign = actual > 0 ? '+' : '';
    const logType = actual > 0 ? 'dp_gain' : 'dp_loss';
    this.addLog(`[DP] Player ${playerId}: ${sign}${actual} — ${reason} (${player.dp} total)`, logType);
  }

  /**
   * Check if player moved to a new (more inner) ring and award DP accordingly.
   * Called after every position change.
   */
  checkRingProgress(playerId) {
    const player = this.state.players[playerId];
    const newRing = getRingNumber(player.position);
    const oldRing = player.previousRing;

    if (newRing < oldRing) {
      // Moved inward — award for each ring crossed
      this.addDP(playerId, 1, 'Moved closer to center');
      if (newRing < oldRing) {
        // Award ring-entry bonus (first time entering this inner ring)
        this.addDP(playerId, 5, `Entered Ring ${newRing}!`);
      }
    }

    player.previousRing = newRing;
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  // ─── Dice Roll (Phase 1 of a turn) ─────────────────────────────────────────

  rollDice(playerId, forcedRoll = null) {
    if (this.state.isGameOver) {
      return { state: this.getState(), error: 'Game is already over' };
    }
    if (playerId !== this.state.currentTurn) {
      return { state: this.getState(), error: 'Not your turn' };
    }
    if (this.state.activeRoll) {
      return { state: this.getState(), error: 'Already rolled. Select a tile to move.' };
    }

    const player = this.state.players[playerId];

    // 1. Roll D8
    const roll = forcedRoll !== null ? forcedRoll : Math.floor(Math.random() * 8) + 1;
    let movement = roll;
    let isLeap = false;
    let isOverdrive = false;

    if (roll === 7) { isLeap = true; }
    else if (roll === 8) { isOverdrive = true; }

    this.addLog(
      `Player ${playerId} rolled a ${roll}! (${isOverdrive ? 'Overdrive!' : isLeap ? 'Leap!' : 'Move ' + movement})`,
      'roll'
    );

    // 2. Calculate valid target tiles (BFS distance === movement, ±1 ring)
    const validTargets = [];
    const currentPos = player.position;
    const currentRing = getRingNumber(currentPos);

    for (let targetId = 1; targetId <= 61; targetId++) {
      if (targetId === currentPos) continue;
      if (this.state.destroyedTiles[targetId]) continue;

      const targetRing = getRingNumber(targetId);
      if (Math.abs(targetRing - currentRing) > 1) continue;

      const dist = getBfsDistance(currentPos, targetId, this.state.destroyedTiles);
      if (dist === movement) {
        validTargets.push(targetId);
      }
    }

    // 3. No valid moves → auto-pass
    if (validTargets.length === 0) {
      this.addLog(
        `No valid tiles at distance ${movement} in adjacent rings for Player ${playerId}! Turn passed.`,
        'warning'
      );

      // DP penalty for forced pass
      this.addDP(playerId, -2, 'Turn auto-passed');

      let collapsedTilesThisTurn = [];
      const eliminatedThisTurn = [];

      let dpEventsForPass = [];
      if (this.state.currentTurn === 'A') {
        this.state.currentTurn = 'B';
      } else {
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;
        collapseReport.eliminated.forEach(pId => eliminatedThisTurn.push(pId));
        this._awardCollapseDP(eliminatedThisTurn);
        this.checkWinConditions();
        if (!this.state.isGameOver) {
          this.state.currentTurn = 'A';
          this.state.round++;
          this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');

          this.checkTargetCompletion('A', { roundEnded: true, wasBumped: this.state.players.A.bumpedThisRound, dpEvents: dpEventsForPass });
          this.checkTargetCompletion('B', { roundEnded: true, wasBumped: this.state.players.B.bumpedThisRound, dpEvents: dpEventsForPass });
          
          this.state.players.A.bumpedThisRound = false;
          this.state.players.B.bumpedThisRound = false;

          this.generateTarget('A');
          this.generateTarget('B');
        }
      }

      return {
        state: this.getState(),
        animationReport: {
          roll, isOverdrive, isLeap, playerId,
          validTargets: [],
          type: 'pass_phase',
          collapsedTiles: collapsedTilesThisTurn,
          eliminated: eliminatedThisTurn,
          dpEvents: dpEventsForPass
        }
      };
    }

    // 4. Save active roll
    this.state.activeRoll = { roll, isOverdrive, isLeap, movement, validTargets };

    return {
      state: this.getState(),
      animationReport: {
        roll, isOverdrive, isLeap, playerId,
        validTargets,
        type: 'roll_phase'
      }
    };
  }

  // ─── Tile Selection & Movement (Phase 2 of a turn) ─────────────────────────

  selectTile(playerId, targetTileId) {
    if (this.state.isGameOver) {
      return { state: this.getState(), error: 'Game is already over' };
    }
    if (playerId !== this.state.currentTurn) {
      return { state: this.getState(), error: 'Not your turn' };
    }
    if (!this.state.activeRoll) {
      return { state: this.getState(), error: 'Must roll dice first' };
    }
    if (!this.state.activeRoll.validTargets.includes(targetTileId)) {
      return { state: this.getState(), error: 'Invalid target tile selection' };
    }

    const player = this.state.players[playerId];
    const opponentId = playerId === 'A' ? 'B' : 'A';
    const opponent = this.state.players[opponentId];

    const startPosA = this.state.players.A.position;
    const startPosB = this.state.players.B.position;

    // Track DP events for Phaser floating text animation
    const dpEvents = [];

    let bumpOccurred = false;
    let bumpDistance = 0;
    let bumpedIntoAbyss = false;
    const eliminatedThisTurn = [];
    let collapsedTilesThisTurn = [];

    // ── 1. Move player ──────────────────────────────────────────────────────
    player.position = targetTileId;
    this.addLog(`Player ${playerId} moved to Tile ${targetTileId}.`, 'system');

    // DP: ring progress
    const dpBefore = player.dp;
    this.checkRingProgress(playerId);
    const dpAfter = player.dp;
    if (dpAfter > dpBefore) {
      dpEvents.push({ playerId, amount: dpAfter - dpBefore, label: `+${dpAfter - dpBefore} DP` });
    }

    // ── 2. Bump if landing on opponent ─────────────────────────────────────
    if (targetTileId === opponent.position) {
      bumpOccurred = true;
      const maxBumpDistance = this.state.activeRoll.isOverdrive ? 6 : 3;
      const opponentOrigPos = opponent.position;

      // Walk backward step-by-step — stop at first destroyed or off-board tile
      let opponentNewPos = opponentOrigPos;
      let actualDistance = 0;
      let hitDestroyed = false;
      let fellOffBoard = false;

      for (let step = 1; step <= maxBumpDistance; step++) {
        const nextPos = opponentOrigPos - step;
        if (nextPos < 1) {
          fellOffBoard = true;
          actualDistance = step;
          break;
        }
        if (this.state.destroyedTiles[nextPos]) {
          opponentNewPos = nextPos;
          hitDestroyed = true;
          actualDistance = step;
          break;
        }
        opponentNewPos = nextPos;
        actualDistance = step;
      }

      bumpDistance = actualDistance;
      this.addLog(
        `BUMP! Player ${playerId} landed on Player ${opponentId}. Opponent knocked back -${actualDistance} tile${actualDistance !== 1 ? 's' : ''}.`,
        'bump'
      );

      // Stats
      player.bumpsLanded++;
      opponent.bumpsReceived++;
      opponent.bumpedThisRound = true;

      // DP: bump landed
      this.addDP(playerId, 10, 'Bump landed!');
      dpEvents.push({ playerId, amount: 10, label: '+10 DP BUMP!' });

      // DP: opponent receives bump penalty
      this.addDP(opponentId, -3, 'Received a bump');
      dpEvents.push({ playerId: opponentId, amount: -3, label: '-3 DP' });

      if (fellOffBoard) {
        opponent.isAlive = false;
        opponent.position = Math.max(1, opponentOrigPos - actualDistance + 1);
        bumpedIntoAbyss = true;
        eliminatedThisTurn.push(opponentId);
        this.addLog(`Player ${opponentId} was knocked off the outer ring and fell into the Abyss!`, 'elimination');

        // DP: bump eliminated opponent
        this.addDP(playerId, 25, 'Opponent eliminated by bump!');
        dpEvents.push({ playerId, amount: 25, label: '+25 DP KILL!' });

      } else if (hitDestroyed) {
        opponent.isAlive = false;
        opponent.position = opponentNewPos;
        bumpedIntoAbyss = true;
        eliminatedThisTurn.push(opponentId);
        this.addLog(`Player ${opponentId} slid into destroyed Tile ${opponentNewPos} and fell into the Abyss!`, 'elimination');

        this.addDP(playerId, 25, 'Opponent eliminated by bump!');
        dpEvents.push({ playerId, amount: 25, label: '+25 DP KILL!' });

      } else {
        opponent.position = opponentNewPos;

        // DP: forced opponent to outer ring?
        const opponentNewRing = getRingNumber(opponentNewPos);
        const opponentOldRing = getRingNumber(opponentOrigPos);
        if (opponentNewRing > opponentOldRing) {
          this.addDP(playerId, 15, `Forced opponent back to Ring ${opponentNewRing}!`);
          dpEvents.push({ playerId, amount: 15, label: '+15 DP PUSH!' });
        }

        // Update opponent's previousRing after being pushed
        opponent.previousRing = opponentNewRing;
      }
    }

    // Target check for move/bump
    this.checkTargetCompletion(playerId, {
      bumpedOpponent: bumpOccurred,
      isOverdrive: this.state.activeRoll.isOverdrive,
      opponentNewRing: bumpOccurred && !bumpedIntoAbyss ? getRingNumber(opponent.position) : null,
      dpEvents
    });

    // ── 3. Clear active roll ────────────────────────────────────────────────
    this.state.activeRoll = null;

    // ── 4. Win condition check (domination check first) ────────────────────
    this.checkWinConditions();

    // ── 5. Phase transition ────────────────────────────────────────────────
    if (!this.state.isGameOver) {
      if (this.state.currentTurn === 'A') {
        this.state.currentTurn = 'B';
      } else {
        // Player B finished → Collapse Phase → Next Round
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;

        collapseReport.eliminated.forEach(pId => {
          if (!eliminatedThisTurn.includes(pId)) eliminatedThisTurn.push(pId);
        });

        this._awardCollapseDP(collapseReport.eliminated);
        this.checkWinConditions();

        if (!this.state.isGameOver) {
          this.state.currentTurn = 'A';
          this.state.round++;
          this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');

          this.checkTargetCompletion('A', { roundEnded: true, wasBumped: this.state.players.A.bumpedThisRound, dpEvents });
          this.checkTargetCompletion('B', { roundEnded: true, wasBumped: this.state.players.B.bumpedThisRound, dpEvents });
          
          this.state.players.A.bumpedThisRound = false;
          this.state.players.B.bumpedThisRound = false;

          this.generateTarget('A');
          this.generateTarget('B');
        }
      }
    }

    return {
      state: this.getState(),
      animationReport: {
        playerId,
        targetTileId,
        startPositions: { A: startPosA, B: startPosB },
        endPositions: { A: this.state.players.A.position, B: this.state.players.B.position },
        bump: bumpOccurred ? { opponentId, distance: bumpDistance, intoAbyss: bumpedIntoAbyss } : null,
        eliminated: eliminatedThisTurn,
        collapsedTiles: collapsedTilesThisTurn,
        dpEvents,
        type: 'move_phase'
      }
    };
  }

  // ─── Collapse Phase ─────────────────────────────────────────────────────────

  triggerCollapse() {
    const collapsedTiles = [];
    const eliminated = [];

    const activeTiles = [];
    for (let id = 1; id <= 61; id++) {
      if (!this.state.destroyedTiles[id]) activeTiles.push(id);
    }

    if (activeTiles.length > 0) {
      this.addLog('Collapse Phase: Collapsing active tiles...', 'collapse');

      const collapseCount = Math.min(2, activeTiles.length);
      const selectedTiles = [];
      const tempList = [...activeTiles];
      for (let i = 0; i < collapseCount; i++) {
        const idx = Math.floor(Math.random() * tempList.length);
        selectedTiles.push(tempList.splice(idx, 1)[0]);
      }

      selectedTiles.forEach(tileId => {
        this.state.destroyedTiles[tileId] = true;
        collapsedTiles.push(tileId);
        const ring = getRingNumber(tileId);
        this.addLog(`Tile ${tileId} (Ring ${ring}) collapsed and is destroyed forever!`, 'collapse');

        Object.keys(this.state.players).forEach(pId => {
          const p = this.state.players[pId];
          if (p.isAlive && p.position === tileId) {
            p.isAlive = false;
            eliminated.push(pId);
            this.addLog(`Player ${pId} was standing on collapsing Tile ${tileId} and fell into the Abyss!`, 'elimination');
          }
        });
      });
    }

    return { collapsedTiles, eliminated };
  }

  /**
   * Award DP to surviving player when collapse eliminates the opponent.
   * Called after collapse phase resolves.
   */
  _awardCollapseDP(eliminated) {
    if (eliminated.length === 0) return;
    const allPlayers = ['A', 'B'];
    eliminated.forEach(deadId => {
      const survivorId = allPlayers.find(id => id !== deadId);
      if (survivorId && this.state.players[survivorId]?.isAlive) {
        if (this.state.players[deadId].position === 61) {
          this.addDP(survivorId, 20, 'Opponent eliminated by collapse on Center Tile!');
        } else {
          this.addDP(survivorId, 15, 'Opponent eliminated by collapse!');
        }
      }
    });
  }

  // ─── Win Conditions ─────────────────────────────────────────────────────────

  checkWinConditions() {
    const pA = this.state.players.A;
    const pB = this.state.players.B;

    if (this.state.isGameOver) return;

    // ── Domination Win: first to 100 DP ──────────────────────────────────
    if (pA.dp >= 100 && pB.dp >= 100) {
      // Both hit 100+ simultaneously → highest wins; tie = draw
      if (pA.dp > pB.dp) {
        this._setWinner('A', 'domination');
      } else if (pB.dp > pA.dp) {
        this._setWinner('B', 'domination');
      } else {
        this._setDraw('domination');
      }
      return;
    }
    if (pA.dp >= 100) {
      this._setWinner('A', 'domination');
      return;
    }
    if (pB.dp >= 100) {
      this._setWinner('B', 'domination');
      return;
    }

    // ── Survival Win: last alive ──────────────────────────────────────────
    if (!pA.isAlive && !pB.isAlive) {
      this._setDraw('survival');
    } else if (!pA.isAlive) {
      this._setWinner('B', 'survival');
    } else if (!pB.isAlive) {
      this._setWinner('A', 'survival');
    }
  }

  _setWinner(winnerId, winType) {
    this.state.isGameOver = true;
    this.state.winner = winnerId;
    this.state.winType = winType;
    const typeLabel = winType === 'domination' ? 'DOMINATION WIN 🏆' : 'SURVIVAL WIN 💀';
    this.addLog(
      `Game Over! Player ${winnerId} wins by ${typeLabel}! (${this.state.players[winnerId].dp} DP)`,
      'win'
    );
  }

  _setDraw(winType) {
    this.state.isGameOver = true;
    this.state.winner = 'Draw';
    this.state.winType = winType;
    this.addLog('Game Over! It is a DRAW.', 'win');
  }
}
