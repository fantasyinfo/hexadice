// GameScene.js
// Renders the board, player tokens, path, and runs step-by-step animations.
// Updated to support manual grid highlights and click selection.

import Phaser from 'phaser';
import { getSpiralCoordinates, getRingNumber, findGridPath } from './BoardGeometry';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.tiles = [];
    this.tileObjects = {}; // tileId -> { container, hex, border, label, highlightGlow }
    this.playerTokens = {}; // 'A', 'B' -> token container
    this.isAnimating = false;
    this.hexSize = 38; // Radius of each hex
    this.highlightedTileIds = [];
  }

  create() {
    // Width and height of the canvas
    const { width, height } = this.scale;
    
    // Set a subtle space dark background
    this.add.rectangle(0, 0, width, height, 0x05070c).setOrigin(0);

    // Create space dust / stars background decoration
    this.createStars(width, height);

    // Create a container centered on screen for the hex grid
    this.boardContainer = this.add.container(width / 2, height / 2 - 20);

    // Generate coordinate data
    this.tiles = getSpiralCoordinates(this.hexSize);

    // Renders the pathway connections (connecting lines)
    this.drawPathLines();

    // Renders all the hexagons
    this.drawHexagons();

    // Create player tokens
    this.createPlayers();

    // Listen for events from the React component
    this.game.events.on('ROLL_RESULT', (data) => this.handleRollResult(data));
    this.game.events.on('MOVE_RESULT', (data) => this.handleMoveResult(data));
    this.game.events.on('SYNC_STATE', (data) => this.handleSyncState(data));

    // Notify React that Phaser is ready
    this.game.events.emit('PHASER_READY');
  }

  // Draw space stars decoration
  createStars(width, height) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 0.4);
    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.Between(1, 2) * 0.8;
      graphics.fillCircle(x, y, radius);
    }
    // Add subtle galaxy glow at the center
    const centerGlow = this.add.graphics();
    centerGlow.fillStyle(0x3a1a5e, 0.15);
    centerGlow.fillCircle(width / 2, height / 2, 220);
  }

  // Draw lines connecting the tiles in order 1 -> 61
  drawPathLines() {
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0x1f293d, 0.8); // dark gray line

    graphics.beginPath();
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      if (i === 0) {
        graphics.moveTo(tile.x, tile.y);
      } else {
        graphics.lineTo(tile.x, tile.y);
      }
    }
    graphics.strokePath();
    this.boardContainer.add(graphics);
  }

  // Draw hexagons representing tiles
  drawHexagons() {
    const points = [];
    // Calculate the 6 vertices of a pointy-topped hexagon
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push({
        x: this.hexSize * Math.cos(angle),
        y: this.hexSize * Math.sin(angle)
      });
    }

    this.tiles.forEach(tile => {
      // Create a container for each tile
      const container = this.add.container(tile.x, tile.y);
      
      // Draw outer hexagon outline
      const border = this.add.graphics();
      border.lineStyle(2, 0x3f516d, 0.95); // Slightly lighter border to highlight rings
      
      // Draw filled hex
      const hex = this.add.graphics();
      this.styleTile(hex, tile.id, false); // Default active gray hex

      // Draw path outline
      border.beginPath();
      border.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 6; i++) {
        border.lineTo(points[i].x, points[i].y);
      }
      border.closePath();
      border.strokePath();

      // Draw number label inside
      const labelColor = tile.id === 61 ? '#ffcc00' : '#a0aec0';
      const labelWeight = tile.id === 61 ? 'bold' : 'normal';
      const labelSize = tile.id === 61 ? '15px' : '12px';
      
      const label = this.add.text(0, 0, tile.id.toString(), {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: labelSize,
        fontWeight: labelWeight,
        color: labelColor
      }).setOrigin(0.5);

      container.add(hex);
      container.add(border);
      container.add(label);

      // Add Ring Labels on the top-most tile of each ring
      if ([1, 25, 43, 55, 61].includes(tile.id)) {
        let ringText = '';
        if (tile.id === 1) ringText = 'RING 4';
        if (tile.id === 25) ringText = 'RING 3';
        if (tile.id === 43) ringText = 'RING 2';
        if (tile.id === 55) ringText = 'RING 1';
        if (tile.id === 61) ringText = 'CENTER';

        const ringLabel = this.add.text(0, -28, ringText, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '9px',
          fontWeight: 'bold',
          color: '#00ffcc',
          backgroundColor: '#0a0d14dd',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);
        
        // Draw a tiny pointer down
        const pointer = this.add.graphics();
        pointer.fillStyle(0x00ffcc, 1);
        pointer.fillTriangle(-3, -19, 3, -19, 0, -15);
        
        container.add(ringLabel);
        container.add(pointer);
      }

      this.boardContainer.add(container);

      // Save references
      this.tileObjects[tile.id] = { container, hex, border, label, highlightGlow: null };
    });
  }

  // Styles tiles depending on state
  styleTile(graphics, tileId, isDestroyed, isWarned = false) {
    graphics.clear();
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push({
        x: this.hexSize * Math.cos(angle),
        y: this.hexSize * Math.sin(angle)
      });
    }

    if (isDestroyed) {
      // Dark red styling with faint grid lines
      graphics.fillStyle(0x3a0d15, 0.85); // Dark deep red
    } else if (isWarned) {
      graphics.fillStyle(0x733a17, 0.95); // Deep amber/orange
    } else {
      // Ring-based colors for gradient space visual depth (distinct lighter colors)
      const ring = getRingNumber(tileId);
      if (tileId === 61) {
        graphics.fillStyle(0x614f27, 0.95); // Bronze/Gold center tile
      } else {
        const colors = [
          0x2a364d, // Ring 4
          0x3f2d57, // Ring 3
          0x224a54, // Ring 2
          0x593144  // Ring 1
        ];
        graphics.fillStyle(colors[4 - ring] || 0x2a364d, 0.95);
      }
    }

    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < 6; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  // Create player circle tokens
  createPlayers() {
    // Player A (Blue)
    const tokenA = this.createTokenContainer(0x00bfff, 'A');
    // Player B (Orange)
    const tokenB = this.createTokenContainer(0xff8c00, 'B');

    this.playerTokens = { A: tokenA, B: tokenB };
    this.boardContainer.add(tokenA);
    this.boardContainer.add(tokenB);

    // Initial position placement (both start at Tile 1)
    const startTile = this.tiles[0];
    const offsets = this.getPlayerOffsets(1);
    
    tokenA.setPosition(startTile.x + offsets.A.x, startTile.y + offsets.A.y);
    tokenB.setPosition(startTile.x + offsets.B.x, startTile.y + offsets.B.y);
  }

  // Creates the visual circle representation of the player
  createTokenContainer(color, labelText) {
    const container = this.add.container(0, 0);

    // Draw glowing back shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(color, 0.2);
    shadow.fillCircle(0, 0, 18);

    // Draw main circle
    const circle = this.add.graphics();
    circle.fillStyle(color, 0.85);
    circle.lineStyle(2, 0xffffff, 1);
    circle.fillCircle(0, 0, 12);
    circle.strokeCircle(0, 0, 12);

    // Draw text indicator
    const text = this.add.text(0, 0, labelText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontWeight: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    container.add(shadow);
    container.add(circle);
    container.add(text);
    return container;
  }

  // Offsets players so they do not overlap when standing on the same tile
  getPlayerOffsets(tileId, hasA = true, hasB = true) {
    const posA = this.state?.players?.A?.position || tileId;
    const posB = this.state?.players?.B?.position || tileId;
    
    if (posA === posB) {
      return {
        A: { x: -8, y: -4 },
        B: { x: 8, y: 4 }
      };
    }
    return {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 0 }
    };
  }

  // Synchronize board without animations
  handleSyncState(serverState) {
    this.state = serverState;
    this.isAnimating = false;
    this.clearHighlights();

    // Redraw all tiles based on destroyed status
    this.tiles.forEach(tile => {
      const isDestroyed = !!serverState.destroyedTiles[tile.id];
      const isWarned = serverState.warnedTiles && serverState.warnedTiles.includes(tile.id);
      const tObj = this.tileObjects[tile.id];
      
      if (tObj) {
        this.styleTile(tObj.hex, tile.id, isDestroyed, isWarned);
        
        // Remove old warning icon/tween if exists
        if (tObj.warnIcon) {
          if (tObj.warnTween) tObj.warnTween.stop();
          tObj.warnIcon.destroy();
          tObj.warnIcon = null;
          tObj.warnTween = null;
        }

        if (isDestroyed) {
          tObj.border.lineStyle(2, 0x5a0f1b, 0.8);
          tObj.label.setColor('#5a2d34');
        } else if (isWarned) {
          tObj.border.lineStyle(3, 0xff6600, 1.0); // Orange border
          tObj.label.setColor('#ff9900');

          // Add warning icon
          tObj.warnIcon = this.add.text(0, -14, '⚠️', { fontSize: '13px' }).setOrigin(0.5);
          tObj.container.add(tObj.warnIcon);
          
          tObj.warnTween = this.tweens.add({
            targets: tObj.warnIcon,
            alpha: 0.3,
            scale: 0.8,
            duration: 600,
            yoyo: true,
            repeat: -1
          });
        } else {
          tObj.border.lineStyle(2, 0x3f516d, 0.95);
          tObj.label.setColor(tile.id === 61 ? '#ffcc00' : '#a0aec0');
        }
      }
    });

    // Reset player positions
    Object.keys(serverState.players).forEach(pId => {
      const player = serverState.players[pId];
      const token = this.playerTokens[pId];
      
      if (!player.isAlive) {
        token.setVisible(false);
      } else {
        token.setVisible(true);
        const tile = this.tiles[player.position - 1];
        const offsets = this.getPlayerOffsets(player.position);
        token.setPosition(tile.x + offsets[pId].x, tile.y + offsets[pId].y);
      }
    });
  }

  // Highlights valid target tiles and registers click listeners
  highlightTiles(tileIds) {
    this.clearHighlights();
    this.highlightedTileIds = tileIds;

    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push({
        x: this.hexSize * Math.cos(angle),
        y: this.hexSize * Math.sin(angle)
      });
    }

    tileIds.forEach(tileId => {
      const tObj = this.tileObjects[tileId];
      if (!tObj) return;

      // Draw green highlight glow border
      const glow = this.add.graphics();
      glow.lineStyle(3, 0x00ffcc, 0.85);
      glow.fillStyle(0x00ffcc, 0.15); // Transparent green fill

      glow.beginPath();
      glow.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 6; i++) {
        glow.lineTo(points[i].x, points[i].y);
      }
      glow.closePath();
      glow.fillPath();
      glow.strokePath();

      tObj.container.add(glow);
      tObj.highlightGlow = glow;

      // Make container interactive with Circle hit area
      tObj.container.setInteractive(new Phaser.Geom.Circle(0, 0, this.hexSize), Phaser.Geom.Circle.Contains);
      
      tObj.container.on('pointerover', () => {
        glow.clear();
        glow.lineStyle(4, 0x00ffcc, 1);
        glow.fillStyle(0x00ffcc, 0.35); // Brighter green fill on hover
        glow.beginPath();
        glow.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
          glow.lineTo(points[i].x, points[i].y);
        }
        glow.closePath();
        glow.fillPath();
        glow.strokePath();
        this.input.setDefaultCursor('pointer');

        // Draw guide path to show counting mechanics
        const activePlayer = this.state.currentTurn;
        const currentPos = this.state.players[activePlayer].position;
        const path = findGridPath(currentPos, tileId, this.state.destroyedTiles);
        this.drawGuidePath(path);
      });

      tObj.container.on('pointerout', () => {
        glow.clear();
        glow.lineStyle(3, 0x00ffcc, 0.85);
        glow.fillStyle(0x00ffcc, 0.15);
        glow.beginPath();
        glow.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
          glow.lineTo(points[i].x, points[i].y);
        }
        glow.closePath();
        glow.fillPath();
        glow.strokePath();
        this.input.setDefaultCursor('default');

        // Clear path guide
        this.clearGuidePath();
      });

      tObj.container.on('pointerdown', () => {
        this.input.setDefaultCursor('default');
        this.selectTargetTile(tileId);
      });
    });
  }

  selectTargetTile(tileId) {
    this.clearHighlights();
    this.clearGuidePath();
    this.game.events.emit('TILE_SELECTED', tileId);
  }

  clearHighlights() {
    this.highlightedTileIds = [];
    this.clearGuidePath();
    Object.keys(this.tileObjects).forEach(tileId => {
      const tObj = this.tileObjects[tileId];
      if (tObj.highlightGlow) {
        tObj.highlightGlow.destroy();
        tObj.highlightGlow = null;
      }
      tObj.container.disableInteractive();
      tObj.container.removeAllListeners();
    });
  }

  // Draw arrow / text guide line path to visualize counting path
  drawGuidePath(path) {
    this.clearGuidePath();
    
    this.guideGraphics = this.add.graphics();
    this.boardContainer.add(this.guideGraphics);
    this.guideTexts = [];

    // Line style: Neon cyan path line
    this.guideGraphics.lineStyle(4, 0x00ffcc, 0.85);

    // Draw the connections
    this.guideGraphics.beginPath();
    path.forEach((tileId, index) => {
      const tile = this.tiles[tileId - 1];
      if (index === 0) {
        this.guideGraphics.moveTo(tile.x, tile.y);
      } else {
        this.guideGraphics.lineTo(tile.x, tile.y);
      }
    });
    this.guideGraphics.strokePath();

    // Draw step circles and directional arrows to show counting mechanics
    path.forEach((tileId, index) => {
      if (index === 0) return; // Skip starting position
      const tile = this.tiles[tileId - 1];

      // Draw path node indicator
      this.guideGraphics.fillStyle(0x00ffcc, 0.9);
      this.guideGraphics.fillCircle(tile.x, tile.y, 8);

      // Draw directional arrow on the segment
      const prevTile = this.tiles[path[index - 1] - 1];
      const angle = Phaser.Math.Angle.Between(prevTile.x, prevTile.y, tile.x, tile.y);
      
      const midX = (prevTile.x + tile.x) / 2;
      const midY = (prevTile.y + tile.y) / 2;
      
      this.guideGraphics.fillStyle(0x00ffcc, 1);
      this.guideGraphics.beginPath();
      
      const arrowSize = 6;
      const x1 = midX + arrowSize * Math.cos(angle);
      const y1 = midY + arrowSize * Math.sin(angle);
      const x2 = midX + arrowSize * Math.cos(angle + Math.PI * 0.8);
      const y2 = midY + arrowSize * Math.sin(angle + Math.PI * 0.8);
      const x3 = midX + arrowSize * Math.cos(angle - Math.PI * 0.8);
      const y3 = midY + arrowSize * Math.sin(angle - Math.PI * 0.8);
      
      this.guideGraphics.moveTo(x1, y1);
      this.guideGraphics.lineTo(x2, y2);
      this.guideGraphics.lineTo(x3, y3);
      this.guideGraphics.closePath();
      this.guideGraphics.fillPath();

      // Draw numerical step count badge
      const stepText = this.add.text(tile.x, tile.y - 18, index.toString(), {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#00ffcc',
        backgroundColor: '#05070c',
        padding: { x: 3, y: 1 }
      }).setOrigin(0.5);
      
      this.guideTexts.push(stepText);
      this.boardContainer.add(stepText);
    });
  }

  clearGuidePath() {
    if (this.guideGraphics) {
      this.guideGraphics.destroy();
      this.guideGraphics = null;
    }
    if (this.guideTexts) {
      this.guideTexts.forEach(t => t.destroy());
      this.guideTexts = [];
    }
  }

  // Handle rolling visual feedback (Phase 1)
  async handleRollResult(data) {
    const { state, animationReport } = data;
    this.state = state;
    this.isAnimating = true;
    this.game.events.emit('ANIMATION_START');

    // 1. Play D8 Roll Animation (Floating Text / Shake)
    await this.animateDiceRoll(animationReport);

    if (animationReport.type === 'pass_phase') {
      // Show dice roll first, then reason
      const rollLabel = animationReport.isOverdrive
        ? `🎲 Overdrive! (${animationReport.roll})`
        : animationReport.isLeap
          ? `🎲 Leap! (7)`
          : `🎲 Rolled ${animationReport.roll}`;

      const rollSplash = this.add.text(0, -80, rollLabel, {
        fontFamily: 'Impact, Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      this.boardContainer.add(rollSplash);

      const passText = this.add.text(0, -50, `⚠️ No valid moves — turn passed!`, {
        fontFamily: 'Impact, Arial, sans-serif',
        fontSize: '18px',
        color: '#ffaa00',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      this.boardContainer.add(passText);

      this.tweens.add({
        targets: [rollSplash, passText],
        y: '-=40',
        alpha: 0,
        delay: 1200,
        duration: 900,
        onComplete: () => { rollSplash.destroy(); passText.destroy(); }
      });

      // Play Collapse Animations if B passes
      if (animationReport.collapsedTiles.length > 0) {
        await this.animateCollapse(animationReport);
      }

      this.handleSyncState(state);
      this.isAnimating = false;
      this.game.events.emit('ANIMATION_COMPLETE');
    } else {
      // Highlight valid targets
      this.highlightTiles(animationReport.validTargets);
      this.isAnimating = false;
      this.game.events.emit('ROLL_ANIMATION_COMPLETE');
    }
  }

  // Handle detailed movements after manual selection (Phase 2)
  async handleMoveResult(data) {
    const { state, animationReport } = data;
    this.state = state;
    this.isAnimating = true;
    this.game.events.emit('ANIMATION_START');

    this.clearHighlights();

    // 2. Play Main Player Move Animation (Grid BFS Walking)
    await this.animatePlayerMove(animationReport);

    // 3. Play Bumping Animation (if any)
    if (animationReport.bump) {
      await this.animateBump(animationReport);
    }

    // 3b. Floating DP text events
    if (animationReport.dpEvents && animationReport.dpEvents.length > 0) {
      this.animateDPEvents(animationReport.dpEvents);
    }

    // 4. Play Collapse Animations (if any)
    if (animationReport.collapsedTiles.length > 0) {
      await this.animateCollapse(animationReport);
    }

    this.handleSyncState(state);

    // 5. Check Game Over
    if (state.isGameOver) {
      this.playVictorySplash(state.winner);
    }

    this.isAnimating = false;
    this.game.events.emit('ANIMATION_COMPLETE');
  }

  // Floating rolling numbers effect
  animateDiceRoll(report) {
    return new Promise((resolve) => {
      const activePlayerToken = this.playerTokens[report.playerId];
      
      const rollText = this.add.text(activePlayerToken.x, activePlayerToken.y - 30, '🎲 Rolling...', {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: '#0d1117',
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5);
      
      this.boardContainer.add(rollText);

      let rollTicks = 0;
      const rollInterval = this.time.addEvent({
        delay: 60,
        repeat: 10,
        callback: () => {
          rollTicks++;
          if (rollTicks < 11) {
            const randVal = Phaser.Math.Between(1, 8);
            rollText.setText(`🎲 ${randVal}`);
          } else {
            let resultString = `🎲 ${report.roll}`;
            if (report.isOverdrive) {
              resultString = `🔥 OVERDRIVE D8! (${report.roll})`;
              rollText.setColor('#ff4500');
            } else if (report.isLeap) {
              resultString = `🚀 LEAP! (7)`;
              rollText.setColor('#00ffff');
            }
            rollText.setText(resultString);

            this.tweens.add({
              targets: rollText,
              y: rollText.y - 25,
              alpha: 0,
              scaleX: 1.2,
              scaleY: 1.2,
              duration: 800,
              onComplete: () => {
                rollText.destroy();
                resolve();
              }
            });
          }
        }
      });
    });
  }

  // Walk step-by-step along the BFS path on the grid
  animatePlayerMove(report) {
    return new Promise((resolve) => {
      const pId = report.playerId;
      const token = this.playerTokens[pId];
      const startPos = report.startPositions[pId];
      const endPos = report.endPositions[pId];

      if (startPos === endPos) {
        resolve();
        return;
      }

      // BFS Pathfinder to get actual grid-based step-by-step path!
      const path = findGridPath(startPos, endPos, this.state.destroyedTiles);

      // Create tween chain
      let chain = this.tweens.add({
        targets: token,
        duration: 0
      });

      path.forEach((tileId, index) => {
        if (index === 0) return; // Skip starting tile
        const tile = this.tiles[tileId - 1];
        
        const isLastStep = index === path.length - 1;
        const offsets = isLastStep ? this.getPlayerOffsets(tile.id) : { A: { x:0, y:0 }, B: { x:0, y:0 } };
        const offset = offsets[pId];

        chain = this.tweens.add({
          targets: token,
          x: tile.x + offset.x,
          y: tile.y + offset.y,
          duration: 220, // Grid walk speed
          ease: 'Quad.easeInOut',
          delay: 30,
          onComplete: () => {
            if (isLastStep) {
              resolve();
            }
          }
        });
      });
    });
  }

  // Slides bumped player backward
  animateBump(report) {
    return new Promise((resolve) => {
      const { opponentId, distance, intoAbyss } = report.bump;
      const opponentToken = this.playerTokens[opponentId];
      const startPos = report.startPositions[opponentId];
      const endPos = report.endPositions[opponentId];

      // Build step-by-step tile path walking backward by tile ID.
      // This matches exactly how the server walked (step by step, stopping at destroyed/edge).
      const stepTiles = [];
      for (let i = startPos; i >= endPos; i--) {
        const tile = this.tiles[i - 1];
        if (tile) stepTiles.push(tile);
      }

      if (stepTiles.length <= 1) {
        resolve();
        return;
      }

      // Camera shake
      this.cameras.main.shake(150, 0.012);

      // Combat text popup
      const hitText = this.add.text(opponentToken.x, opponentToken.y - 20, `💥 BUMP -${distance}!`, {
        fontFamily: 'Impact, Arial, sans-serif',
        fontSize: '18px',
        color: '#ff3333',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      this.boardContainer.add(hitText);

      this.tweens.add({
        targets: hitText,
        y: hitText.y - 30,
        alpha: 0,
        duration: 600,
        onComplete: () => hitText.destroy()
      });

      // Animate backwards slides
      let chain = this.tweens.add({
        targets: opponentToken,
        duration: 0
      });

      stepTiles.forEach((tile, index) => {
        if (index === 0) return;
        const isLastStep = index === stepTiles.length - 1;
        const offsets = isLastStep ? this.getPlayerOffsets(tile.id) : { A: { x:0, y:0 }, B: { x:0, y:0 } };
        const offset = offsets[opponentId];

        chain = this.tweens.add({
          targets: opponentToken,
          x: tile.x + offset.x,
          y: tile.y + offset.y,
          duration: 120, // Slide back speed
          ease: 'Quad.easeOut',
          onComplete: () => {
            if (isLastStep) {
              if (intoAbyss) {
                this.playEliminationEffect(opponentToken, "FALLEN!");
              }
              resolve();
            }
          }
        });
      });
    });
  }

  // Flashes collapsing tiles red then fades them out
  animateCollapse(report) {
    return new Promise((resolve) => {
      const collapsedIds = report.collapsedTiles;
      let count = 0;

      // Shake camera
      this.cameras.main.shake(300, 0.015);

      collapsedIds.forEach(tileId => {
        const tObj = this.tileObjects[tileId];
        if (!tObj) return;

        // Flash tile red
        const flashGraphic = this.add.graphics();
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i - 30);
          points.push({
            x: this.hexSize * Math.cos(angle),
            y: this.hexSize * Math.sin(angle)
          });
        }
        flashGraphic.fillStyle(0xff0000, 0.8);
        flashGraphic.beginPath();
        flashGraphic.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
          flashGraphic.lineTo(points[i].x, points[i].y);
        }
        flashGraphic.closePath();
        flashGraphic.fillPath();
        
        tObj.container.add(flashGraphic);

        this.tweens.add({
          targets: flashGraphic,
          alpha: 0,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 600,
          onComplete: () => {
            flashGraphic.destroy();
            this.styleTile(tObj.hex, tileId, true);
            tObj.border.lineStyle(2, 0x5a0f1b, 0.8);
            tObj.border.strokePath();
            tObj.label.setColor('#5a2d34');
            
            // Check if players are standing on this tile and play elimination
            report.eliminated.forEach(pId => {
              const token = this.playerTokens[pId];
              const dist = Phaser.Math.Distance.Between(token.x, token.y, this.tiles[tileId-1].x, this.tiles[tileId-1].y);
              if (dist < 10) {
                this.playEliminationEffect(token, "COLLAPSED!");
              }
            });

            count++;
            if (count === collapsedIds.length) {
              this.time.delayedCall(400, () => resolve());
            }
          }
        });
      });
    });
  }

  // Standard elimination visual sequence
  playEliminationEffect(token, textStr) {
    const splashText = this.add.text(token.x, token.y - 15, textStr, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#ff2222',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    this.boardContainer.add(splashText);

    this.tweens.add({
      targets: splashText,
      y: splashText.y - 25,
      alpha: 0,
      duration: 1000,
      onComplete: () => splashText.destroy()
    });

    this.tweens.add({
      targets: token,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
      angle: 180,
      duration: 500,
      onComplete: () => {
        token.setVisible(false);
        token.setAlpha(1);
        token.setScale(1);
        token.setAngle(0);
      }
    });
  }

  // Floating DP gain/loss text anchored to the relevant player's token
  animateDPEvents(dpEvents) {
    dpEvents.forEach((event, index) => {
      const token = this.playerTokens[event.playerId];
      if (!token) return;

      const isGain = event.amount > 0;
      let color = isGain ? '#00ff88' : '#ff4444';
      let fontSize = '13px';
      let duration = 900;
      let targetScale = 1.15;

      if (event.isTarget) {
        color = '#00ffff'; // Cyan
        fontSize = '16px';
        duration = 1500;
        targetScale = 1.3;
      }

      const offsetY = -35 - index * 18; // Stack multiple events vertically

      const dpText = this.add.text(token.x, token.y + offsetY, event.label, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: fontSize,
        fontWeight: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5);
      this.boardContainer.add(dpText);

      this.tweens.add({
        targets: dpText,
        y: dpText.y - 40,
        alpha: 0,
        scaleX: targetScale,
        scaleY: targetScale,
        delay: index * 120, // Stagger each event
        duration: duration,
        ease: 'Quad.easeOut',
        onComplete: () => dpText.destroy()
      });
    });
  }

  // Victory banner splash — shows win type subtitle
  playVictorySplash(winner) {
    const state = this.state;
    const { width, height } = this.scale;

    let bannerColor = 0x1f2937;
    let titleText = 'DRAW!';
    let titleColor = '#ffcc00';
    let subtitleText = '';

    if (winner === 'A') {
      bannerColor = 0x003d7a;
      titleText = 'PLAYER A WINS!';
      titleColor = '#00bfff';
      subtitleText = state.winType === 'domination' ? '🏆 DOMINATION WIN — 100 DP!' : '💀 SURVIVAL WIN';
    } else if (winner === 'B') {
      bannerColor = 0x7a3d00;
      titleText = 'PLAYER B WINS!';
      titleColor = '#ff8c00';
      subtitleText = state.winType === 'domination' ? '🏆 DOMINATION WIN — 100 DP!' : '💀 SURVIVAL WIN';
    }

    const banner = this.add.graphics();
    banner.fillStyle(bannerColor, 0.9);
    banner.fillRect(0, height / 2 - 65, width, 130);

    const txt = this.add.text(width / 2, height / 2 - 12, titleText, {
      fontFamily: 'Impact, Arial, sans-serif',
      fontSize: '40px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);

    const sub = this.add.text(width / 2, height / 2 + 28, subtitleText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    txt.setScale(0.1);
    sub.setAlpha(0);

    this.tweens.add({
      targets: txt,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: sub, alpha: 1, duration: 300 });
      }
    });

    this.game.events.once('SYNC_STATE', () => {
      banner.destroy();
      txt.destroy();
      sub.destroy();
    });
  }
}
