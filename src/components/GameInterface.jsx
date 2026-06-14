// GameInterface.jsx
// HexaDrop v0.2 — Phase 1: DP bars, Match Summary screen, Dual Win display.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { GameScene } from '../game/GameScene';
import { GameServer } from '../game/GameServer';
import sounds from '../game/soundEffects';


const PRESET_COLORS = [
  { hex: 0x00bfff, bg: 'bg-[#00bfff]', name: 'Cyan' },
  { hex: 0xff8c00, bg: 'bg-[#ff8c00]', name: 'Orange' },
  { hex: 0x22c55e, bg: 'bg-[#22c55e]', name: 'Green' },
  { hex: 0xa855f7, bg: 'bg-[#a855f7]', name: 'Purple' },
  { hex: 0xef4444, bg: 'bg-[#ef4444]', name: 'Red' },
  { hex: 0x0ea5e9, bg: 'bg-[#0ea5e9]', name: 'Blue' }
];

// ── DP Progress Bar ──────────────────────────────────────────────────────────
function DPBar({ dp, color, flashing }) {
  const pct = Math.min(100, dp);
  const barClass = color === 'blue'
    ? 'from-blue-600 to-cyan-400'
    : 'from-orange-600 to-amber-400';
  const glowStyle = dp >= 75
    ? { boxShadow: color === 'blue' ? '0 0 8px rgba(59,130,246,0.8)' : '0 0 8px rgba(249,115,22,0.8)' }
    : {};

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
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${barClass}`}
          style={{ width: `${pct}%`, ...glowStyle }}
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

// ── Match Summary (Victory Screen) ──────────────────────────────────────────
function MatchSummary({ gameState, onPlayAgain }) {
  const { winner, winType, players, round } = gameState;
  const [copied, setCopied] = useState(false);

  const isDomination = winType === 'domination';
  const isDraw = winner === 'Draw';

  const cfgMap = {
    A: { title: 'PLAYER A WINS', bar: 'from-blue-500 to-cyan-400', accent: '#3b82f6', glow: 'rgba(59,130,246,0.2)', labelColor: '#60a5fa' },
    B: { title: 'PLAYER B WINS', bar: 'from-orange-500 to-amber-400', accent: '#f97316', glow: 'rgba(249,115,22,0.2)', labelColor: '#fb923c' },
    Draw: { title: 'DRAW', bar: 'from-slate-500 to-slate-400', accent: '#64748b', glow: 'rgba(100,116,139,0.1)', labelColor: '#94a3b8' },
  };
  const c = cfgMap[winner] || cfgMap.Draw;

  const badge = isDomination ? '🏆 Domination Win' : isDraw ? '🤝 Draw' : '💀 Survival Win';
  const subtitle = isDomination ? 'First to 100 Domination Points'
    : isDraw ? 'Both players fell into the Abyss'
      : 'Last player standing';

  const handleCopy = () => {
    const lines = [
      `🎮 HexaDrop — ${c.title}`,
      `${badge}: ${subtitle}`,
      ``,
      `Player A: ${players.A.dp} DP · ${players.A.bumpsLanded} bumps landed`,
      `Player B: ${players.B.dp} DP · ${players.B.bumpsLanded} bumps landed`,
      `Match: ${round} rounds`,
    ].join('\n');
    navigator.clipboard.writeText(lines).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statRows = [
    { label: 'Domination Points', keyA: players.A.dp, keyB: players.B.dp, fmtA: `${players.A.dp} DP`, fmtB: `${players.B.dp} DP`, numeric: true },
    { label: 'Bumps Landed', keyA: players.A.bumpsLanded, keyB: players.B.bumpsLanded, fmtA: players.A.bumpsLanded, fmtB: players.B.bumpsLanded, numeric: true },
    { label: 'Bumps Received', keyA: players.A.bumpsReceived, keyB: players.B.bumpsReceived, fmtA: players.A.bumpsReceived, fmtB: players.B.bumpsReceived, numeric: true },
    { label: 'Hunt Targets', keyA: players.A.huntTargetsHit, keyB: players.B.huntTargetsHit, fmtA: players.A.huntTargetsHit, fmtB: players.B.huntTargetsHit, numeric: true },
    { label: 'Result', keyA: players.A.isAlive, keyB: players.B.isAlive, fmtA: players.A.isAlive ? '✅ Survived' : '💀 Fallen', fmtB: players.B.isAlive ? '✅ Survived' : '💀 Fallen', numeric: false },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,15,0.92)', backdropFilter: 'blur(20px)' }}
    >
      <div
        className="relative w-full flex flex-col rounded-2xl overflow-y-auto"
        style={{
          maxWidth: '500px',
          maxHeight: '90vh',
          background: 'linear-gradient(170deg, #0d1526 0%, #070c18 100%)',
          border: `1px solid ${c.accent}35`,
          boxShadow: `0 0 80px ${c.glow}, 0 30px 60px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Accent top bar */}
        <div className={`h-[3px] w-full bg-gradient-to-r ${c.bar}`} />

        {/* ── HERO ── */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-5 px-6">
          {/* Win type badge */}
          <div
            className="px-4 py-1.5 rounded-full text-[11px] font-black tracking-[0.15em] uppercase"
            style={{
              background: `${c.accent}18`,
              border: `1px solid ${c.accent}40`,
              color: c.accent,
            }}
          >
            {badge}
          </div>

          {/* Title */}
          <h1
            className="text-[2rem] font-black tracking-widest text-center leading-none"
            style={{ color: c.labelColor, textShadow: `0 0 40px ${c.accent}60` }}
          >
            {c.title}
          </h1>

          {/* Subtitle */}
          <p className="text-[11px] font-mono text-slate-500 tracking-wider">{subtitle}</p>

          {/* Thin divider */}
          <div
            className="h-px w-20 rounded-full mt-1"
            style={{ background: `linear-gradient(to right, transparent, ${c.accent}80, transparent)` }}
          />
        </div>

        {/* ── STATS TABLE ── */}
        <div className="px-6 pb-5">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" style={{ boxShadow: '0 0 6px #3b82f6' }} />
              <span className={`text-[11px] font-black tracking-widest ${winner === 'A' ? 'text-blue-400' : 'text-slate-500'}`}>
                {winner === 'A' ? '👑 PLAYER A' : 'PLAYER A'}
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-700 tracking-widest px-4">VS</span>
            <div className="flex items-center justify-end gap-2">
              <span className={`text-[11px] font-black tracking-widest ${winner === 'B' ? 'text-orange-400' : 'text-slate-500'}`}>
                {winner === 'B' ? 'PLAYER B 👑' : 'PLAYER B'}
              </span>
              <span className="w-2 h-2 rounded-full bg-orange-500" style={{ boxShadow: '0 0 6px #f97316' }} />
            </div>
          </div>

          {/* Rows */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(51,65,85,0.5)' }}>
            {statRows.map((row, i) => {
              const aWins = row.numeric && row.keyA > row.keyB;
              const bWins = row.numeric && row.keyB > row.keyA;
              const even = i % 2 === 0;

              return (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3"
                  style={{ background: even ? 'rgba(15,23,42,0.6)' : 'rgba(7,10,20,0.6)' }}
                >
                  {/* A value */}
                  <span
                    className="text-sm font-black font-mono"
                    style={{ color: aWins ? '#60a5fa' : '#94a3b8' }}
                  >
                    {aWins && <span className="text-blue-500 text-xs mr-1">▲</span>}
                    {row.fmtA}
                  </span>

                  {/* Label */}
                  <span
                    className="text-[10px] font-mono text-center px-3 leading-tight"
                    style={{ color: '#475569', minWidth: '110px' }}
                  >
                    {row.label}
                  </span>

                  {/* B value */}
                  <span
                    className="text-sm font-black font-mono text-right"
                    style={{ color: bWins ? '#fb923c' : '#94a3b8' }}
                  >
                    {row.fmtB}
                    {bWins && <span className="text-orange-500 text-xs ml-1">▲</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Round info */}
          <p className="text-center text-[11px] font-mono text-slate-600 mt-3">
            Match ended in <span className="text-slate-400 font-semibold">{round} round{round !== 1 ? 's' : ''}</span>
          </p>
        </div>

        {/* ── BUTTONS ── */}
        <div className="flex gap-3 px-6 pb-7">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all duration-200"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(51,65,85,0.6)',
              color: copied ? '#22c55e' : '#64748b',
            }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#64748b'; }}
          >
            {copied ? '✓ Copied!' : '📋 Copy Result'}
          </button>
          <button
            onClick={onPlayAgain}
            className={`flex-1 py-3 rounded-xl text-[11px] font-black tracking-widest uppercase bg-gradient-to-r ${c.bar} text-white transition-all duration-200`}
            style={{ boxShadow: `0 4px 24px ${c.glow}` }}
          >
            🔄 Play Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Modal ───────────────────────────────────────────────────────────────
function SetupModal({ initialConfig, onStart }) {
  const [nameA, setNameA] = useState(initialConfig.A.name);
  const [colorA, setColorA] = useState(initialConfig.A.color);
  const [nameB, setNameB] = useState(initialConfig.B.name);
  const [colorB, setColorB] = useState(initialConfig.B.color);

  const handleSubmit = (e) => {
    e.preventDefault();
    onStart({
      A: { name: nameA || 'Player A', color: colorA },
      B: { name: nameB || 'Player B', color: colorB }
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070c]/90 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <h2 className="text-2xl font-black text-center mb-6 tracking-widest text-white">GAME SETUP</h2>

        <div className="space-y-6">
          {/* Player A Setup */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Player A</label>
            <input type="text" value={nameA} onChange={e => setNameA(e.target.value)} maxLength={15} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="Enter Name" />
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map(c => (
                <button key={c.hex} type="button" onClick={() => setColorA(c.hex)} className={`w-8 h-8 rounded-full ${c.bg} ${colorA === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-50 hover:opacity-100'}`} title={c.name} />
              ))}
            </div>
          </div>

          {/* Player B Setup */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Player B</label>
            <input type="text" value={nameB} onChange={e => setNameB(e.target.value)} maxLength={15} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-orange-500 focus:outline-none" placeholder="Enter Name" />
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map(c => (
                <button key={c.hex} type="button" onClick={() => setColorB(c.hex)} className={`w-8 h-8 rounded-full ${c.bg} ${colorB === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-50 hover:opacity-100'}`} title={c.name} />
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="w-full mt-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl font-black tracking-widest uppercase text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all">
          Start Game
        </button>
      </form>
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
  const [showSetup, setShowSetup] = useState(true);
  const [playersConfig, setPlayersConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('hexadrop_config');
      if (stored) return JSON.parse(stored);
    } catch (e) { }
    return { A: { name: 'Player A', color: 0x00bfff }, B: { name: 'Player B', color: 0xff8c00 } };
  });
  const [sessionHistory, setSessionHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hexadrop_history') || '[]'); } catch (e) { return []; }
  });
  const [headToHead, setHeadToHead] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hexadrop_h2h') || '{"A":0,"B":0}'); } catch (e) { return { A: 0, B: 0 }; }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [lastPassInfo, setLastPassInfo] = useState(null);
  const [dpFlash, setDpFlash] = useState({ A: false, B: false });
  const [dpToast, setDpToast] = useState(null);

  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.combatLog, logsExpanded]);

  useEffect(() => {
    serverRef.current.setConfig(playersConfig);
    setGameState(serverRef.current.getState());
  }, []);

  useEffect(() => {
    if (dpToast) {
      const t = setTimeout(() => setDpToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [dpToast]);

  const flashDP = useCallback((playerId) => {
    setDpFlash(prev => ({ ...prev, [playerId]: true }));
    setTimeout(() => setDpFlash(prev => ({ ...prev, [playerId]: false })), 600);
  }, []);

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
      game.events.emit('CONFIG_PLAYERS', { A: playersConfig.A.color, B: playersConfig.B.color });
      game.events.emit('SYNC_STATE', serverRef.current.getState());
    });

    game.events.on('ANIMATION_START', () => setIsAnimating(true));

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
        if (prev.players.A.dp !== newState.players.A.dp) {
          flashDP('A');
          [25, 50, 75].forEach(m => {
            if (prev.players.A.dp < m && newState.players.A.dp >= m) setDpToast({ text: `PLAYER A — ${m} DP!`, color: 'blue' });
          });
        }
        if (prev.players.B.dp !== newState.players.B.dp) {
          flashDP('B');
          [25, 50, 75].forEach(m => {
            if (prev.players.B.dp < m && newState.players.B.dp >= m) setDpToast({ text: `PLAYER B — ${m} DP!`, color: 'orange' });
          });
        }
        return newState;
      });
      if (newState.isGameOver) {
        try {
          const matchResult = {
            winner: newState.winner,
            dpA: newState.players.A.dp,
            dpB: newState.players.B.dp
          };

          const newHistory = [...sessionHistory, matchResult].slice(-3); // Keep last 3
          setSessionHistory(newHistory);
          localStorage.setItem('hexadrop_history', JSON.stringify(newHistory));

          if (newState.winner === 'A' || newState.winner === 'B') {
            const newH2H = { ...headToHead, [newState.winner]: headToHead[newState.winner] + 1 };
            setHeadToHead(newH2H);
            localStorage.setItem('hexadrop_h2h', JSON.stringify(newH2H));
          }
        } catch (e) { }

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
  }, [flashDP, playersConfig]);

  const handleReportSounds = (report) => {
    if (report.bump) {
      setTimeout(() => sounds.playBump(), 300);
      if (report.bump.intoAbyss) setTimeout(() => sounds.playElimination(), 600);
    }
    if (report.collapsedTiles?.length > 0) {
      const delay = report.bump ? 700 : 300;
      setTimeout(() => {
        sounds.playCollapse();
        if (report.eliminated?.length > 0) sounds.playElimination();
      }, delay);
    }
    if (serverRef.current.state.isGameOver) {
      setTimeout(() => sounds.playWin(), report.bump ? 1100 : 700);
    }
  };

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
      setGameState(serverRef.current.getState());
    }
  };

  const handleRestart = () => {
    sounds.init();
    serverRef.current = new GameServer();
    serverRef.current.setConfig(playersConfig);
    const newState = serverRef.current.getState();
    setGameState(newState);
    setShowSummary(false);
    setIsAnimating(false);
    setIsWaitingForTileSelection(false);
    setLastPassInfo(null);
    phaserGameRef.current?.events.emit('SYNC_STATE', newState);
  };

  const handleSetupComplete = (cfg) => {
    setPlayersConfig(cfg);
    localStorage.setItem('hexadrop_config', JSON.stringify(cfg));
    serverRef.current.setConfig(cfg);
    setGameState(serverRef.current.getState());
    setShowSetup(false);
    if (phaserGameRef.current) {
      phaserGameRef.current.events.emit('CONFIG_PLAYERS', { A: cfg.A.color, B: cfg.B.color });
    }
  };

  const toggleMute = () => {
    sounds.init();
    setIsMuted(sounds.toggleMute());
  };

  const isPlayerATurn = gameState.currentTurn === 'A' && !gameState.isGameOver;
  const isPlayerBTurn = gameState.currentTurn === 'B' && !gameState.isGameOver;

  const renderPlayerCard = (pid) => {
    const isA = pid === 'A';
    const player = gameState.players[pid];
    const isMyTurn = isA ? isPlayerATurn : isPlayerBTurn;
    const color = isA ? 'blue' : 'orange';
    const cfg = playersConfig[pid];
    const hexColor = `#${cfg.color.toString(16).padStart(6, '0')}`;

    const borderActive = isA
      ? `border-blue-500/80 bg-blue-950/5 shadow-[0_0_20px_rgba(59,130,246,0.15)]`
      : `border-orange-500/80 bg-orange-950/5 shadow-[0_0_20px_rgba(249,115,22,0.15)]`;
    const titleActive = isA ? 'text-blue-300' : 'text-orange-300';
    const posColor = isA ? 'text-blue-400' : 'text-orange-400';
    const liveDot = isA ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-orange-500 shadow-[0_0_8px_#f97316]';
    const rollBg = isA ? 'bg-blue-950/40 border-blue-800/50' : 'bg-orange-950/40 border-orange-800/50';
    const rollLabel = isA ? 'text-blue-400' : 'text-orange-400';

    return (
      <div className={`player-card-panel w-full lg:w-72 bg-slate-900/40 border rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all duration-300 ${isMyTurn ? borderActive : 'border-slate-800/80'}`}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800/60 relative">
            <span className={`text-xl font-black tracking-widest uppercase ${isMyTurn ? titleActive : 'text-slate-400'}`} style={{ color: isMyTurn ? hexColor : undefined }}>
              {player.name}
            </span>
            <span className={`w-3.5 h-3.5 rounded-full ${player.isAlive ? liveDot : 'bg-red-950 border border-red-800'}`} style={{ backgroundColor: player.isAlive ? hexColor : undefined, boxShadow: player.isAlive ? `0 0 8px ${hexColor}` : undefined }} />
          </div>

          {/* Combo Badge */}
          {player.combo && player.combo.name && (
            <div className="absolute top-4 right-4 bg-slate-900 border text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg animate-pulse" style={{ borderColor: hexColor, color: hexColor }}>
              🔥 {player.combo.name} {player.combo.count > 1 ? `×${player.combo.count}` : ''}
            </div>
          )}

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
            {sessionHistory.length > 0 && (
              <div className="flex justify-between text-[10px] mt-1 pt-2 border-t border-slate-800/60">
                <span className="text-slate-500">LAST {sessionHistory.length} MATCHES</span>
                <span className="text-slate-400 font-bold">
                  {sessionHistory.map(h => isA ? h.dpA : h.dpB).join(' · ')} DP
                </span>
              </div>
            )}
          </div>

          <DPBar dp={player.dp} color={color} flashing={dpFlash[pid]} />

          {player.huntTarget && (
            <div className={`mt-2 flex flex-col gap-1.5 p-3 rounded-lg border ${!isMyTurn
                ? 'bg-slate-900/60 border-slate-800'
                : player.huntTarget.achieved
                  ? 'bg-emerald-950/40 border-emerald-800/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-indigo-950/30 border-indigo-900/50'
              }`}>
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-bold tracking-widest ${!isMyTurn ? 'text-slate-500' : 'text-indigo-400'}`}>HUNT TARGET</span>
                {isMyTurn && (
                  <span className={`text-[9px] font-black ${player.huntTarget.achieved ? 'text-emerald-400' : 'text-slate-400'}`}>
                    +{player.huntTarget.dpReward} DP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isMyTurn ? (
                  <span className="text-xs font-mono text-slate-500 tracking-wider">[ HIDDEN ]</span>
                ) : (
                  <>
                    <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${player.huntTarget.achieved ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600 bg-slate-900'
                      }`}>
                      {player.huntTarget.achieved && <span className="text-[8px] font-black">✓</span>}
                    </div>
                    <span className={`text-xs font-mono font-medium ${player.huntTarget.achieved ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {player.huntTarget.label}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {gameState.activeRoll && gameState.currentTurn === pid && (
            <div className={`flex flex-col gap-1.5 p-3 ${rollBg} border rounded-lg text-center mt-1 animate-pulse font-mono`}>
              <span className={`text-[10px] ${rollLabel} tracking-widest font-bold`}>ROLLED</span>
              <span className="text-3xl font-black text-slate-100">🎲 {gameState.activeRoll.roll}</span>
              <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                Move exactly {gameState.activeRoll.movement} steps — same or adjacent ring
              </span>
            </div>
          )}

          {lastPassInfo && lastPassInfo.playerId === pid && !gameState.activeRoll && (
            <div className="flex flex-col gap-1.5 p-3 bg-amber-950/40 border border-amber-700/60 rounded-lg text-center mt-1 font-mono">
              <span className="text-[10px] text-amber-400 tracking-widest font-bold">⚠️ TURN PASSED</span>
              <span className="text-3xl font-black text-slate-100">🎲 {lastPassInfo.label}</span>
              <span className="text-[9px] text-amber-300/80 font-sans mt-0.5">
                No valid tile at {lastPassInfo.movement} step{lastPassInfo.movement !== 1 ? 's' : ''} — -2 DP
              </span>
            </div>
          )}
        </div>

        <div className="mt-5">
          {isMyTurn ? (
            <button
              disabled={isAnimating || isWaitingForTileSelection}
              onClick={handleRoll}
              id={`roll-btn-${pid}`}
              className={`w-full py-4 text-sm font-bold tracking-widest rounded-lg border uppercase transition shadow-lg ${isWaitingForTileSelection
                  ? 'border-cyan-800 text-cyan-400 cursor-not-allowed animate-pulse bg-slate-950/30'
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

  return (
    <div className="game-screen-wrapper w-full flex flex-col items-center relative">

      {dpToast && (
        <div className="absolute top-20 z-50 animate-bounce pointer-events-none">
          <div className={`px-6 py-3 rounded-full border-2 bg-slate-900 shadow-2xl backdrop-blur-md ${dpToast.color === 'blue' ? 'border-blue-500 text-blue-400 shadow-blue-500/50' : 'border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.5)]'
            }`}>
            <span className="font-black tracking-widest text-lg drop-shadow-md">🏆 {dpToast.text}</span>
          </div>
        </div>
      )}

      {showSummary && <MatchSummary gameState={gameState} onPlayAgain={handleRestart} />}

      {/* Header */}
      <header className="w-full max-w-7xl px-6 py-4 flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl mb-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">HEXADROP</span>
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-400 tracking-wider">v0.2</span>
        </div>
        <div className="text-center">
          {gameState.isGameOver ? (
            <button onClick={() => setShowSummary(true)} className="text-sm font-black text-amber-400 tracking-widest animate-pulse hover:text-amber-300 transition">
              MATCH OVER — View Summary ▶
            </button>
          ) : isWaitingForTileSelection ? (
            <div className="px-6 py-2 rounded-full border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 font-mono text-xs font-bold tracking-wide shadow-[0_0_15px_rgba(6,182,212,0.2)] animate-pulse">
              👉 {playersConfig[gameState.currentTurn]?.name || `Player ${gameState.currentTurn}`} rolled {gameState.activeRoll?.roll}! Click highlighted tile to move
            </div>
          ) : (
            <span className="text-xs font-mono text-slate-500 tracking-wider">
              🎮 Round {gameState.round} · {61 - Object.keys(gameState.destroyedTiles).length}/61 tiles · First to 100 DP wins
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowRulesModal(true)} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">📋 Rules</button>
          <button onClick={toggleMute} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">{isMuted ? '🔇 Muted' : '🔊 Sound On'}</button>
          <button onClick={handleRestart} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-900/80 transition">🔄 Restart</button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl px-4 items-stretch mx-auto relative">

        {/* Head-to-Head Banner (Absolute Top Center) */}
        {!showSetup && (headToHead.A > 0 || headToHead.B > 0) && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-3">
            <span className="text-xs font-bold text-blue-400">{playersConfig.A.name} {headToHead.A}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">— VS —</span>
            <span className="text-xs font-bold text-orange-400">{headToHead.B} {playersConfig.B.name}</span>
          </div>
        )}

        {renderPlayerCard('A')}
        <div className="phaser-canvas-panel flex-1 flex justify-center">
          <div
            className="w-full relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-[#05070c]"
            style={{ minHeight: '560px' }}
          >
            {showSetup && <SetupModal initialConfig={playersConfig} onStart={handleSetupComplete} />}
            <div ref={phaserContainerRef} className="w-full h-full flex items-center justify-center" />
            
            {(isAnimating || isWaitingForTileSelection) && (
              <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-slate-950/80 border border-slate-800 backdrop-blur-md flex items-center gap-2.5 pointer-events-none shadow-lg z-10">
                <span className={`w-2 h-2 rounded-full animate-ping ${isWaitingForTileSelection ? 'bg-cyan-400' : 'bg-blue-400'}`} />
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  {isWaitingForTileSelection ? 'SELECT TILE TO SIT' : 'ANIMATING...'}
                </span>
              </div>
            )}
          </div>
        </div>
        {renderPlayerCard('B')}
      </div>

      {/* Warned Tiles Banner */}
      {gameState.warnedTiles && gameState.warnedTiles.length > 0 && (
        <div className="w-full max-w-7xl mb-4 bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
          <span className="text-amber-400 font-bold tracking-widest text-sm uppercase">
            ⚠️ WARNING: {gameState.warnedTiles.length} {gameState.warnedTiles.length === 1 ? 'tile' : 'tiles'} will collapse next round — {gameState.warnedTiles.map(t => `Tile ${t}`).join(', ')}
          </span>
        </div>
      )}

      {/* Combat Log */}
      <div className="expandable-logs-bar w-full max-w-7xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md rounded-xl overflow-hidden shadow-xl mb-6">
        <button onClick={() => setLogsExpanded(!logsExpanded)} className="w-full px-5 py-3 flex justify-between items-center text-slate-400 hover:text-slate-200 transition font-semibold text-xs tracking-wider">
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
          <div className="modal-card bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-y-auto" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
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
                  <li>Roll D8. Move exactly that many BFS grid steps.</li>
                  <li>Ring Constraint: Only move to same ring or ±1 ring.</li>
                  <li>Roll 8 (Overdrive) → bump pushes opponent -6 tiles.</li>
                  <li>No valid target → turn auto-passes (-2 DP).</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-bold text-rose-400">💥 Bumps & Collapse:</span>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400 text-xs">
                  <li>Land on opponent → they slide back 3 (or 6 on Overdrive) tiles step by step.</li>
                  <li>Hit a destroyed tile or go off the board during bump → eliminated.</li>
                  <li>Every round: 2 random tiles collapse forever. Standing on one = eliminated.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-bold text-indigo-400">🎯 Hunt Targets (Secret Missions):</span>
                <p className="text-xs text-slate-400 mb-1">New secret targets are given at the start of each round. Complete them for bonus DP!</p>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-400 text-xs">
                  <li><strong className="text-slate-300">Reach Ring X:</strong> Move to or past the specified inner ring during your turn.</li>
                  <li><strong className="text-slate-300">Land on Tile X:</strong> Finish your move exactly on the specified tile number.</li>
                  <li><strong className="text-slate-300">Land an Overdrive bump:</strong> Roll an 8 (Overdrive) and bump your opponent on that exact turn.</li>
                  <li><strong className="text-slate-300">Push opponent to Ring 4:</strong> Bump your opponent so they slide back into the outermost ring (Ring 4).</li>
                  <li><strong className="text-slate-300">Survive without being bumped:</strong> Finish your move, then survive your opponent's move without getting bumped. This target is evaluated at the end of the round!</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-800 pt-4 flex justify-end">
              <button onClick={() => setShowRulesModal(false)} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-bold transition text-xs tracking-widest uppercase">
                Close Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
