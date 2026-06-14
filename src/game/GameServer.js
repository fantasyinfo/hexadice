import { getRingTiles, getRingNumber, getBfsDistance } from './BoardGeometry';

export class GameServer {
  constructor() {
    this.rules = {
      enableHuntTargets: true,
      enableBumping: true,
      enableBoardCollapse: true,
      enableCombos: true
    };
    this.reset();
  }

  setRules(newRules) {
    this.rules = { ...this.rules, ...newRules };
  }

  reset() {
    const startA = [101, 101, 101, 101];
    const startB = [102, 102, 102, 102];

    const createPawns = (playerId, starts) => starts.map((pos, i) => ({
      id: `${playerId}${i + 1}`,
      position: pos,
      spawnPos: pos,
      isAlive: true,
      isHome: false,
      previousRing: 4
    }));

    this.state = {
      players: {
        A: {
          id: 'A', name: 'Player A', isAlive: true,
          dp: 0, bumpsLanded: 0, bumpsReceived: 0,
          huntTarget: null, huntTargetsHit: 0, bumpedThisRound: false,
          combo: { name: null, count: 0, actionHistory: [] },
          pawns: createPawns('A', startA)
        },
        B: {
          id: 'B', name: 'Player B', isAlive: true,
          dp: 0, bumpsLanded: 0, bumpsReceived: 0,
          huntTarget: null, huntTargetsHit: 0, bumpedThisRound: false,
          combo: { name: null, count: 0, actionHistory: [] },
          pawns: createPawns('B', startB)
        }
      },
      destroyedTiles: {},
      warnedTiles: [],
      activeRing: 4,
      currentTurn: 'A',
      round: 1,
      winner: null,
      winType: null,
      isGameOver: false,
      activeRoll: null,
      combatLog: []
    };
    this.logCounter = 0;
    this.addLog(`Game started! Hexa-Ludo Squad Mode. Get all 4 pawns to The Core (Tile 61)!`, 'system');
    this.generateTarget('A');
    this.generateTarget('B');
  }

  setConfig(playersConfig) {
    if (playersConfig.A && playersConfig.A.name) this.state.players.A.name = playersConfig.A.name;
    if (playersConfig.B && playersConfig.B.name) this.state.players.B.name = playersConfig.B.name;
  }

  updateCombo(playerId, action) {
    if (!this.rules.enableCombos) return null;
    const player = this.state.players[playerId];
    if (!player || !player.isAlive) return null;

    if (action === 'break') {
      player.combo.actionHistory = [];
      player.combo.name = null;
      player.combo.count = 0;
      return null;
    }

    player.combo.actionHistory.push(action);
    if (player.combo.actionHistory.length > 5) player.combo.actionHistory.shift();

    const hist = player.combo.actionHistory;
    let comboAwarded = null;

    if (hist.length >= 2 && hist.slice(-2).every(a => a === 'bump' || a === 'overdrive')) comboAwarded = { name: 'RAMPAGE', dp: 15 };
    else if (hist.length >= 3 && hist.slice(-3).every(a => a === 'move_inward')) comboAwarded = { name: 'ASCEND', dp: 10 };
    else if (hist.filter(a => a === 'overdrive').length >= 2) comboAwarded = { name: 'BERSERK', dp: 20 };
    else if (hist.length >= 3 && hist.slice(-3).every(a => a === 'survived_no_bump')) comboAwarded = { name: 'IRONWALL', dp: 10 };
    else if (hist.length >= 3 && hist.slice(-3).every(a => a === 'hunt_target')) comboAwarded = { name: 'PRECISION', dp: 25 };

    if (comboAwarded) {
      player.combo.name = comboAwarded.name;
      player.combo.count++;
      this.addDP(playerId, comboAwarded.dp, `${comboAwarded.name} Combo!`);
      player.combo.actionHistory = [];
      return comboAwarded;
    }
    return null;
  }

  addLog(text, type = 'system') {
    this.state.combatLog.push({ id: ++this.logCounter, text, type, round: this.state.round, turn: this.state.currentTurn });
  }

