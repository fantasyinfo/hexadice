import { GameServer } from './src/game/GameServer.js';

const server = new GameServer();
const state = server.getState();

state.players['A'].pawns[0].position = 6;
state.players['A'].pawns[0].spawnPos = 1;

state.players['B'].pawns[0].position = 5;
state.players['B'].pawns[0].spawnPos = 13;

server.state.currentTurn = 'B';
server.state.activeRoll = {
  roll: 1,
  isOverdrive: false,
  isLeap: false,
  validTargets: { 'B1': [6] }
};

const result = server.selectTile('B', 'B1', 6);
console.log(result.animationReport.bump);
console.log("A1 pos after:", state.players['A'].pawns[0].position);
console.log("B1 pos after:", state.players['B'].pawns[0].position);
