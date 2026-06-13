// GameInterface.jsx
// Controls the HUD overlay, sound controls, logging, and initializes Phaser.

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
  const [isMuted, setIsMuted] = useState(false);
  const [showRules, setShowRules] = useState(true);
  
  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.combatLog]);

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

    game.events.on('ANIMATION_COMPLETE', () => {
      setIsAnimating(false);
      // Sync React state with Server state on animation complete
      setGameState(serverRef.current.getState());
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  // Server Authoritative Tick Timer Effect
  useEffect(() => {
    if (gameState.isGameOver || isAnimating) return;

    const timer = setInterval(() => {
      const server = serverRef.current;
      const tickResult = server.tickTimer();
      
      // If timer hit 0, an auto-roll occurs
      if (tickResult.animationReport) {
        sounds.playRoll();
        // Trigger animations in Phaser
        phaserGameRef.current?.events.emit('ROLL_RESULT', tickResult);
        setIsAnimating(true);
        // Play appropriate sounds based on report
        handleReportSounds(tickResult.animationReport);
      } else {
        // Just sync timer
        setGameState(tickResult.state);
        // Play tick sound if timer is low (e.g. <= 3 seconds)
        if (tickResult.state.turnTimer <= 3 && tickResult.state.turnTimer > 0) {
          sounds.playTick();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.isGameOver, isAnimating, gameState.currentTurn]);

  // Plays sounds corresponding to what occurred on the server
  const handleReportSounds = (report) => {
    if (report.bump) {
      setTimeout(() => sounds.playBump(), report.roll * 180 + 100);
      if (report.bump.intoAbyss) {
        setTimeout(() => sounds.playElimination(), report.roll * 180 + 400);
      }
    }
    if (report.playerEliminatedByAbyss) {
      setTimeout(() => sounds.playElimination(), report.roll * 180 + 100);
    }
    if (report.collapsedTiles.length > 0) {
      const delay = (report.roll * 180) + (report.bump ? 500 : 200);
      setTimeout(() => {
        sounds.playCollapse();
        if (report.eliminated.length > 0) {
          sounds.playElimination();
        }
      }, delay);
    }
    if (serverRef.current.state.isGameOver) {
      const delay = (report.roll * 180) + (report.bump ? 800 : 400);
      setTimeout(() => sounds.playWin(), delay);
    }
  };

  const handleRoll = () => {
    if (isAnimating || gameState.isGameOver) return;
    
    // Unlock Audio Context on first user click
    sounds.init();

    const activePlayer = gameState.currentTurn;
    const result = serverRef.current.rollDice(activePlayer);
    
    if (result.error) return;

    sounds.playRoll();
    // Dispatch to Phaser to run animations
    phaserGameRef.current?.events.emit('ROLL_RESULT', result);
    setIsAnimating(true);

    // Play procedural sounds
    handleReportSounds(result.animationReport);
  };

  const handleRestart = () => {
    sounds.init();
    serverRef.current.reset();
    const newState = serverRef.current.getState();
    setGameState(newState);
    setIsAnimating(false);
    
    // Notify Phaser to reset board coordinates
    phaserGameRef.current?.events.emit('SYNC_STATE', newState);
  };

  const toggleMute = () => {
    sounds.init();
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const activePlayerColor = gameState.currentTurn === 'A' ? 'text-blue-glow' : 'text-orange-glow';
  const playerAName = gameState.players.A.isAlive ? 'Player A (Blue)' : 'Player A [FALLEN]';
  const playerBName = gameState.players.B.isAlive ? 'Player B (Orange)' : 'Player B [FALLEN]';

  return (
    <div className="game-container flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-6 select-none">
      
      {/* Phaser Canvas Area */}
      <div className="phaser-panel flex-1 flex flex-col items-center">
        <div className="panel-header w-full flex justify-between items-center mb-2 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-widest bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">HEXADROP</span>
            <span className="px-2 py-0.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-400">MVP v0.1</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRules(!showRules)} 
              className="px-3 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              {showRules ? 'Hide Rules' : 'Show Rules'}
            </button>
            <button 
              onClick={toggleMute} 
              className="px-3 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1"
            >
              {isMuted ? '🔇 Muted' : '🔊 Sound On'}
            </button>
            <button 
              onClick={handleRestart} 
              className="px-3 py-1 text-xs font-semibold rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-900 transition"
            >
              🔄 Restart
            </button>
          </div>
        </div>

        {/* Canvas container */}
        <div 
          ref={phaserContainerRef} 
          className="border-2 border-slate-800/80 rounded-b-xl shadow-[0_0_25px_rgba(30,41,59,0.3)] bg-slate-950 overflow-hidden relative"
          style={{ width: '760px', height: '560px' }}
        >
          {/* Action state loading cover */}
          {isAnimating && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 backdrop-blur-sm flex items-center gap-2 pointer-events-none">
              <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-ping"></span>
              <span className="text-xs text-slate-400 font-mono">ANIMATING STATE...</span>
            </div>
          )}
        </div>
      </div>

      {/* Control HUD Side Panel */}
      <div className="hud-panel w-full md:w-80 flex flex-col gap-4">
        
        {/* State Board HUD */}
        <div className="hud-card bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-sm font-semibold tracking-wider text-slate-400">ROUND {gameState.round}</span>
            <span className="text-xs text-slate-500 font-mono">Ring {gameState.activeRing} Collapsing</span>
          </div>

          {!gameState.isGameOver ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">TURN</span>
                <span className={`text-lg font-black tracking-widest ${activePlayerColor}`}>
                  {gameState.currentTurn === 'A' ? 'PLAYER A' : 'PLAYER B'}
                </span>
              </div>

              {/* Timer Graphic */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500">TURN TIMER</span>
                  <span className={gameState.turnTimer <= 3 ? 'text-red-500 font-bold animate-pulse' : 'text-slate-300'}>
                    {gameState.turnTimer}s
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/50">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      gameState.turnTimer <= 3 ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                      gameState.currentTurn === 'A' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'bg-gradient-to-r from-orange-600 to-amber-500'
                    }`} 
                    style={{ width: `${(gameState.turnTimer / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={isAnimating}
                onClick={handleRoll}
                className={`w-full py-4 text-sm font-bold tracking-widest rounded-lg border uppercase transition shadow-lg ${
                  isAnimating 
                    ? 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed' 
                    : gameState.currentTurn === 'A'
                      ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500 text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'bg-orange-600/10 hover:bg-orange-600/20 border-orange-500 text-orange-300 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                }`}
              >
                {isAnimating ? 'Resolving...' : `ROLL D8 (Player ${gameState.currentTurn})`}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-center py-2">
              <span className="text-xs text-rose-500 font-bold tracking-widest uppercase">MATCH OVER</span>
              <span className="text-2xl font-black text-slate-100 uppercase">
                {gameState.winner === 'Draw' ? '🤝 Draw Game' : `🏆 Player ${gameState.winner} Wins`}
              </span>
              <button
                onClick={handleRestart}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-lg font-bold hover:shadow-[0_0_15px_rgba(225,29,72,0.4)] transition text-xs tracking-widest uppercase"
              >
                Play Another Match
              </button>
            </div>
          )}

          {/* Positions stats grid */}
          <div className="grid grid-cols-2 bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-xs gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono">PLAYER A</span>
              <span className="text-blue-400 font-bold font-mono">Tile {gameState.players.A.position}/61</span>
              <span className="text-[9px] text-slate-600 uppercase">{gameState.players.A.isAlive ? 'Alive' : 'Fallen'}</span>
            </div>
            <div className="flex flex-col border-l border-slate-800/80 pl-2.5">
              <span className="text-[10px] text-slate-500 font-mono">PLAYER B</span>
              <span className="text-orange-400 font-bold font-mono">Tile {gameState.players.B.position}/61</span>
              <span className="text-[9px] text-slate-600 uppercase">{gameState.players.B.isAlive ? 'Alive' : 'Fallen'}</span>
            </div>
          </div>
        </div>

        {/* Combat Battle Feed */}
        <div className="hud-card flex-1 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col gap-2 shadow-xl" style={{ maxHeight: '250px' }}>
          <span className="text-xs font-bold text-slate-400 tracking-wider">COMBAT LOG</span>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed scrollbar-thin">
            {gameState.combatLog.map((log) => {
              let logColor = 'text-slate-400';
              if (log.type === 'roll') logColor = 'text-cyan-400';
              else if (log.type === 'bump') logColor = 'text-rose-400 font-bold';
              else if (log.type === 'collapse') logColor = 'text-amber-500';
              else if (log.type === 'elimination') logColor = 'text-red-500 font-semibold';
              else if (log.type === 'win') logColor = 'text-green-400 font-bold border-t border-b border-green-950/50 py-1 my-1';
              else if (log.type === 'warning') logColor = 'text-amber-400 italic';
              
              return (
                <div key={log.id} className={`${logColor} flex gap-1.5 items-start`}>
                  <span className="text-slate-600 shrink-0 font-bold select-none">[R{log.round}]</span>
                  <span>{log.text}</span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Small Rules Panel */}
        {showRules && (
          <div className="hud-card bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-2 shadow-xl text-xs text-slate-400 animate-fadeIn">
            <span className="font-bold text-slate-200 uppercase text-[10px] tracking-wider pb-1 border-b border-slate-800">GAMEPLAY RULES</span>
            <ul className="list-disc pl-4 flex flex-col gap-1 text-[11px]">
              <li>Race forward to the center (Tile 61).</li>
              <li><b>Dice</b>: Rolls 1-6 move normal. Roll 7 = Leap (+7). Roll 8 = Overdrive (+8).</li>
              <li><b>Bumping</b>: Land on opponent to knock them back 3 tiles (Normal) or 6 tiles (Overdrive).</li>
              <li><b>Collapse</b>: At end of round, 2 outermost ring tiles collapse forever.</li>
              <li><b>Abyss</b>: Landing/bumping onto a collapsed tile results in instant elimination.</li>
              <li><b>Winner</b>: Last survivor wins.</li>
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