  generateTarget(playerId) {
    if (!this.rules.enableHuntTargets) return;
    const player = this.state.players[playerId];
    if (!player || !player.isAlive) return;

    const activePawns = player.pawns.filter(p => p.isAlive && !p.isHome);
    if (activePawns.length === 0) return;
    const refPawn = activePawns[Math.floor(Math.random() * activePawns.length)];
    const currentRing = getRingNumber(refPawn.position);

    const activeTiles = [];
    for (let id = 1; id <= 61; id++) {
      if (!this.state.destroyedTiles[id]) activeTiles.push(id);
    }

    const possibleTargets = [];
    let targetRing = null;
    if (currentRing === 4) targetRing = [2, 3][Math.floor(Math.random() * 2)];
    else if (currentRing === 3) targetRing = [1, 2][Math.floor(Math.random() * 2)];
    else if (currentRing === 2) targetRing = [1, 3][Math.floor(Math.random() * 2)];
    else if (currentRing === 1) targetRing = [2, 3][Math.floor(Math.random() * 2)];

    if (targetRing !== null) {
      const ringTiles = getRingTiles(targetRing);
      if (ringTiles.some(t => !this.state.destroyedTiles[t])) {
        possibleTargets.push({ type: 'reach_ring', label: `Reach Ring ${targetRing}`, param: targetRing, dpReward: 15 });
      }
    }

    if (activeTiles.length > 0) {
      let targetTile = activeTiles[Math.floor(Math.random() * activeTiles.length)];
      possibleTargets.push({ type: 'land_tile', label: `Land on Tile ${targetTile}`, param: targetTile, dpReward: 10 });
    }

    possibleTargets.push({ type: 'land_bump', label: 'Land a Bump this round', param: null, dpReward: 20 });
    possibleTargets.push({ type: 'survive_no_bump', label: 'Survive without being bumped', param: null, dpReward: 8 });

    const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    target.achieved = false;
    player.huntTarget = target;
  }

  checkTargetCompletion(playerId, actionContext) {
    if (!this.rules.enableHuntTargets) return;
    const player = this.state.players[playerId];
    if (!player || !player.isAlive || !player.huntTarget || player.huntTarget.achieved) return;

    const target = player.huntTarget;
    let achieved = false;

    if (target.type === 'reach_ring' && actionContext && actionContext.pawn) {
      if (getRingNumber(actionContext.pawn.position) === target.param) achieved = true;
    } else if (target.type === 'land_tile' && actionContext && actionContext.pawn) {
      if (actionContext.pawn.position === target.param) achieved = true;
    } else if (target.type === 'land_bump' && actionContext && actionContext.bumpedOpponent) {
      achieved = true;
    } else if (target.type === 'survive_no_bump') {
      if (actionContext && actionContext.roundEnded && !actionContext.wasBumped) achieved = true;
    }

    if (achieved) {
      target.achieved = true;
      player.huntTargetsHit++;
      this.addDP(playerId, target.dpReward, `Hunt Target Completed: ${target.label}`);
      if (actionContext && actionContext.dpEvents) {
         actionContext.dpEvents.push({ playerId, amount: target.dpReward, label: `🎯 TARGET HIT! +${target.dpReward} DP`, isTarget: true });
      }
      this.updateCombo(playerId, target.type === 'survive_no_bump' ? 'survived_no_bump' : 'hunt_target');
    }
  }

  addDP(playerId, amount, reason) {
    const player = this.state.players[playerId];
    if (!player) return;
    const before = player.dp;
    player.dp = Math.max(0, player.dp + amount);
    const actual = player.dp - before;
    if (actual === 0) return;
    const sign = actual > 0 ? '+' : '';
    this.addLog(`[DP] Player ${playerId}: ${sign}${actual} — ${reason} (DP: ${before} → ${player.dp})`, actual > 0 ? 'dp_gain' : 'dp_loss');
  }

  checkRingProgress(playerId, pawn) {
    const newRing = getRingNumber(pawn.position);
    const oldRing = pawn.previousRing;

    if (newRing < oldRing) {
      this.addDP(playerId, 1, 'Pawn moved closer to center');
      if (newRing < oldRing) {
        this.addDP(playerId, 5, `Pawn entered Ring ${newRing}!`);
      }
      const combo = this.updateCombo(playerId, 'move_inward');
      if (combo) this.state.players[playerId].latestCombo = combo;
    }
    pawn.previousRing = newRing;
  }

  getState() {
    const stateCopy = JSON.parse(JSON.stringify(this.state));
    stateCopy.rules = this.rules;
    return stateCopy;
  }

