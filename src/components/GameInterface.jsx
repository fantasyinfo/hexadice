// GameInterface.jsx
// HexaDrop v0.2 — Phase 1: DP bars, Match Summary screen, Dual Win display.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import { GameServer } from '../game/GameServer';
import sounds from '../game/soundEffects';

// ── DP Progress Bar component ────────────────────────────────────────────────
function DPBar({ dp, color, flashing }) {
  const pct = Math.min(100, dp);
  const barColor = color === 'blue'
    ? 'bg-gradient-to-r from-blue-600 to-cyan-400'
    : 'bg-gradient-to-r from-orange-600 to-amber-400';
  const glowColor = color === 'blue'
    ? 'shadow-[0_0_8px_rgba(59,130,246,0.7)]'
    : 'shadow-[0_0_8px_rgba(249,115,22,0.7)]';

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-slate-500 tracking-widest">DOMINATION</span>
        <span className={`text-xs font-black font-mono ${flashing ? 'animate-pulse' : ''} ${color === 'blue' ? 'text-blue-300' : 'text-orange-300'}`}>
          {dp} <span className="text-slate-500 font-normal">/ 100 DP</span>
        </span>
      </div>
      <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor} ${dp >= 75 ? glowColor : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {dp >= 75 && dp < 100 && (
        <span className="text-[9px] text-amber-400 animate-pulse font-mono tracking-widest text-right">
          ⚡ {100 - dp} DP TO WIN!
        </span>
      )}
    </div>
  );
}

