// GameServer.js
// Authoritative Game Server Simulation for HexaDrop MVP v0.1.
// All gameplay calculations are performed here.

import { getRingTiles, getRingNumber } from './BoardGeometry';

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
      turnTimer: 10,      // 10 seconds per turn
      winner: null,       // 'A', 'B', 'Draw', or null
      isGameOver: false,
      combatLog: []       // { id, text, type, round, turn }
    };
    this.logCounter = 0;
    this.addLog('Game started! Both players on Tile 1.', 'system');
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

  // Ticks the timer down by 1 second.
  // Returns a state sync payload. If timer hits 0, auto-rolls for current turn.
  tickTimer() {
    if (this.state.isGameOver) return { state: this.getState() };

    this.state.turnTimer--;
    if (this.state.turnTimer <= 0) {
      this.addLog(`Timer expired! Server auto-rolling for Player ${this.state.currentTurn}.`, 'warning');
      return this.rollDice(this.state.currentTurn);
    }

    return { state: this.getState() };
  }

  // Authoritative Dice Roll
  rollDice(playerId, forcedRoll = null) {
    if (this.state.isGameOver) {
      return { state: this.getState(), error: 'Game is already over' };
    }

    if (playerId !== this.state.currentTurn) {
      return { state: this.getState(), error: 'Not your turn' };
    }

    const player = this.state.players[playerId];
    const opponentId = playerId === 'A' ? 'B' : 'A';
    const opponent = this.state.players[opponentId];

    // 1. Roll D8
    const roll = forcedRoll !== null ? forcedRoll : Math.floor(Math.random() * 8) + 1;
    let movement = roll; // For 1-6, move by roll
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

    // State changes to track for animation report
    const startPosA = this.state.players.A.position;
    const startPosB = this.state.players.B.position;
    
    let bumpOccurred = false;
    let bumpDistance = 0;
    let bumpedIntoAbyss = false;
    const eliminatedThisTurn = [];
    let collapsedTilesThisTurn = [];

    // 2. Compute New Position
    const origPosition = player.position;
    let newPosition = origPosition + movement;
    if (newPosition > 61) {
      newPosition = 61;
    }

    // Check if player landed on a destroyed tile (Abyss Rule)
    let playerEliminatedByAbyss = false;
    if (this.state.destroyedTiles[newPosition]) {
      player.isAlive = false;
      playerEliminatedByAbyss = true;
      eliminatedThisTurn.push(playerId);
      this.addLog(`Player ${playerId} landed on destroyed Tile ${newPosition} and fell into the Abyss!`, 'elimination');
    }

    player.position = newPosition;

    // 3. Compute Bump if they land on opponent and player is still alive
    if (player.isAlive && newPosition === opponent.position) {
      bumpOccurred = true;
      bumpDistance = isOverdrive ? 6 : 3;
      
      const opponentOrigPos = opponent.position;
      let opponentNewPos = opponentOrigPos - bumpDistance;
      if (opponentNewPos < 1) {
        opponentNewPos = 1;
      }

      this.addLog(`BUMP! Player ${playerId} landed on Player ${opponentId}. Opponent knocked back -${bumpDistance} tiles.`, 'bump');

      // Check if bumped opponent lands on a destroyed tile (Abyss Rule)
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

    // 4. Update Win Condition
    this.checkWinConditions();

    // 5. Phase Transition
    if (!this.state.isGameOver) {
      if (this.state.currentTurn === 'A') {
        // Switch to Player B
        this.state.currentTurn = 'B';
        this.state.turnTimer = 10;
      } else {
        // Player B finishes -> Round Ends -> Collapse Phase -> Next Round
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;
        
        // Add collapse eliminations
        collapseReport.eliminated.forEach(pId => {
          if (!eliminatedThisTurn.includes(pId)) {
            eliminatedThisTurn.push(pId);
          }
        });

        // Double check win conditions after collapse
        this.checkWinConditions();

        if (!this.state.isGameOver) {
          this.state.currentTurn = 'A';
          this.state.round++;
          this.state.turnTimer = 10;
          this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');
        }
      }
    }

    return {
      state: this.getState(),
      animationReport: {
        roll,
        isOverdrive,
        isLeap,
        playerId,
        startPositions: { A: startPosA, B: startPosB },
        endPositions: { A: this.state.players.A.position, B: this.state.players.B.position },
        bump: bumpOccurred ? {
          opponentId,
          distance: bumpDistance,
          intoAbyss: bumpedIntoAbyss
        } : null,
        playerEliminatedByAbyss,
        eliminated: eliminatedThisTurn,
        collapsedTiles: collapsedTilesThisTurn
      }
    };
  }

  // Authoritative Collapse Phase
  triggerCollapse() {
    const collapsedTiles = [];
    const eliminated = [];

    // Find active tiles in the outermost ring
    let activeTilesInRing = [];
    while (this.state.activeRing >= 0) {
      const ringTiles = getRingTiles(this.state.activeRing);
      activeTilesInRing = ringTiles.filter(tileId => !this.state.destroyedTiles[tileId]);
      
      if (activeTilesInRing.length > 0) {
        break; // Found the outermost active ring
      }
      this.state.activeRing--; // Move to next inner ring if current is fully destroyed
    }

    if (activeTilesInRing.length > 0) {
      this.addLog(`Collapse Phase: Collapsing active tiles in Ring ${this.state.activeRing}...`, 'collapse');
      
      // Determine how many tiles to collapse (up to 2)
      const collapseCount = Math.min(2, activeTilesInRing.length);
      
      // Randomly pick unique tiles
      const selectedTiles = [];
      const tempActiveList = [...activeTilesInRing];
      for (let i = 0; i < collapseCount; i++) {
        const randIndex = Math.floor(Math.random() * tempActiveList.length);
        const tileId = tempActiveList.splice(randIndex, 1)[0];
        selectedTiles.push(tileId);
      }

      // Mark selected tiles as destroyed
      selectedTiles.forEach(tileId => {
        this.state.destroyedTiles[tileId] = true;
        collapsedTiles.push(tileId);
        this.addLog(`Tile ${tileId} collapsed and is destroyed forever!`, 'collapse');
        
        // Check if players are standing on this tile
        Object.keys(this.state.players).forEach(pId => {
          const player = this.state.players[pId];
          if (player.isAlive && player.position === tileId) {
            player.isAlive = false;
            eliminated.push(pId);
            this.addLog(`Player ${pId} was standing on collapsing Tile ${tileId} and fell into the Abyss!`, 'elimination');
          }
        });
      });

      // Recalculate active tiles in this ring to see if we should decrement the active ring
      const remainingActive = activeTilesInRing.filter(tileId => !this.state.destroyedTiles[tileId]);
      if (remainingActive.length === 0) {
        this.addLog(`Ring ${this.state.activeRing} is now completely destroyed!`, 'collapse');
        this.state.activeRing--;
      }
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
