// GameServer.js
// Authoritative Game Server Simulation for HexaDrop MVP v0.1.
// Updated to support manual grid highlight and selection (no auto-movement).

import { getRingTiles, getRingNumber, getBfsDistance } from './BoardGeometry';

// NOTE: We intentionally use getBfsDistance (BFS through active tiles) instead of the old
// axial hex distance formula. Axial distance ignores destroyed tiles and can produce shorter
// "phantom" paths — e.g. roll 4 but target is 5 real steps away because 1 tile was destroyed.
// getBfsDistance respects destroyed tiles and always matches actual movement step count.

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
        A: { id: 'A', name: 'Player A', position: startA, isAlive: true },
        B: { id: 'B', name: 'Player B', position: startB, isAlive: true }
      },
      destroyedTiles: {}, // tileId (string) -> true
      activeRing: 4,      // Outermost ring with active tiles
      currentTurn: 'A',   // 'A' or 'B'
      round: 1,
      winner: null,       // 'A', 'B', 'Draw', or null
      isGameOver: false,
      activeRoll: null,   // { roll, isOverdrive, isLeap, movement, validTargets }
      combatLog: []       // { id, text, type, round, turn }
    };
    this.logCounter = 0;
    this.addLog(`Game started! Player A on Tile ${startA}, Player B on Tile ${startB}. Click Roll to start.`, 'system');
  }

  addLog(text, type = 'system') {
    this.state.combatLog.push({
      id: ++this.logCounter,
      text,
      type,
      round: this.state.round,
      turn: this.state.currentTurn
    });
  }

  // Get current game state
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  // Authoritative Dice Roll (Phase 1)
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
    const opponentId = playerId === 'A' ? 'B' : 'A';
    const opponent = this.state.players[opponentId];

    // 1. Roll D8
    const roll = forcedRoll !== null ? forcedRoll : Math.floor(Math.random() * 8) + 1;
    let movement = roll; 
    let isLeap = false;
    let isOverdrive = false;

    if (roll === 7) {
      movement = 7;
      isLeap = true;
    } else if (roll === 8) {
      movement = 8;
      isOverdrive = true;
    }

    this.addLog(`Player ${playerId} rolled a ${roll}! (${isOverdrive ? 'Overdrive!' : isLeap ? 'Leap!' : 'Move ' + movement})`, 'roll');

    // 2. Calculate valid target tiles (any direction, active, grid distance === movement, same/adjacent ring)
    const validTargets = [];
    const currentPos = player.position;
    const currentRing = getRingNumber(currentPos);

    for (let targetId = 1; targetId <= 61; targetId++) {
      if (targetId === currentPos) continue;
      if (this.state.destroyedTiles[targetId]) continue; // Skip destroyed tiles
      
      const targetRing = getRingNumber(targetId);
      if (Math.abs(targetRing - currentRing) > 1) continue; // Same ring or adjacent ring only

      // Use BFS distance through active tiles — this matches the actual steps a player
      // must walk, correctly treating destroyed tiles as impassable obstacles.
      const dist = getBfsDistance(currentPos, targetId, this.state.destroyedTiles);
      if (dist === movement) {
        validTargets.push(targetId);
      }
    }

    // 3. Handle case where no moves are valid
    if (validTargets.length === 0) {
      this.addLog(`No valid tiles at distance ${movement} in adjacent rings for Player ${playerId}! Turn passed.`, 'warning');
      
      // Auto-pass turn
      let collapsedTilesThisTurn = [];
      const eliminatedThisTurn = [];

      if (this.state.currentTurn === 'A') {
        this.state.currentTurn = 'B';
      } else {
        // Player B ends -> trigger collapse
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;
        collapseReport.eliminated.forEach(pId => eliminatedThisTurn.push(pId));

        this.checkWinConditions();

        if (!this.state.isGameOver) {
          this.state.currentTurn = 'A';
          this.state.round++;
          this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');
        }
      }

      return {
        state: this.getState(),
        animationReport: {
          roll,
          isOverdrive,
          isLeap,
          playerId,
          validTargets: [],
          type: 'pass_phase',
          collapsedTiles: collapsedTilesThisTurn,
          eliminated: eliminatedThisTurn
        }
      };
    }

    // 4. Save active roll state
    this.state.activeRoll = {
      roll,
      isOverdrive,
      isLeap,
      movement,
      validTargets
    };

    return {
      state: this.getState(),
      animationReport: {
        roll,
        isOverdrive,
        isLeap,
        playerId,
        validTargets,
        type: 'roll_phase'
      }
    };
  }

  // Authoritative Tile Selection & Movement Resolution (Phase 2)
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

    let bumpOccurred = false;
    let bumpDistance = 0;
    let bumpedIntoAbyss = false;
    const eliminatedThisTurn = [];
    let collapsedTilesThisTurn = [];

    // 1. Move player to target
    player.position = targetTileId;
    this.addLog(`Player ${playerId} moved to Tile ${targetTileId}.`, 'system');

    // 2. Perform bump if landing on opponent
    if (targetTileId === opponent.position) {
      bumpOccurred = true;
      const maxBumpDistance = this.state.activeRoll.isOverdrive ? 6 : 3;

      const opponentOrigPos = opponent.position;

      // Walk backward step by step — stop at the first destroyed or off-board tile.
      // This prevents B from "sliding through" a destroyed intermediate tile.
      let opponentNewPos = opponentOrigPos;
      let actualDistance = 0;
      let hitDestroyed = false;
      let fellOffBoard = false;

      for (let step = 1; step <= maxBumpDistance; step++) {
        const nextPos = opponentOrigPos - step;
        if (nextPos < 1) {
          // No tile exists — fell off the outer edge
          fellOffBoard = true;
          actualDistance = step; // traveled this many steps before falling
          break;
        }
        if (this.state.destroyedTiles[nextPos]) {
          // Hit a destroyed tile — stop here and fall in
          opponentNewPos = nextPos;
          hitDestroyed = true;
          actualDistance = step;
          break;
        }
        // Safe tile — advance
        opponentNewPos = nextPos;
        actualDistance = step;
      }

      bumpDistance = actualDistance; // used for animation text display

      this.addLog(`BUMP! Player ${playerId} landed on Player ${opponentId}. Opponent knocked back -${actualDistance} tile${actualDistance !== 1 ? 's' : ''}.`, 'bump');

      if (fellOffBoard) {
        opponent.isAlive = false;
        opponent.position = Math.max(1, opponentOrigPos - actualDistance + 1); // edge tile for animation
        bumpedIntoAbyss = true;
        eliminatedThisTurn.push(opponentId);
        this.addLog(`Player ${opponentId} was knocked off the outer ring and fell into the Abyss!`, 'elimination');
      } else if (hitDestroyed) {
        opponent.isAlive = false;
        opponent.position = opponentNewPos;
        bumpedIntoAbyss = true;
        eliminatedThisTurn.push(opponentId);
        this.addLog(`Player ${opponentId} slid into destroyed Tile ${opponentNewPos} and fell into the Abyss!`, 'elimination');
      } else {
        opponent.position = opponentNewPos;
      }
    }



    // 3. Clear active roll
    this.state.activeRoll = null;

    // 4. Update Win Condition
    this.checkWinConditions();

    // 5. Phase Transition
    if (!this.state.isGameOver) {
      if (this.state.currentTurn === 'A') {
        this.state.currentTurn = 'B';
      } else {
        // Player B finished -> Collapse Phase -> Next Round
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;

        collapseReport.eliminated.forEach(pId => {
          if (!eliminatedThisTurn.includes(pId)) {
            eliminatedThisTurn.push(pId);
          }
        });

        this.checkWinConditions();

        if (!this.state.isGameOver) {
          this.state.currentTurn = 'A';
          this.state.round++;
          this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');
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
        bump: bumpOccurred ? {
          opponentId,
          distance: bumpDistance,
          intoAbyss: bumpedIntoAbyss
        } : null,
        eliminated: eliminatedThisTurn,
        collapsedTiles: collapsedTilesThisTurn,
        type: 'move_phase'
      }
    };
  }

  // Authoritative Collapse Phase
  triggerCollapse() {
    const collapsedTiles = [];
    const eliminated = [];

    // Find all active tiles on the entire board
    const activeTiles = [];
    for (let id = 1; id <= 61; id++) {
      if (!this.state.destroyedTiles[id]) {
        activeTiles.push(id);
      }
    }

    if (activeTiles.length > 0) {
      this.addLog(`Collapse Phase: Collapsing active tiles...`, 'collapse');
      
      const collapseCount = Math.min(2, activeTiles.length);
      const selectedTiles = [];
      const tempActiveList = [...activeTiles];
      for (let i = 0; i < collapseCount; i++) {
        const randIndex = Math.floor(Math.random() * tempActiveList.length);
        const tileId = tempActiveList.splice(randIndex, 1)[0];
        selectedTiles.push(tileId);
      }

      selectedTiles.forEach(tileId => {
        this.state.destroyedTiles[tileId] = true;
        collapsedTiles.push(tileId);
        const ring = getRingNumber(tileId);
        this.addLog(`Tile ${tileId} (Ring ${ring}) collapsed and is destroyed forever!`, 'collapse');
        
        Object.keys(this.state.players).forEach(pId => {
          const player = this.state.players[pId];
          if (player.isAlive && player.position === tileId) {
            player.isAlive = false;
            eliminated.push(pId);
            this.addLog(`Player ${pId} was standing on collapsing Tile ${tileId} and fell into the Abyss!`, 'elimination');
          }
        });
      });
    }

    return {
      collapsedTiles,
      eliminated
    };
  }

  // Checks win conditions based on player life statuses
  checkWinConditions() {
    const pA = this.state.players.A;
    const pB = this.state.players.B;

    if (!pA.isAlive && !pB.isAlive) {
      this.state.isGameOver = true;
      this.state.winner = 'Draw';
      this.addLog('Game Over! It is a DRAW. Both players have fallen into the Abyss!', 'win');
    } else if (!pA.isAlive) {
      this.state.isGameOver = true;
      this.state.winner = 'B';
      this.addLog('Game Over! Player B is the Winner! Last player alive.', 'win');
    } else if (!pB.isAlive) {
      this.state.isGameOver = true;
      this.state.winner = 'A';
      this.addLog('Game Over! Player A is the Winner! Last player alive.', 'win');
    }
  }
}