// ── Match Summary Modal ──────────────────────────────────────────────────────
function MatchSummary({ gameState, onPlayAgain }) {
  const { winner, winType, players } = gameState;

  const isDomination = winType === 'domination';
  const isDraw = winner === 'Draw';

  let title = 'DRAW!';
  let titleColor = 'text-slate-300';
  let bgGlow = 'from-slate-800 to-slate-900';
  let winIcon = '🤝';
  let winLabel = 'Both players eliminated';

  if (!isDraw) {
    if (winner === 'A') {
      title = 'PLAYER A WINS!';
      titleColor = 'text-blue-300';
      bgGlow = 'from-blue-950 to-slate-900';
      winIcon = isDomination ? '🏆' : '💀';
      winLabel = isDomination ? 'Domination Win — reached 100 DP!' : 'Survival Win — last alive!';
    } else {
      title = 'PLAYER B WINS!';
      titleColor = 'text-orange-300';
      bgGlow = 'from-orange-950 to-slate-900';
      winIcon = isDomination ? '🏆' : '💀';
      winLabel = isDomination ? 'Domination Win — reached 100 DP!' : 'Survival Win — last alive!';
    }
  }

  const handleCopy = () => {
    const winnerName = isDraw ? 'Draw' : `Player ${winner}`;
    const text = [
      `🎮 HexaDrop Match Result`,
      `${winIcon} ${winnerName} — ${winLabel}`,
      ``,
      `Player A: ${players.A.dp} DP | ${players.A.bumpsLanded} Bumps`,
      `Player B: ${players.B.dp} DP | ${players.B.bumpsLanded} Bumps`,
      `Rounds: ${gameState.round}`,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className={`relative w-full max-w-md bg-gradient-to-b ${bgGlow} border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden`}>

        {/* Top glow bar */}
        <div className={`h-1 w-full ${winner === 'A' ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : winner === 'B' ? 'bg-gradient-to-r from-orange-500 to-amber-400' : 'bg-slate-600'}`} />

        <div className="p-8 flex flex-col items-center gap-6">
          {/* Win icon + title */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl animate-bounce">{winIcon}</span>
            <span className={`text-2xl font-black tracking-widest ${titleColor}`}>{title}</span>
            <span className="text-xs font-mono text-slate-400 tracking-wider">{winLabel}</span>
          </div>

          {/* Stats cards */}
          <div className="w-full grid grid-cols-2 gap-3">
            {['A', 'B'].map(pid => {
              const p = players[pid];
              const isWinner = winner === pid;
              const color = pid === 'A' ? 'blue' : 'orange';
              const accentText = pid === 'A' ? 'text-blue-400' : 'text-orange-400';
              const accentBorder = pid === 'A' ? 'border-blue-800/60' : 'border-orange-800/60';
              const accentBg = pid === 'A' ? 'bg-blue-950/30' : 'bg-orange-950/30';

              return (
                <div key={pid} className={`flex flex-col gap-2 p-4 rounded-xl border ${accentBorder} ${accentBg} relative`}>
                  {isWinner && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black rounded-full tracking-wider">
                      WINNER
                    </span>
                  )}
                  <span className={`text-sm font-black ${accentText} tracking-widest`}>PLAYER {pid}</span>
                  <div className="flex flex-col gap-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Final DP</span>
                      <span className={`font-bold ${accentText}`}>{p.dp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bumps Hit</span>
                      <span className="text-slate-200 font-bold">{p.bumpsLanded}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bumps Taken</span>
                      <span className="text-slate-400">{p.bumpsReceived}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className={p.isAlive ? 'text-green-400' : 'text-red-500'}>
                        {p.isAlive ? 'Survived' : 'Fallen'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Round count */}
          <div className="w-full flex justify-center">
            <span className="text-xs font-mono text-slate-500">
              Match ended in <span className="text-slate-300 font-bold">{gameState.round} round{gameState.round !== 1 ? 's' : ''}</span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="w-full flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 py-3 text-xs font-bold tracking-widest rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition uppercase"
            >
              📋 Copy Result
            </button>
            <button
              onClick={onPlayAgain}
              className="flex-1 py-3 text-xs font-bold tracking-widest rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition uppercase"
            >
              🔄 Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GameInterface() {
  const phaserContainerRef = useRef(null);
  const phaserGameRef = useRef(null);
  const serverRef = useRef(new GameServer());

  const [gameState, setGameState] = useState(serverRef.current.getState());
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWaitingForTileSelection, setIsWaitingForTileSelection] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [lastPassInfo, setLastPassInfo] = useState(null);
  // Flash DP bar when it changes
  const [dpFlash, setDpFlash] = useState({ A: false, B: false });

  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.combatLog, logsExpanded]);

  // Flash DP bar for 600ms when DP changes
  const flashDP = useCallback((playerId) => {
    setDpFlash(prev => ({ ...prev, [playerId]: true }));
    setTimeout(() => setDpFlash(prev => ({ ...prev, [playerId]: false })), 600);
  }, []);

  // ── Phaser init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!phaserContainerRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: 760,
      height: 560,
      parent: phaserContainerRef.current,
      scene: [GameScene],
      backgroundColor: '#05070c',
      physics: { default: 'arcade', arcade: { debug: false } }
    };

    const game = new Phaser.Game(config);
    phaserGameRef.current = game;

    game.events.on('PHASER_READY', () => {
      game.events.emit('SYNC_STATE', serverRef.current.getState());
    });

    game.events.on('ANIMATION_START', () => {
      setIsAnimating(true);
    });

    game.events.on('ROLL_ANIMATION_COMPLETE', () => {
      setIsAnimating(false);
      setIsWaitingForTileSelection(true);
      setGameState(serverRef.current.getState());
    });

    game.events.on('ANIMATION_COMPLETE', () => {
      setIsAnimating(false);
      setIsWaitingForTileSelection(false);
      const newState = serverRef.current.getState();
      setGameState(prev => {
        // Flash DP if it changed
        if (prev.players.A.dp !== newState.players.A.dp) flashDP('A');
        if (prev.players.B.dp !== newState.players.B.dp) flashDP('B');
        return newState;
      });

      // Show match summary after animation completes
      if (newState.isGameOver) {
        setTimeout(() => setShowSummary(true), 800);
      }
    });

    game.events.on('TILE_SELECTED', (tileId) => {
      const server = serverRef.current;
      const activePlayer = server.getState().currentTurn;
      const moveResult = server.selectTile(activePlayer, tileId);
      game.events.emit('MOVE_RESULT', moveResult);
      setIsAnimating(true);
      setIsWaitingForTileSelection(false);
      handleReportSounds(moveResult.animationReport);
    });

    return () => { game.destroy(true); };
  }, [flashDP]);

  // ── Sound handling ─────────────────────────────────────────────────────────
  const handleReportSounds = (report) => {
    if (report.bump) {
      setTimeout(() => sounds.playBump(), 300);
      if (report.bump.intoAbyss) {
        setTimeout(() => sounds.playElimination(), 600);
      }
    }
    if (report.collapsedTiles?.length > 0) {
      const delay = report.bump ? 700 : 300;
      setTimeout(() => {
        sounds.playCollapse();
        if (report.eliminated?.length > 0) sounds.playElimination();
      }, delay);
    }
    if (serverRef.current.state.isGameOver) {
      const delay = report.bump ? 1100 : 700;
      setTimeout(() => sounds.playWin(), delay);
    }
  };

  // ── Roll handler ───────────────────────────────────────────────────────────
  const handleRoll = () => {
    if (isAnimating || isWaitingForTileSelection || gameState.isGameOver) return;
    sounds.init();

    const activePlayer = gameState.currentTurn;
    setLastPassInfo(null);
    const result = serverRef.current.rollDice(activePlayer);
    if (result.error) return;

    sounds.playRoll();
    phaserGameRef.current?.events.emit('ROLL_RESULT', result);
    setIsAnimating(true);

    if (result.animationReport.type === 'pass_phase') {
      const { roll, isOverdrive, isLeap, playerId } = result.animationReport;
      setLastPassInfo({
        playerId, roll,
        label: isOverdrive ? `Overdrive (${roll})` : isLeap ? `Leap (7)` : `${roll}`,
        movement: isOverdrive ? 8 : isLeap ? 7 : roll
      });
      handleReportSounds(result.animationReport);
      // Update state so DP reflects pass penalty
      setGameState(serverRef.current.getState());
    }
  };

  // ── Restart handler ────────────────────────────────────────────────────────
  const handleRestart = () => {
    sounds.init();
    setShowSummary(false);
    setLastPassInfo(null);
    serverRef.current.reset();
    const newState = serverRef.current.getState();
    setGameState(newState);
    setIsAnimating(false);
    setIsWaitingForTileSelection(false);
    phaserGameRef.current?.events.emit('SYNC_STATE', newState);
  };

  const toggleMute = () => {
    sounds.init();
    setIsMuted(sounds.toggleMute());
  };

  const isPlayerATurn = gameState.currentTurn === 'A' && !gameState.isGameOver;
  const isPlayerBTurn = gameState.currentTurn === 'B' && !gameState.isGameOver;

  // ── Player HUD card builder ────────────────────────────────────────────────
  const renderPlayerCard = (pid) => {
    const isA = pid === 'A';
    const player = gameState.players[pid];
    const isMyTurn = isA ? isPlayerATurn : isPlayerBTurn;
    const color = isA ? 'blue' : 'orange';
    const borderActive = isA
      ? 'border-blue-500/80 bg-blue-950/5 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
      : 'border-orange-500/80 bg-orange-950/5 shadow-[0_0_20px_rgba(249,115,22,0.15)]';
    const titleActive = isA ? 'text-blue-300' : 'text-orange-300';
    const posColor = isA ? 'text-blue-400' : 'text-orange-400';
    const liveDot = isA
      ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]'
      : 'bg-orange-500 shadow-[0_0_8px_#f97316]';
    const rollBg = isA
      ? 'bg-blue-950/40 border-blue-800/50'
      : 'bg-orange-950/40 border-orange-800/50';
    const rollLabel = isA ? 'text-blue-400' : 'text-orange-400';

    return (
      <div className={`player-card-panel w-full lg:w-72 bg-slate-900/40 border rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all duration-300 ${isMyTurn ? borderActive : 'border-slate-800/80'}`}>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
            <span className={`text-xl font-black tracking-widest ${isMyTurn ? titleActive : 'text-slate-400'}`}>
              PLAYER {pid}
            </span>
            <span className={`w-3.5 h-3.5 rounded-full ${player.isAlive ? liveDot : 'bg-red-950 border border-red-800'}`} />
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-2 font-mono">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">POSITION</span>
              <span className={`${posColor} font-bold`}>Tile {player.position}/61</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">STATUS</span>
              <span className={player.isAlive ? 'text-green-400 font-bold' : 'text-red-500 font-bold animate-pulse'}>
                {player.isAlive ? 'ACTIVE' : 'FALLEN'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">BUMPS</span>
              <span className="text-slate-300 font-bold">{player.bumpsLanded} 💥</span>
            </div>
          </div>

          {/* DP Progress Bar */}
          <DPBar dp={player.dp} color={color} flashing={dpFlash[pid]} />

          {/* Active roll card */}
          {gameState.activeRoll && gameState.currentTurn === pid && (
            <div className={`flex flex-col gap-1.5 p-3 ${rollBg} border rounded-lg text-center mt-1 animate-pulse font-mono`}>
              <span className={`text-[10px] ${rollLabel} tracking-widest font-bold`}>ROLLED</span>
              <span className="text-3xl font-black text-slate-100">🎲 {gameState.activeRoll.roll}</span>
              <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                Move exactly {gameState.activeRoll.movement} steps — same or adjacent ring
              </span>
            </div>
          )}

          {/* Pass info card */}
          {lastPassInfo && lastPassInfo.playerId === pid && !gameState.activeRoll && (
            <div className="flex flex-col gap-1.5 p-3 bg-amber-950/40 border border-amber-700/60 rounded-lg text-center mt-1 font-mono">
              <span className="text-[10px] text-amber-400 tracking-widest font-bold">⚠️ TURN PASSED</span>
              <span className="text-3xl font-black text-slate-100">🎲 {lastPassInfo.label}</span>
              <span className="text-[9px] text-amber-300/80 font-sans mt-0.5">
                No valid tile at {lastPassInfo.movement} step{lastPassInfo.movement !== 1 ? 's' : ''} in adjacent ring — -2 DP
              </span>
            </div>
          )}
        </div>

        {/* Roll / Wait button */}
        <div className="mt-5">
          {isMyTurn ? (
            <button
              disabled={isAnimating || isWaitingForTileSelection}
              onClick={handleRoll}
              id={`roll-btn-${pid}`}
              className={`w-full py-4 text-sm font-bold tracking-widest rounded-lg border uppercase transition shadow-lg ${
                isWaitingForTileSelection
                  ? `${isA ? 'bg-blue-950/20 border-cyan-800 text-cyan-400' : 'bg-orange-950/20 border-cyan-800 text-cyan-400'} cursor-not-allowed animate-pulse`
                  : isAnimating
                    ? 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed'
                    : isA
                      ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500 text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.35)]'
                      : 'bg-orange-600/10 hover:bg-orange-600/20 border-orange-500 text-orange-300 hover:shadow-[0_0_15px_rgba(249,115,22,0.35)]'
              }`}
            >
              {isWaitingForTileSelection ? 'Select Hex...' : isAnimating ? 'Rolling...' : 'ROLL D8'}
            </button>
          ) : (
            <div className="w-full py-4 text-center text-xs font-mono text-slate-600 border border-slate-900 rounded-lg select-none">
              Waiting for Turn
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="game-screen-wrapper w-full flex flex-col items-center">

      {/* Match Summary Modal */}
      {showSummary && (
        <MatchSummary gameState={gameState} onPlayAgain={handleRestart} />
      )}

      {/* Header */}
      <header className="w-full max-w-7xl px-6 py-4 flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl mb-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">HEXADROP</span>
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-400 tracking-wider">v0.2</span>
        </div>

        {/* Centre state banner */}
        <div className="text-center">
          {gameState.isGameOver ? (
            <button
              onClick={() => setShowSummary(true)}
              className="text-sm font-black text-amber-400 tracking-widest animate-pulse hover:text-amber-300 transition"
            >
              MATCH OVER — View Summary ▶
            </button>
          ) : isWaitingForTileSelection ? (
            <span className="text-xs font-mono text-cyan-400 tracking-wider animate-pulse">
              👉 Player {gameState.currentTurn} rolled {gameState.activeRoll?.roll}! Click highlighted tile to move
            </span>
          ) : (
            <span className="text-xs font-mono text-slate-500 tracking-wider">
              🎮 Round {gameState.round} · {61 - Object.keys(gameState.destroyedTiles).length}/61 active tiles · First to 100 DP wins
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowRulesModal(true)}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            📋 Rules
          </button>
          <button
            onClick={toggleMute}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {isMuted ? '🔇 Muted' : '🔊 Sound On'}
          </button>
          <button
            onClick={handleRestart}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-900/80 transition"
          >
            🔄 Restart
          </button>
        </div>
      </header>

      {/* Main board row */}
      <div className="main-board-row flex flex-col lg:flex-row max-w-7xl w-full gap-6 items-stretch mb-4">

        {/* Player A HUD */}
        {renderPlayerCard('A')}

        {/* Phaser Canvas */}
        <div className="phaser-canvas-panel flex-1 flex justify-center">
          <div
            ref={phaserContainerRef}
            className="border-2 border-slate-800/80 rounded-xl shadow-[0_0_35px_rgba(0,0,0,0.4)] bg-slate-950 overflow-hidden relative"
            style={{ width: '760px', height: '560px' }}
          >
            {(isAnimating || isWaitingForTileSelection) && (
              <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-slate-950/80 border border-slate-800 backdrop-blur-md flex items-center gap-2.5 pointer-events-none shadow-lg">
                <span className={`w-2 h-2 rounded-full animate-ping ${isWaitingForTileSelection ? 'bg-cyan-400' : 'bg-blue-400'}`} />
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  {isWaitingForTileSelection ? 'SELECT TILE TO SIT' : 'ANIMATING...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Player B HUD */}
        {renderPlayerCard('B')}
      </div>

      {/* Combat Log */}
      <div className="expandable-logs-bar w-full max-w-7xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md rounded-xl overflow-hidden shadow-xl mb-6">
        <button
          onClick={() => setLogsExpanded(!logsExpanded)}
          className="w-full px-5 py-3 flex justify-between items-center text-slate-400 hover:text-slate-200 transition font-semibold text-xs tracking-wider"
        >
          <span>📋 COMBAT FEED LOGS ({gameState.combatLog.length} events)</span>
          <span>{logsExpanded ? '▼ Collapse logs' : '▲ Expand logs'}</span>
        </button>

        {logsExpanded && (
          <div className="logs-panel border-t border-slate-800/60 p-5 bg-slate-950/60 max-h-48 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
              {gameState.combatLog.map(log => {
                let cls = 'text-slate-400';
                if (log.type === 'roll') cls = 'text-cyan-400';
                else if (log.type === 'bump') cls = 'text-rose-400 font-bold';
                else if (log.type === 'collapse') cls = 'text-amber-500';
                else if (log.type === 'elimination') cls = 'text-red-500 font-semibold';
                else if (log.type === 'win') cls = 'text-green-400 font-bold border-t border-b border-green-950/50 py-1 my-1';
                else if (log.type === 'warning') cls = 'text-amber-400 italic';
                else if (log.type === 'dp_gain') cls = 'text-emerald-400';
                else if (log.type === 'dp_loss') cls = 'text-rose-300 italic';
                return (
                  <div key={log.id} className={`${cls} flex gap-2 items-start`}>
                    <span className="text-slate-600 shrink-0 font-bold select-none">[R{log.round}]</span>
                    <span>{log.text}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setShowRulesModal(false)}>
          <div className="modal-card bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <span className="text-lg font-black tracking-widest text-slate-200">GAMEPLAY RULES</span>
              <button onClick={() => setShowRulesModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition font-bold">✕</button>
            </div>
            <div className="flex flex-col gap-4 text-sm text-slate-300 leading-relaxed font-sans">
              <p>HexaDrop is a 2-player tactical survival game. <strong>First to 100 Domination Points (DP) OR last alive wins.</strong></p>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-amber-400">⚔️ Domination Points (DP):</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400 text-xs">
                  <li>Move closer to center → <strong className="text-emerald-400">+1 DP</strong></li>
                  <li>Enter new inner ring → <strong className="text-emerald-400">+5 DP</strong></li>
                  <li>Bump opponent → <strong className="text-emerald-400">+10 DP</strong></li>
                  <li>Force opponent to outer ring → <strong className="text-emerald-400">+15 DP</strong></li>
                  <li>Eliminate opponent by bump → <strong className="text-emerald-400">+25 DP</strong></li>
                  <li>Opponent eliminated by collapse → <strong className="text-emerald-400">+15 DP</strong></li>
                  <li>Receive a bump → <strong className="text-rose-400">-3 DP</strong></li>
                  <li>Turn auto-passed → <strong className="text-rose-400">-2 DP</strong></li>
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-cyan-400">🎲 Turn Flow & Rolling:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400 text-xs">
                  <li>Roll D8. Move exactly that many BFS grid steps (destroyed tiles are obstacles).</li>
                  <li><b>Ring Constraint:</b> Only move to same ring or one ring inward/outward.</li>
                  <li><b>Roll 7 (Leap)</b> / <b>Roll 8 (Overdrive)</b>: Overdrive bumps -6 tiles.</li>
                  <li>No valid target → turn auto-passes (-2 DP).</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-rose-400">💥 Bumps & Collapse:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400 text-xs">
                  <li>Land on opponent → they slide back 3 tiles (6 on Overdrive). Slide stops at destroyed tile or board edge → elimination.</li>
                  <li>Every round: 2 random tiles collapse forever. Standing on one = eliminated.</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-800 pt-4 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-bold transition text-xs tracking-widest uppercase"
              >
                Close Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
