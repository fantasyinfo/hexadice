// GameInterface.jsx
// Updated to support side-by-side player HUDS, rules modal, collapsible logs,
// manual tile click selections, and timer removal.

import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import { GameServer } from '../game/GameServer';
import sounds from '../game/soundEffects';

export default function GameInterface() {
  const phaserContainerRef = useRef(null);
  const phaserGameRef = useRef(null);
  const serverRef = useRef(new GameServer());

  const [gameState, setGameState] = useState(serverRef.current.getState());
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWaitingForTileSelection, setIsWaitingForTileSelection] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  
  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.combatLog, logsExpanded]);

  // Init Phaser Game
  useEffect(() => {
    if (!phaserContainerRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: 760,
      height: 560,
      parent: phaserContainerRef.current,
      scene: [GameScene],
      backgroundColor: '#05070c',
      physics: {
        default: 'arcade',
        arcade: { debug: false }
      }
    };

    const game = new Phaser.Game(config);
    phaserGameRef.current = game;

    // Listen to Phaser event callbacks
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
      setGameState(serverRef.current.getState());
    });

    // Handle when a player clicks a highlighted tile in Phaser
    game.events.on('TILE_SELECTED', (tileId) => {
      const server = serverRef.current;
      const activePlayer = server.getState().currentTurn;
      
      const moveResult = server.selectTile(activePlayer, tileId);
      
      // Send move details to Phaser to run walk animations
      game.events.emit('MOVE_RESULT', moveResult);
      setIsAnimating(true);
      setIsWaitingForTileSelection(false);
      
      // Play bumping, abyss, collapse, and victory sounds
      handleReportSounds(moveResult.animationReport);
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  // Plays sounds corresponding to server logs
  const handleReportSounds = (report) => {
    if (report.bump) {
      setTimeout(() => sounds.playBump(), 300);
      if (report.bump.intoAbyss) {
        setTimeout(() => sounds.playElimination(), 600);
      }
    }
    if (report.playerEliminatedByAbyss) {
      setTimeout(() => sounds.playElimination(), 300);
    }
    if (report.collapsedTiles && report.collapsedTiles.length > 0) {
      const delay = report.bump ? 700 : 300;
      setTimeout(() => {
        sounds.playCollapse();
        if (report.eliminated && report.eliminated.length > 0) {
          sounds.playElimination();
        }
      }, delay);
    }
    if (serverRef.current.state.isGameOver) {
      const delay = report.bump ? 1100 : 700;
      setTimeout(() => sounds.playWin(), delay);
    }
  };

  const handleRoll = () => {
    if (isAnimating || isWaitingForTileSelection || gameState.isGameOver) return;
    
    sounds.init();

    const activePlayer = gameState.currentTurn;
    const result = serverRef.current.rollDice(activePlayer);
    
    if (result.error) return;

    sounds.playRoll();
    // Dispatch to Phaser to run roll animation
    phaserGameRef.current?.events.emit('ROLL_RESULT', result);
    setIsAnimating(true);

    // If it was a pass phase, play sounds immediately since walk was skipped
    if (result.animationReport.type === 'pass_phase') {
      handleReportSounds(result.animationReport);
    }
  };

  const handleRestart = () => {
    sounds.init();
    serverRef.current.reset();
    const newState = serverRef.current.getState();
    setGameState(newState);
    setIsAnimating(false);
    setIsWaitingForTileSelection(false);
    
    // Reset Phaser board coordinates
    phaserGameRef.current?.events.emit('SYNC_STATE', newState);
  };

  const toggleMute = () => {
    sounds.init();
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const isPlayerATurn = gameState.currentTurn === 'A' && !gameState.isGameOver;
  const isPlayerBTurn = gameState.currentTurn === 'B' && !gameState.isGameOver;

  return (
    <div className="game-screen-wrapper w-full flex flex-col items-center">
      
      {/* Header Panel */}
      <header className="w-full max-w-7xl px-6 py-4 flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl mb-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">HEXADROP</span>
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-400 tracking-wider">MVP v0.1</span>
        </div>
        
        {/* State Banner helper */}
        <div className="text-center">
          {gameState.isGameOver ? (
            <span className="text-sm font-black text-rose-500 tracking-widest animate-pulse">MATCH OVER</span>
          ) : isWaitingForTileSelection ? (
            <span className="text-xs font-mono text-cyan-400 tracking-wider animate-pulse">
              👉 Player {gameState.currentTurn} rolled {gameState.activeRoll?.roll}! Click highlighted tile to sit
            </span>
          ) : (
            <span className="text-xs font-mono text-slate-500 tracking-wider">
              🎮 Round {gameState.round} - {61 - Object.keys(gameState.destroyedTiles).length}/61 active tiles
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

      {/* Main Gameplay Screen (3-Column Layout) */}
      <div className="main-board-row flex flex-col lg:flex-row max-w-7xl w-full gap-6 items-stretch mb-4">
        
        {/* Left Side: Player A HUD Panel */}
        <div className={`player-card-panel left-panel w-full lg:w-72 bg-slate-900/40 border rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all duration-300 ${
          isPlayerATurn ? 'border-blue-500/80 bg-blue-950/5 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'border-slate-800/80'
        }`}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
              <span className={`text-xl font-black tracking-widest ${isPlayerATurn ? 'text-blue-glow' : 'text-slate-400'}`}>PLAYER A</span>
              <span className={`w-3.5 h-3.5 rounded-full ${gameState.players.A.isAlive ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-red-950 border border-red-800'}`}></span>
            </div>
            
            <div className="flex flex-col gap-3 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">POSITION</span>
                <span className="text-blue-400 font-bold">Tile {gameState.players.A.position}/61</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">STATUS</span>
                <span className={gameState.players.A.isAlive ? 'text-green-400 font-bold' : 'text-red-500 font-bold animate-pulse'}>
                  {gameState.players.A.isAlive ? 'ACTIVE' : 'FALLEN'}
                </span>
              </div>
            </div>

            {gameState.activeRoll && gameState.currentTurn === 'A' && (
              <div className="flex flex-col gap-1.5 p-3 bg-blue-950/40 border border-blue-800/50 rounded-lg text-center mt-2.5 animate-pulse font-mono">
                <span className="text-[10px] text-blue-400 tracking-widest font-bold">ROLLED</span>
                <span className="text-3xl font-black text-slate-100">🎲 {gameState.activeRoll.roll}</span>
                <span className="text-[9px] text-slate-400 font-sans mt-0.5">Move exactly {gameState.activeRoll.movement} tiles to any active tile in same or adjacent ring (in or out)</span>
              </div>
            )}
          </div>

          {/* Action Roll button on HUD side */}
          <div className="mt-8">
            {isPlayerATurn ? (
              <button
                disabled={isAnimating || isWaitingForTileSelection}
                onClick={handleRoll}
                className={`w-full py-4 text-sm font-bold tracking-widest rounded-lg border uppercase transition shadow-lg ${
                  isWaitingForTileSelection
                    ? 'bg-blue-950/20 border-cyan-800 text-cyan-400 cursor-not-allowed animate-pulse'
                    : isAnimating 
                      ? 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed' 
                      : 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500 text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.35)]'
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

        {/* Center Side: Phaser Canvas container */}
        <div className="phaser-canvas-panel flex-1 flex justify-center">
          <div 
            ref={phaserContainerRef} 
            className="border-2 border-slate-800/80 rounded-xl shadow-[0_0_35px_rgba(0,0,0,0.4)] bg-slate-950 overflow-hidden relative"
            style={{ width: '760px', height: '560px' }}
          >
            {/* Loading / Status Overlay inside Phaser */}
            {(isAnimating || isWaitingForTileSelection) && (
              <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-slate-950/80 border border-slate-800 backdrop-blur-md flex items-center gap-2.5 pointer-events-none shadow-lg">
                <span className={`w-2 h-2 rounded-full animate-ping ${isWaitingForTileSelection ? 'bg-cyan-400' : 'bg-blue-400'}`}></span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  {isWaitingForTileSelection ? 'SELECT TILE TO SIT' : 'ANIMATING STATE...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Player B HUD Panel */}
        <div className={`player-card-panel right-panel w-full lg:w-72 bg-slate-900/40 border rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all duration-300 ${
          isPlayerBTurn ? 'border-orange-500/80 bg-orange-950/5 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-slate-800/80'
        }`}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
              <span className={`text-xl font-black tracking-widest ${isPlayerBTurn ? 'text-orange-glow' : 'text-slate-400'}`}>PLAYER B</span>
              <span className={`w-3.5 h-3.5 rounded-full ${gameState.players.B.isAlive ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-red-950 border border-red-800'}`}></span>
            </div>
            
            <div className="flex flex-col gap-3 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">POSITION</span>
                <span className="text-orange-400 font-bold">Tile {gameState.players.B.position}/61</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">STATUS</span>
                <span className={gameState.players.B.isAlive ? 'text-green-400 font-bold' : 'text-red-500 font-bold animate-pulse'}>
                  {gameState.players.B.isAlive ? 'ACTIVE' : 'FALLEN'}
                </span>
              </div>
            </div>

            {gameState.activeRoll && gameState.currentTurn === 'B' && (
              <div className="flex flex-col gap-1.5 p-3 bg-orange-950/40 border border-orange-800/50 rounded-lg text-center mt-2.5 animate-pulse font-mono">
                <span className="text-[10px] text-orange-400 tracking-widest font-bold">ROLLED</span>
                <span className="text-3xl font-black text-slate-100">🎲 {gameState.activeRoll.roll}</span>
                <span className="text-[9px] text-slate-400 font-sans mt-0.5">Move exactly {gameState.activeRoll.movement} tiles to any active tile in same or adjacent ring (in or out)</span>
              </div>
            )}
          </div>

          {/* Action Roll button on HUD side */}
          <div className="mt-8">
            {isPlayerBTurn ? (
              <button
                disabled={isAnimating || isWaitingForTileSelection}
                onClick={handleRoll}
                className={`w-full py-4 text-sm font-bold tracking-widest rounded-lg border uppercase transition shadow-lg ${
                  isWaitingForTileSelection
                    ? 'bg-orange-950/20 border-cyan-800 text-cyan-400 cursor-not-allowed animate-pulse'
                    : isAnimating 
                      ? 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed' 
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

      </div>

      {/* Expandable Bottom Combat Log Feed */}
      <div className="expandable-logs-bar w-full max-w-7xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md rounded-xl overflow-hidden shadow-xl mb-6">
        <button 
          onClick={() => setLogsExpanded(!logsExpanded)}
          className="w-full px-5 py-3 flex justify-between items-center text-slate-400 hover:text-slate-200 transition font-semibold text-xs tracking-wider"
        >
          <span>📋 COMBAT FEED LOGS ({gameState.combatLog.length} events)</span>
          <span>{logsExpanded ? '▼ Collapse logs' : '▲ Expand logs'}</span>
        </button>

        {logsExpanded && (
          <div className="logs-panel border-t border-slate-800/60 p-5 bg-slate-950/60 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            <div className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
              {gameState.combatLog.map((log) => {
                let logColor = 'text-slate-400';
                if (log.type === 'roll') logColor = 'text-cyan-400';
                else if (log.type === 'bump') logColor = 'text-rose-400 font-bold';
                else if (log.type === 'collapse') logColor = 'text-amber-500';
                else if (log.type === 'elimination') logColor = 'text-red-500 font-semibold';
                else if (log.type === 'win') logColor = 'text-green-400 font-bold border-t border-b border-green-950/50 py-1 my-1';
                else if (log.type === 'warning') logColor = 'text-amber-400 italic';
                
                return (
                  <div key={log.id} className={`${logColor} flex gap-2 items-start`}>
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

      {/* Rules Modal Overlay */}
      {showRulesModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setShowRulesModal(false)}>
          <div className="modal-card bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fadeIn relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <span className="text-lg font-black tracking-widest text-slate-200">GAMEPLAY RULES</span>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-4 text-sm text-slate-300 leading-relaxed font-sans">
              <p>HexaDrop is a 2-player survival board game played on a collapsing concentric spiral. The winner is the last surviving player.</p>
              
              <div className="flex flex-col gap-2">
                <span className="font-bold text-cyan-400">🎲 Turn Flow & Rolling:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400">
                  <li>Roll a D8 on your turn.</li>
                  <li><b>Roll 1-6</b>: Move grid-wise exactly by rolled value.</li>
                  <li><b>Roll 7 (Leap)</b>: Move grid-wise exactly 7 tiles forward.</li>
                  <li><b>Roll 8 (Overdrive)</b>: Move grid-wise exactly 8 tiles forward.</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-cyan-400">♟️ Manual Grid Movement:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400">
                  <li>After rolling, valid target hexagons at the correct grid distance (in any direction, inward or outward) will highlight in cyan.</li>
                  <li><b>Ring Constraint</b>: You can only move to a tile in the <b>same ring</b> or an <b>adjacent ring</b> (one ring inward or outward). Jumps skipping rings are blocked to make the game tactical and longer.</li>
                  <li>You must click a highlighted tile to walk step-by-step and sit.</li>
                  <li>If no targets exist at that grid distance within the allowed rings, your turn automatically passes.</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-rose-400">💥 Bumps & Collapse:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400">
                  <li>Landing on the opponent bumps them back along the spiral path: -3 tiles (Normal) or -6 tiles (Overdrive).</li>
                  <li>At the end of each round (after B's turn), 2 random active tiles anywhere on the board collapse forever.</li>
                  <li>Landing or getting bumped onto collapsed tiles immediately eliminates you!</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-4 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-bold hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition text-xs tracking-widest uppercase"
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
