import React from 'react';
import GameInterface from './components/GameInterface';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-cyan-500/30 pt-4 pb-12">
      <main className="w-full">
        <GameInterface />
      </main>
    </div>
  );
}

export default App;
