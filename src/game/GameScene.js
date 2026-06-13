// GameScene.js
// Renders the board, player tokens, path, and runs step-by-step animations.

import Phaser from 'phaser';
import { getSpiralCoordinates, getRingNumber } from './BoardGeometry';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.tiles = [];
    this.tileObjects = {}; // tileId -> { container, hex, text }
    this.playerTokens = {}; // 'A', 'B' -> token container
    this.isAnimating = false;
    this.hexSize = 38; // Radius of each hex
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
      border.lineStyle(2, 0x2d3748, 0.9); // Dark blue-gray border
      
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
      this.boardContainer.add(container);

      // Save references
      this.tileObjects[tile.id] = { container, hex, border, label };
    });
  }

  // Styles tiles depending on state
  styleTile(graphics, tileId, isDestroyed) {
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
    } else {
      // Ring-based colors for gradient space visual depth
      const ring = getRingNumber(tileId);
      if (tileId === 61) {
        graphics.fillStyle(0x2d1f00, 0.95); // Golden center tile
      } else {
        const colors = [
          0x141824, // Ring 4
          0x161c2d, // Ring 3
          0x1b2238, // Ring 2
          0x212a45  // Ring 1
        ];
        graphics.fillStyle(colors[4 - ring] || 0x141824, 0.95);
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
    // If they occupy the same tile, offset them
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

  // Synchronize board without animations (e.g., on restart/init)
  handleSyncState(serverState) {
    this.state = serverState;
    this.isAnimating = false;

    // Redraw all tiles based on destroyed status
    this.tiles.forEach(tile => {
      const isDestroyed = !!serverState.destroyedTiles[tile.id];
      const tObj = this.tileObjects[tile.id];
      if (tObj) {
        this.styleTile(tObj.hex, tile.id, isDestroyed);
        if (isDestroyed) {
          tObj.border.lineStyle(2, 0x5a0f1b, 0.8);
          tObj.label.setColor('#5a2d34');
        } else {
          tObj.border.lineStyle(2, 0x2d3748, 0.9);
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

  // Handle detailed animations based on roll report
  async handleRollResult(data) {
    const { state, animationReport } = data;
    this.state = state;
    this.isAnimating = true;
    this.game.events.emit('ANIMATION_START');

    // 1. Play D8 Roll Animation (Floating Text / Shake)
    await this.animateDiceRoll(animationReport);

    // 2. Play Main Player Move Animation (Tile-by-Tile)
    await this.animatePlayerMove(animationReport);

    // 3. Play Bumping Animation (if any)
    if (animationReport.bump) {
      await this.animateBump(animationReport);
    }

    // 4. Play Collapse Animations (if any)
    if (animationReport.collapsedTiles.length > 0) {
      await this.animateCollapse(animationReport);
    }

    // Update visibility and positions to absolute final sync
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
      
      // Floating text near player token
      const rollText = this.add.text(activePlayerToken.x, activePlayerToken.y - 30, '🎲 Rolling...', {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: '#0d1117',
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5);
      
      this.boardContainer.add(rollText);

      // Rapidly change numbers to simulate dice rolling
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
            // Settled on actual roll
            let resultString = `🎲 ${report.roll}`;
            if (report.isOverdrive) {
              resultString = `🔥 OVERDRIVE D8! (${report.roll})`;
              rollText.setColor('#ff4500');
            } else if (report.isLeap) {
              resultString = `🚀 LEAP! (7)`;
              rollText.setColor('#00ffff');
            }
            rollText.setText(resultString);

            // Animate scale up and fade out
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

  // Walk tile-by-tile along the spiral path
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

      // Generate step-by-step positions
      const stepTiles = [];
      for (let i = startPos; i <= endPos; i++) {
        stepTiles.push(this.tiles[i - 1]);
      }

      // Create tween chain
      let chain = this.tweens.add({
        targets: token,
        duration: 0
      });

      stepTiles.forEach((tile, index) => {
        if (index === 0) return; // Skip starting tile since player is already there
        
        // Offset if they land on the same tile (only matters at the very end of the movement)
        const isLastStep = index === stepTiles.length - 1;
        const offsets = isLastStep ? this.getPlayerOffsets(tile.id) : { A: { x:0, y:0 }, B: { x:0, y:0 } };
        const offset = offsets[pId];

        chain = this.tweens.add({
          targets: token,
          x: tile.x + offset.x,
          y: tile.y + offset.y,
          duration: 180, // Time per step (fast but distinct)
          ease: 'Quad.easeInOut',
          delay: 20,
          onComplete: () => {
            if (isLastStep) {
              // Check if player fell into abyss on landing
              if (report.playerEliminatedByAbyss) {
                this.playEliminationEffect(token, "ABYSS!");
              }
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

      // Generate intermediate step positions for smooth backslide
      const stepTiles = [];
      for (let i = startPos; i >= endPos; i--) {
        stepTiles.push(this.tiles[i - 1]);
      }

      if (stepTiles.length <= 1) {
        resolve();
        return;
      }

      // Camera shake on initial hit
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
          duration: 120, // Slide backward slightly faster
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
            // Restyle tile to destroyed dark red color
            this.styleTile(tObj.hex, tileId, true);
            tObj.border.lineStyle(2, 0x5a0f1b, 0.8);
            tObj.border.strokePath();
            tObj.label.setColor('#5a2d34');
            
            // Check if players are standing on this tile and play elimination
            report.eliminated.forEach(pId => {
              const token = this.playerTokens[pId];
              // Find if the token is close to this tile's coordinates
              const dist = Phaser.Math.Distance.Between(token.x, token.y, this.tiles[tileId-1].x, this.tiles[tileId-1].y);
              if (dist < 10) {
                this.playEliminationEffect(token, "COLLAPSED!");
              }
            });

            count++;
            if (count === collapsedIds.length) {
              // Give extra time for player elimination animations to show
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

  // Victory dynamic title splash
  playVictorySplash(winner) {
    const { width, height } = this.scale;

    let bannerColor = 0x1f2937;
    let titleText = 'DRAW!';
    let titleColor = '#ffcc00';

    if (winner === 'A') {
      bannerColor = 0x00bfff;
      titleText = 'PLAYER A WINS!';
      titleColor = '#ffffff';
    } else if (winner === 'B') {
      bannerColor = 0xff8c00;
      titleText = 'PLAYER B WINS!';
      titleColor = '#ffffff';
    }

    const banner = this.add.graphics();
    banner.fillStyle(bannerColor, 0.85);
    banner.fillRect(0, height / 2 - 60, width, 120);

    const txt = this.add.text(width / 2, height / 2, titleText, {
      fontFamily: 'Impact, Arial, sans-serif',
      fontSize: '42px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);

    // Zoom and fade
    txt.setScale(0.1);
    this.tweens.add({
      targets: txt,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Remove victory splash after 3 seconds or on restart event
    this.game.events.once('SYNC_STATE', () => {
      banner.destroy();
      txt.destroy();
    });
  }
}