  rollDice(playerId, forcedRoll = null) {
    if (this.state.isGameOver) return { state: this.getState(), error: 'Game is already over' };
    if (playerId !== this.state.currentTurn) return { state: this.getState(), error: 'Not your turn' };
    if (this.state.activeRoll) return { state: this.getState(), error: 'Already rolled.' };

    const player = this.state.players[playerId];
    const roll = forcedRoll !== null ? forcedRoll : Math.floor(Math.random() * 6) + 1;
    let movement = roll;
    const isOverdrive = roll === 6;
    const isLeap = roll === 5;

    this.addLog(`Player ${playerId} rolled a ${roll}! (${isOverdrive ? 'Overdrive!' : isLeap ? 'Leap!' : 'Move ' + movement})`, 'roll');

    const validTargets = {};
    let totalValidMoves = 0;

    player.pawns.forEach(pawn => {
      if (!pawn.isAlive || pawn.isHome) return;
      const targets = [];
      const currentPos = pawn.position;
      const currentRing = getRingNumber(currentPos);

      for (let targetId = 1; targetId <= 61; targetId++) {
        if (targetId === currentPos || this.state.destroyedTiles[targetId]) continue;
        const targetRing = getRingNumber(targetId);
        if (Math.abs(targetRing - currentRing) > 1) continue;
        
        // Prevent backward movement
        if (targetRing > currentRing) continue; // Cannot move outward
        if (targetRing === currentRing) {
           const size = currentRing === 4 ? 24 : currentRing === 3 ? 18 : currentRing === 2 ? 12 : currentRing === 1 ? 6 : 1;
           const forwardDist = (targetId - currentPos + size) % size;
           const backwardDist = (currentPos - targetId + size) % size;
           if (backwardDist < forwardDist) continue;
        }

        const dist = getBfsDistance(currentPos, targetId, this.state.destroyedTiles);
        if (dist === movement) targets.push(targetId);
      }
      if (targets.length > 0) {
        validTargets[pawn.id] = targets;
        totalValidMoves += targets.length;
      }
    });

    if (totalValidMoves === 0) {
      this.addLog(`No valid moves for any pawns for Player ${playerId}! Turn passed.`, 'warning');
      this.addDP(playerId, -2, 'Turn auto-passed');
      this.updateCombo(playerId, 'break');
      this.state.activeRoll = null;
      let collapsedTilesThisTurn = [];
      let eliminatedThisTurn = [];
      let dpEventsForPass = [];

      if (this.state.currentTurn === 'A') {
        this.state.currentTurn = 'B';
      } else {
        const collapseReport = this.triggerCollapse();
        collapsedTilesThisTurn = collapseReport.collapsedTiles;
        eliminatedThisTurn = collapseReport.eliminated;
        this._awardCollapseDP(eliminatedThisTurn);
        this.checkWinConditions();
        if (!this.state.isGameOver) this._advanceRound();
      }

      return {
        state: this.getState(),
        animationReport: {
          roll, isOverdrive, isLeap, playerId,
          validTargets: {}, type: 'pass_phase',
          collapsedTiles: collapsedTilesThisTurn, eliminated: eliminatedThisTurn, dpEvents: dpEventsForPass
        }
      };
    }

    this.state.activeRoll = { roll, isOverdrive, isLeap, movement, validTargets };
    return {
      state: this.getState(),
      animationReport: { roll, isOverdrive, isLeap, playerId, validTargets, type: 'roll_phase' }
    };
  }

