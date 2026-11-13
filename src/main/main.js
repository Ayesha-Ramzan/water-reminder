const path = require('path');
const { app, ipcMain } = require('electron');
const { createStore } = require('./store');
const { createScheduler } = require('./scheduler');
const { createTray } = require('./tray');
const windows = require('./windows');
const { CHARACTERS, RANDOM_POOL, DIRECTIONS, LIMITS } = require('../logic/settings');
const { loadCharacter } = require('./characters');
const { createReminderFlow } = require('../logic/flow');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let store;
let settings;
let scheduler;
let tray;
const flow = createReminderFlow();

function pickCharacter() {
  if (settings.character !== 'random') return settings.character;
  return RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
}

function pickDirection() {
  if (settings.enterFrom !== 'random') return settings.enterFrom;
  const edges = DIRECTIONS.filter((d) => d !== 'random');
  return edges[Math.floor(Math.random() * edges.length)];
}

function showReminder() {
  if (windows.isPopupOpen()) return;
  const daily = store.loadDaily();
  windows.openPopup({
    character: loadCharacter(pickCharacter()),
    enterFrom: pickDirection(),
    snoozeMin: settings.snoozeMin,
    canSnooze: flow.canSnooze(),
    count: daily.count,
    goal: settings.dailyGoal,
  });
}

function onFire() {
  flow.onFire();
  showReminder();
}

function applyLoginItem() {
  try {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart });
  } catch (err) {
    console.error('login item:', err.message);
  }
}

function registerIpc() {
  ipcMain.handle('reminder:yes', () => {
    flow.reset();
    let count = store.loadDaily().count;
    try {
      count = store.addDrink().count;
    } catch (err) {
      console.error('could not save count:', err.message);
    }
    scheduler.scheduleNext();
    return { count, goal: settings.dailyGoal, reached: count >= settings.dailyGoal };
  });

  ipcMain.handle('reminder:snooze', () => {
    const when = flow.snooze(new Date(), settings.snoozeMin);
    if (!when) return { ok: false };
    scheduler.fireAt(when);
    return { ok: true, snoozeMin: settings.snoozeMin };
  });

  ipcMain.on('popup:close', () => windows.closePopup());
  ipcMain.on('popup:interactive', (_e, on) => windows.setPopupInteractive(on === true));

  ipcMain.handle('settings:get', () => ({
    settings,
    limits: LIMITS,
    directions: DIRECTIONS,
    characters: CHARACTERS.map((id) => ({ id, name: loadCharacter(id).name })),
  }));
  ipcMain.handle('settings:save', (_e, data) => {
    let result;
    try {
      result = store.saveSettings(data);
    } catch (err) {
      return { valid: false, errors: { _form: `Could not save: ${err.message}` }, settings };
    }
    if (result.valid) {
      settings = result.value;
      applyLoginItem();
      flow.reset();
      if (!scheduler.isPaused()) scheduler.scheduleNext();
    }
    return { valid: result.valid, errors: result.errors, settings };
  });
}

if (gotLock) app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  store = createStore(app.getPath('userData'));
  settings = store.loadSettings();
  scheduler = createScheduler({ getSettings: () => settings, onFire });
  registerIpc();
  applyLoginItem();
  tray = createTray({
    isPaused: () => scheduler.isPaused(),
    onTogglePause: () => {
      flow.reset();
      if (scheduler.isPaused()) scheduler.resume();
      else scheduler.pause();
    },
    onRemindNow: () => {
      flow.reset();
      showReminder();
    },
    onSettings: windows.openSettings,
    onQuit: () => app.quit(),
  });
  scheduler.scheduleNext();
});

// Tray app: keep running with no windows open.
app.on('window-all-closed', () => {});
app.on('second-instance', windows.openSettings);
