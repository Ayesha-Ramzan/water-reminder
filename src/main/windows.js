const path = require('path');
const { BrowserWindow, screen } = require('electron');

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');
// Wide enough for the character to walk in from the screen edge.
const POPUP_SIZE = { width: 520, height: 460 };
const MARGIN = 16;
// Fixed title so window managers (e.g. Hyprland rules) can match the popup.
const POPUP_TITLE = 'Water Reminder Popup';

const webPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

// Per-pixel click-through needs `forward` mouse events, which Linux does not support.
const CAN_CLICK_THROUGH = process.platform !== 'linux';

let popup = null;
let settingsWin = null;

// Corner of the primary display that matches the edge the character enters from.
function popupBounds(enterFrom) {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const left = x + MARGIN;
  const right = x + width - POPUP_SIZE.width - MARGIN;
  const top = y + MARGIN;
  const bottom = y + height - POPUP_SIZE.height - MARGIN;
  return {
    ...POPUP_SIZE,
    x: enterFrom === 'left' ? left : right,
    y: enterFrom === 'top' ? top : bottom,
  };
}

function openPopup(payload) {
  if (popup && !popup.isDestroyed()) {
    popup.webContents.send('popup:show', payload);
    return popup;
  }
  popup = new BrowserWindow({
    ...popupBounds(payload.enterFrom),
    title: POPUP_TITLE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    fullscreenable: false,
    webPreferences,
  });
  popup.setAlwaysOnTop(true, 'screen-saver');
  popup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (CAN_CLICK_THROUGH) popup.setIgnoreMouseEvents(true, { forward: true });
  popup.loadFile(path.join(RENDERER, 'popup', 'index.html'));
  popup.webContents.once('did-finish-load', () => {
    popup.webContents.send('popup:show', payload);
    popup.showInactive();
  });
  popup.on('closed', () => {
    popup = null;
  });
  return popup;
}

function setPopupInteractive(on) {
  if (!CAN_CLICK_THROUGH || !popup || popup.isDestroyed()) return;
  if (on) popup.setIgnoreMouseEvents(false);
  else popup.setIgnoreMouseEvents(true, { forward: true });
}

function closePopup() {
  if (popup && !popup.isDestroyed()) popup.close();
}

function isPopupOpen() {
  return !!popup && !popup.isDestroyed();
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 440,
    height: 720,
    title: 'Water Reminder Settings',
    autoHideMenuBar: true,
    resizable: false,
    webPreferences,
  });
  settingsWin.removeMenu();
  settingsWin.loadFile(path.join(RENDERER, 'settings', 'index.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

module.exports = { POPUP_TITLE, openPopup, closePopup, isPopupOpen, setPopupInteractive, openSettings };
