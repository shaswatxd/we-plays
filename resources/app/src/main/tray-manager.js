const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let mainWindow = null;
let isPlaying = false;
let animationInterval = null;
let animationFrame = 0;
let isQuittingRef = null;

// We'll generate multiple animation frames for the tray icon
// Each frame slightly rotates a glow effect around the circular icon
const TRAY_SIZE = 32; // Windows tray icon size
const ANIMATION_FRAMES = 12;
const ANIMATION_SPEED = 150; // ms per frame

/**
 * Creates a circular tray icon with optional animated glow
 * Uses Canvas-like drawing via nativeImage raw pixel manipulation
 */
function createCircularIcon(frame = 0, playing = false) {
  const size = TRAY_SIZE;
  const buffer = Buffer.alloc(size * size * 4); // RGBA

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1;
  const innerRadius = radius - 2;

  // Glow animation angle
  const glowAngle = (frame / ANIMATION_FRAMES) * Math.PI * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Inside the circle
        const angle = Math.atan2(dy, dx);

        if (dist > innerRadius) {
          // Border ring
          if (playing) {
            // Animated gradient border when playing
            const angleDiff = Math.abs(((angle - glowAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            const glow = Math.max(0, 1 - angleDiff / Math.PI);

            // Purple to cyan gradient
            const r = Math.round(130 + glow * 80);
            const g = Math.round(50 + glow * 180);
            const b = Math.round(200 + glow * 55);
            buffer[idx] = r;     // R
            buffer[idx + 1] = g; // G
            buffer[idx + 2] = b; // B
            buffer[idx + 3] = 255;
          } else {
            // Static subtle border when paused
            buffer[idx] = 100;
            buffer[idx + 1] = 80;
            buffer[idx + 2] = 160;
            buffer[idx + 3] = 200;
          }
        } else {
          // Inner fill - dark background
          const normDist = dist / innerRadius;
          const shade = Math.round(15 + (1 - normDist) * 10);
          buffer[idx] = shade;
          buffer[idx + 1] = shade;
          buffer[idx + 2] = Math.round(shade * 1.3);
          buffer[idx + 3] = 255;

          // Draw play or pause symbol
          const symbolCx = cx;
          const symbolCy = cy;
          const symbolSize = size * 0.28;

          if (playing) {
            // Draw PAUSE symbol (two vertical bars)
            const barWidth = symbolSize * 0.3;
            const barHeight = symbolSize * 1.4;
            const barGap = symbolSize * 0.35;

            const leftBarX = symbolCx - barGap - barWidth / 2;
            const rightBarX = symbolCx + barGap - barWidth / 2;
            const barTop = symbolCy - barHeight / 2;

            const inLeftBar = x >= leftBarX && x <= leftBarX + barWidth && y >= barTop && y <= barTop + barHeight;
            const inRightBar = x >= rightBarX && x <= rightBarX + barWidth && y >= barTop && y <= barTop + barHeight;

            if (inLeftBar || inRightBar) {
              // Gradient white-to-cyan for the bars
              const barProgress = (y - barTop) / barHeight;
              buffer[idx] = Math.round(200 + barProgress * 55);
              buffer[idx + 1] = Math.round(220 + barProgress * 35);
              buffer[idx + 2] = 255;
              buffer[idx + 3] = 255;
            }
          } else {
            // Draw PLAY symbol (triangle pointing right)
            const triCx = symbolCx + symbolSize * 0.1; // Slight right offset for visual centering
            const triSize = symbolSize * 0.9;

            // Triangle vertices
            const triLeft = triCx - triSize * 0.5;
            const triRight = triCx + triSize * 0.6;
            const triTop = symbolCy - triSize * 0.7;
            const triBottom = symbolCy + triSize * 0.7;

            // Point-in-triangle test
            const triHeight = triBottom - triTop;
            const yProgress = (y - triTop) / triHeight;

            if (yProgress >= 0 && yProgress <= 1) {
              const halfWidth = (yProgress <= 0.5)
                ? yProgress * (triRight - triLeft)
                : (1 - yProgress) * (triRight - triLeft);
              const lineLeft = triLeft;
              const lineRight = triLeft + halfWidth * 2;

              // Simplified triangle: left edge to right point
              const localY = y - triTop;
              const midY = triHeight / 2;
              let xLeft, xRight;
              if (localY <= midY) {
                // Top half
                xLeft = triLeft + (triRight - triLeft) * 0 ;
                xRight = triLeft + (localY / midY) * (triRight - triLeft);
              } else {
                // Bottom half
                xLeft = triLeft;
                xRight = triLeft + ((triHeight - localY) / midY) * (triRight - triLeft);
              }

              if (x >= xLeft && x <= xRight) {
                buffer[idx] = 180;
                buffer[idx + 1] = 160;
                buffer[idx + 2] = 220;
                buffer[idx + 3] = 255;
              }
            }
          }
        }
      } else {
        // Outside circle - transparent
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * Try to create a round icon from the app's icon.png by masking it circular.
 * Falls back to the generated pixel icon above.
 */
function createRoundIconFromFile() {
  try {
    const iconPath = path.join(__dirname, '../../assets/icons/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    const resized = icon.resize({ width: TRAY_SIZE, height: TRAY_SIZE, quality: 'best' });
    const bitmap = resized.toBitmap();
    const size = TRAY_SIZE;

    // Apply circular mask
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 1;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) {
          // Make pixels outside circle transparent
          bitmap[idx] = 0;
          bitmap[idx + 1] = 0;
          bitmap[idx + 2] = 0;
          bitmap[idx + 3] = 0;
        } else if (dist > radius - 1.5) {
          // Anti-aliased edge
          const alpha = Math.max(0, Math.min(255, Math.round((radius - dist) * 170)));
          bitmap[idx + 3] = Math.min(bitmap[idx + 3], alpha);
        }
      }
    }

    return nativeImage.createFromBuffer(Buffer.from(bitmap), { width: size, height: size });
  } catch (e) {
    console.error('Failed to create round icon from file, using generated:', e);
    return createCircularIcon(0, false);
  }
}

// Cache the static round icon
let staticRoundIcon = null;

function getStaticRoundIcon() {
  if (!staticRoundIcon) {
    staticRoundIcon = createRoundIconFromFile();
  }
  return staticRoundIcon;
}

/**
 * Rebuild the tray context menu with current play state
 */
function rebuildContextMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show We Plays',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: isPlaying ? 'Pause' : 'Play',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('player-toggle-play');
      }
    },
    {
      label: 'Next Track',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('player-next');
      }
    },
    {
      label: 'Previous Track',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('player-previous');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit We Plays',
      click: () => {
        if (isQuittingRef) isQuittingRef();
        const { app } = require('electron');
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Start the tray icon animation (spinning glow border)
 */
function startAnimation() {
  stopAnimation();
  animationFrame = 0;

  animationInterval = setInterval(() => {
    if (!tray) {
      stopAnimation();
      return;
    }
    animationFrame = (animationFrame + 1) % ANIMATION_FRAMES;
    const icon = createCircularIcon(animationFrame, true);
    try {
      tray.setImage(icon);
    } catch (e) {
      // tray may have been destroyed
      stopAnimation();
    }
  }, ANIMATION_SPEED);
}

/**
 * Stop the tray icon animation and set static icon
 */
function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  if (tray) {
    try {
      tray.setImage(getStaticRoundIcon());
    } catch (e) {
      // tray destroyed
    }
  }
}

/**
 * Create and set up the system tray
 */
function createTray(win, setQuitting) {
  mainWindow = win;
  isQuittingRef = setQuitting;

  // Start with static round icon
  const icon = getStaticRoundIcon();
  tray = new Tray(icon);

  tray.setToolTip('We Plays — Music Player');
  rebuildContextMenu();

  // Single click to show window (not double-click)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}

/**
 * Update the play state — called from IPC when renderer reports state change
 */
function updatePlayState(playing, songInfo) {
  isPlaying = playing;

  // Update tooltip with current song info
  if (tray) {
    if (songInfo && songInfo.title) {
      const artist = songInfo.artist || 'Unknown Artist';
      tray.setToolTip(`We Plays — ${playing ? '▶' : '⏸'} ${songInfo.title} • ${artist}`);
    } else {
      tray.setToolTip('We Plays — Music Player');
    }
  }

  // Rebuild context menu with correct Play/Pause label
  rebuildContextMenu();

  // Start or stop animation
  if (playing) {
    startAnimation();
  } else {
    stopAnimation();
  }
}

/**
 * Destroy the tray
 */
function destroyTray() {
  stopAnimation();
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Get the tray instance
 */
function getTray() {
  return tray;
}

module.exports = {
  createTray,
  destroyTray,
  getTray,
  updatePlayState,
  rebuildContextMenu
};