  selectTile(playerId, pawnId, targetTileId) {
    if (this.state.isGameOver) return { state: this.getState(), error: 'Game over' };
    if (playerId !== this.state.currentTurn) return { state: this.getState(), error: 'Not your turn' };
    if (!this.state.activeRoll) return { state: this.getState(), error: 'Must roll' };
    
    const validTargets = this.state.activeRoll.validTargets[pawnId];
    if (!validTargets || !validTargets.includes(targetTileId)) {
      return { state: this.getState(), error: 'Invalid target tile selection' };
    }

    const player = this.state.players[playerId];
    const pawn = player.pawns.find(p => p.id === pawnId);
    
    const opponentId = playerId === 'A' ? 'B' : 'A';
    const opponent = this.state.players[opponentId];

    const dpEvents = [];
    const triggeredCombos = [];
    let bumpOccurred = false;
    let bumpedIntoAbyss = false;
    let bumpedPawnId = null;
    const eliminatedThisTurn = [];
    let collapsedTilesThisTurn = [];

    pawn.position = targetTileId;
    this.addLog(`Player ${playerId} moved Pawn ${pawnId} to Tile ${targetTileId}.`, 'system');

    const dpBefore = player.dp;
    this.checkRingProgress(playerId, pawn);
    const dpAfter = player.dp;
    if (dpAfter > dpBefore) dpEvents.push({ playerId, amount: dpAfter - dpBefore, label: `+${dpAfter - dpBefore} DP` });

    if (targetTileId === 61) {
      pawn.isHome = true;
      pawn.position = 61;
      this.addLog(`Pawn ${pawnId} reached the Core and Ascended!`, 'win');
      this.addDP(playerId, 25, 'Pawn ascended to The Core!');
      dpEvents.push({ playerId, amount: 25, label: `+25 DP ASCEND!` });
    } else {
      let bumpedPawn = null;
      opponent.pawns.forEach(op => {
        if (op.isAlive && !op.isHome && op.position === targetTileId) bumpedPawn = op;
      });

      if (bumpedPawn && this.rules.enableBumping) {
        bumpOccurred = true;
        bumpedPawnId = bumpedPawn.id;
        
        const spawnPos = bumpedPawn.spawnPos;
        bumpedPawn.position = spawnPos;
        
        this.addLog(`BUMP! Pawn ${pawnId} landed on Opponent Pawn ${bumpedPawnId}. Opponent sent back to spawn!`, 'bump');
        player.bumpsLanded++;
        opponent.bumpsReceived++;
        opponent.bumpedThisRound = true;

        this.addDP(playerId, 15, 'Bump landed (sent to spawn)!');
        dpEvents.push({ playerId, amount: 15, label: '+15 DP BUMP!' });

        const comboAction = this.state.activeRoll.isOverdrive ? 'overdrive' : 'bump';
        const combo = this.updateCombo(playerId, comboAction);
        if (combo) triggeredCombos.push({ playerId, ...combo });

        this.updateCombo(opponentId, 'break');
        this.addDP(opponentId, -5, 'Pawn bumped back to spawn');
        dpEvents.push({ playerId: opponentId, amount: -5, label: '-5 DP' });

        if (this.state.destroyedTiles[spawnPos]) {
          bumpedPawn.isAlive = false;
          bumpedIntoAbyss = true;
          eliminatedThisTurn.push(bumpedPawn.id);
          this.addLog(`Pawn ${bumpedPawnId} was sent back to spawn Tile ${spawnPos}, but it was destroyed! Pawn eliminated!`, 'elimination');
          this.addDP(playerId, 25, 'Opponent pawn eliminated by bump into abyss!');
          dpEvents.push({ playerId, amount: 25, label: '+25 DP KILL!' });
        }
      }
    }

    this.checkTargetCompletion(playerId, { bumpedOpponent: bumpOccurred, pawn, dpEvents, triggeredCombos });

    if (player.latestCombo) {
      triggeredCombos.push({ playerId, ...player.latestCombo });
      player.latestCombo = null;
    }

    this.state.activeRoll = null;
    this.checkWinConditions();

    if (!this.state.isGameOver) {
      if (bumpOccurred) {
        this.addLog(`Player ${playerId} gets an EXTRA TURN for landing a bump!`, 'system');
      } else {
        if (this.state.currentTurn === 'A') {
          this.state.currentTurn = 'B';
        } else {
          const collapseReport = this.triggerCollapse();
          collapsedTilesThisTurn = collapseReport.collapsedTiles;
          collapseReport.eliminated.forEach(pId => eliminatedThisTurn.push(pId));
          this._awardCollapseDP(collapseReport.eliminated);
          this.checkWinConditions();
          if (!this.state.isGameOver) this._advanceRound();
        }
      }
    }

    const endPositions = { A: {}, B: {} };
    this.state.players.A.pawns.forEach(p => { if (p.isAlive && !p.isHome) endPositions.A[p.id] = p.position; });
    this.state.players.B.pawns.forEach(p => { if (p.isAlive && !p.isHome) endPositions.B[p.id] = p.position; });

    return {
      state: this.getState(),
      animationReport: {
        playerId, pawnId, targetTileId, endPositions,
        bump: bumpOccurred ? { opponentPawnId: bumpedPawnId, intoAbyss: bumpedIntoAbyss } : null,
        ascended: targetTileId === 61, eliminated: eliminatedThisTurn, collapsedTiles: collapsedTilesThisTurn,
        dpEvents, combos: triggeredCombos, type: 'move_phase'
      }
    };
  }

