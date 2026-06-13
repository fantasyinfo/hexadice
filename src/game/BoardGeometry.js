// BoardGeometry.js
// Generates coordinates for a 61-tile hexagon board arranged in a spiral.
// Concentric rings collapse from the outside (Ring 4) to the inside (Ring 0).

// Pointy-topped hexagon coordinate conversion:
// x = size * sqrt(3) * (q + r/2)
// y = size * 3/2 * r
export function hexToScreen(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (1.5) * r;
  return { x, y };
}

// Generate the 61 tile coordinates in spiral order (1 to 61)
// Ring 4: 24 tiles (Tiles 1-24)
// Ring 3: 18 tiles (Tiles 25-42)
// Ring 2: 12 tiles (Tiles 43-54)
// Ring 1: 6 tiles (Tiles 55-60)
// Ring 0: 1 tile (Tile 61, center)
export function getSpiralCoordinates(hexSize = 35) {
  const tiles = [];
  let id = 1;

  // We trace from Ring 4 down to Ring 0
  const ringSizes = [24, 18, 12, 6, 1];
  
  // Standard axial directions for clockwise traversal starting from NE:
  // 0: NE (1, -1)
  // 1: E (1, 0)
  // 2: SE (0, 1)
  // 3: SW (-1, 1)
  // 4: W (-1, 0)
  // 5: NW (0, -1)
  // But since we start at the top-left (NW, (0, -k)),
  // we go: East, South-East, South-West, West, North-West, North-East.
  const directions = [
    { q: 1, r: 0 },   // East
    { q: 0, r: 1 },   // South-East
    { q: -1, r: 1 },  // South-West
    { q: -1, r: 0 },  // West
    { q: 0, r: -1 },  // North-West
    { q: 1, r: -1 }   // North-East
  ];

  for (let ring = 4; ring >= 1; ring--) {
    // Start at (0, -ring)
    let q = 0;
    let r = -ring;
    
    // For each of the 6 directions, we walk 'ring' steps
    for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
      const dir = directions[dirIndex];
      for (let step = 0; step < ring; step++) {
        const screenPos = hexToScreen(q, r, hexSize);
        tiles.push({
          id: id++,
          q,
          r,
          x: screenPos.x,
          y: screenPos.y,
          ring: ring
        });
        
        // Move to the next hex in this direction
        q += dir.q;
        r += dir.r;
      }
    }
  }

  // Ring 0 (Center Tile 61) is at (0, 0)
  const centerScreen = hexToScreen(0, 0, hexSize);
  tiles.push({
    id: 61,
    q: 0,
    r: 0,
    x: centerScreen.x,
    y: centerScreen.y,
    ring: 0
  });

  return tiles;
}

// Helper to determine the ring number for a given tile ID
export function getRingNumber(tileId) {
  if (tileId >= 1 && tileId <= 24) return 4;
  if (tileId >= 25 && tileId <= 42) return 3;
  if (tileId >= 43 && tileId <= 54) return 2;
  if (tileId >= 55 && tileId <= 60) return 1;
  if (tileId === 61) return 0;
  return -1;
}

// Helper to get all tile IDs belonging to a specific ring
export function getRingTiles(ringNumber) {
  switch (ringNumber) {
    case 4:
      return Array.from({ length: 24 }, (_, i) => i + 1);
    case 3:
      return Array.from({ length: 18 }, (_, i) => i + 25);
    case 2:
      return Array.from({ length: 12 }, (_, i) => i + 43);
    case 1:
      return Array.from({ length: 6 }, (_, i) => i + 55);
    case 0:
      return [61];
    default:
      return [];
  }
}

// Finds the shortest path between startTileId and endTileId on the hex grid
// Returns an array of tile IDs starting from startTileId to endTileId.
// Avoids destroyed tiles. Falls back to direct path if cut off.
export function findGridPath(startTileId, endTileId, destroyedTiles = {}) {
  const tilesList = getSpiralCoordinates();
  const tilesMap = {};
  tilesList.forEach(t => { tilesMap[t.id] = t; });

  const startTile = tilesMap[startTileId];
  const endTile = tilesMap[endTileId];
  if (!startTile || !endTile) return [startTileId, endTileId];

  // Helper to get active neighbors of a tile on the hex grid
  const getNeighbors = (tileId) => {
    const tile = tilesMap[tileId];
    if (!tile) return [];
    
    const neighbors = [];
    tilesList.forEach(t => {
      if (t.id === tileId) return;
      if (destroyedTiles[t.id]) return; // Skip destroyed tiles
      
      // Hex grid distance check (dist === 1 means they are direct neighbors)
      const dist = (Math.abs(tile.q - t.q) + Math.abs(tile.r - t.r) + Math.abs((tile.q + tile.r) - (t.q + t.r))) / 2;
      if (dist === 1) {
        neighbors.push(t.id);
      }
    });
    return neighbors;
  };

  // BFS Queue: stores paths
  const queue = [[startTileId]];
  const visited = { [startTileId]: true };

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === endTileId) {
      return path;
    }

    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        visited[neighbor] = true;
        queue.push([...path, neighbor]);
      }
    }
  }

  // Fallback: If BFS fails (e.g. start/end is completely isolated by destroyed tiles),
  // return direct start/end path to avoid softlocks.
  return [startTileId, endTileId];
}

