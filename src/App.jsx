import React from 'react';
import GameInterface from './components/GameInterface';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex items-center justify-center font-sans antialiased overflow-x-hidden selection:bg-cyan-500/30">
      <main className="w-full flex items-center justify-center p-2 md:p-6">
        <GameInterface />
      </main>
    </div>
  );
}

export default App;