  _advanceRound() {
    this.state.currentTurn = 'A';
    this.state.round++;
    this.addLog(`--- Round ${this.state.round} Starts ---`, 'system');
    this.checkTargetCompletion('A', { roundEnded: true, wasBumped: this.state.players.A.bumpedThisRound });
    this.checkTargetCompletion('B', { roundEnded: true, wasBumped: this.state.players.B.bumpedThisRound });
    this.state.players.A.bumpedThisRound = false;
    this.state.players.B.bumpedThisRound = false;
    this.generateTarget('A');
    this.generateTarget('B');
  }

  triggerCollapse() {
    if (!this.rules.enableBoardCollapse) return { collapsedTiles: [], eliminated: [] };
    const collapsedTiles = [];
    const eliminated = [];

    if (this.state.warnedTiles.length > 0) {
      this.state.warnedTiles.forEach(tileId => {
        this.state.destroyedTiles[tileId] = true;
        collapsedTiles.push(tileId);
        this.addLog(`Tile ${tileId} collapsed and is destroyed forever!`, 'collapse');

        Object.keys(this.state.players).forEach(pId => {
          this.state.players[pId].pawns.forEach(pawn => {
            if (pawn.isAlive && !pawn.isHome && pawn.position === tileId) {
              pawn.isAlive = false;
              eliminated.push(pawn.id);
              this.addLog(`Pawn ${pawn.id} was standing on collapsing Tile ${tileId} and fell into the Abyss!`, 'elimination');
            }
          });
        });
      });
      this.state.warnedTiles = [];
    }

    const activeTiles = [];
    for (let i = 1; i <= 60; i++) {
      if (!this.state.destroyedTiles[i]) activeTiles.push(i);
    }

    if (activeTiles.length > 0) {
      const collapseCount = Math.min(2, activeTiles.length);
      const tempList = [...activeTiles];
      for (let i = 0; i < collapseCount; i++) {
        const idx = Math.floor(Math.random() * tempList.length);
        this.state.warnedTiles.push(tempList.splice(idx, 1)[0]);
      }
      this.addLog(`⚠️ WARNING: Tiles ${this.state.warnedTiles.join(' and ')} are unstable and will collapse next round!`, 'warning');
    }

    return { collapsedTiles, eliminated };
  }

  _awardCollapseDP(eliminated) {
    if (eliminated.length === 0) return;
    const allPlayers = ['A', 'B'];
    eliminated.forEach(deadId => {
      const survivorId = allPlayers.find(id => id !== deadId);
      if (survivorId && this.state.players[survivorId]?.isAlive) {
        this.addDP(survivorId, 15, 'Opponent pawn eliminated by collapse!');
      }
    });
  }

  checkWinConditions() {
    if (this.state.isGameOver) return;
    const pA = this.state.players.A;
    const pB = this.state.players.B;

    pA.isAlive = pA.pawns.some(p => p.isAlive);
    pB.isAlive = pB.pawns.some(p => p.isAlive);

    const aHome = pA.pawns.filter(p => p.isHome).length;
    const aDead = pA.pawns.filter(p => !p.isAlive).length;
    const bHome = pB.pawns.filter(p => p.isHome).length;
    const bDead = pB.pawns.filter(p => !p.isAlive).length;

    const aWinsAscension = aHome === 4;
    const bWinsAscension = bHome === 4;

    if (aWinsAscension && bWinsAscension) return this._setDraw('ascension');
    if (aWinsAscension) return this._setWinner('A', 'ascension');
    if (bWinsAscension) return this._setWinner('B', 'ascension');

    if (!pA.isAlive && !pB.isAlive) return this._setDraw('survival');
    if (!pA.isAlive) return this._setWinner('B', 'survival');
    if (!pB.isAlive) return this._setWinner('A', 'survival');
  }

  _setWinner(winnerId, winType) {
    this.state.isGameOver = true;
    this.state.winner = winnerId;
    this.state.winType = winType;
    const typeLabel = winType === 'ascension' ? 'ASCENSION WIN 👑' : 'SURVIVAL WIN 💀';
    this.addLog(`Game Over! Player ${winnerId} wins by ${typeLabel}!`, 'win');
  }

  _setDraw(winType) {
    this.state.isGameOver = true;
    this.state.winner = 'Draw';
    this.state.winType = winType;
    this.addLog('Game Over! It is a DRAW.', 'win');
  }
}
