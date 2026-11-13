const { Tray, Menu, nativeImage } = require('electron');

// 16x16 water drop drawn in code, so no image file is needed.
function dropIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const mac = process.platform === 'darwin';
  const [r, g, b] = mac ? [0, 0, 0] : [30, 144, 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - 7.5;
      const inBody = Math.hypot(dx, y - 10) <= 5.2;
      const inTip = y >= 1 && y < 8 && Math.abs(dx) <= (y - 1) * 0.75;
      if (inBody || inTip) {
        const i = (y * size + x) * 4;
        buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255; // BGRA
      }
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size });
  if (mac) img.setTemplateImage(true);
  return img;
}

function createTray({ isPaused, onTogglePause, onRemindNow, onSettings, onQuit }) {
  const tray = new Tray(dropIcon());
  tray.setToolTip('Water Reminder');
  const refresh = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: isPaused() ? 'Resume' : 'Pause', click: () => { onTogglePause(); refresh(); } },
        { label: 'Remind now', click: onRemindNow },
        { label: 'Settings', click: onSettings },
        { type: 'separator' },
        { label: 'Quit', click: onQuit },
      ]),
    );
  };
  refresh();
  return tray;
}

module.exports = { createTray };
