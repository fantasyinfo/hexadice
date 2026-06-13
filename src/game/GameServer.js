// GameServer.js
// Authoritative Game Server Simulation for HexaDrop MVP v0.1.
// Updated to support manual grid highlight and selection (no auto-movement).

import { getRingTiles, getRingNumber, getSpiralCoordinates } from './BoardGeometry';

// Precalculate tile coordinates for grid distance calculations
const TILE_COORDINATES = {};
getSpiralCoordinates().forEach(tile => {
  TILE_COORDINATES[tile.id] = { q: tile.q, r: tile.r };
});

function getGridDistance(id1, id2) {
  const t1 = TILE_COORDINATES[id1];
  const t2 = TILE_COORDINATES[id2];
  if (!t1 || !t2) return 999;
  return (Math.abs(t1.q - t2.q) + Math.abs(t1.r - t2.r) + Math.abs((t1.q + t1.r) - (t2.q + t2.r))) / 2;
}

export class GameServer {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      players: {
        A: { id: 'A', name: 'Player A', position: 1, isAlive: true },
        B: { id: 'B', name: 'Player B', position: 1, isAlive: true }
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
    this.addLog('Game started! Both players on Tile 1. Click Roll to start.', 'system');
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

      const dist = getGridDistance(currentPos, targetId);
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
      bumpDistance = this.state.activeRoll.isOverdrive ? 6 : 3;

      const opponentOrigPos = opponent.position;
      let opponentNewPos = opponentOrigPos - bumpDistance;
      if (opponentNewPos < 1) {
        opponentNewPos = 1;
      }

      this.addLog(`BUMP! Player ${playerId} landed on Player ${opponentId}. Opponent knocked back -${bumpDistance} tiles.`, 'bump');

      if (this.state.destroyedTiles[opponentNewPos]) {
        opponent.isAlive = false;
        opponent.position = opponentNewPos;
        bumpedIntoAbyss = true;
        eliminatedThisTurn.push(opponentId);
        this.addLog(`Player ${opponentId} was bumped onto destroyed Tile ${opponentNewPos} and fell into the Abyss!`, 'elimination');
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
