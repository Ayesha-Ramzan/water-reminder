const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../../src/main/store');
const { DEFAULTS } = require('../../src/logic/settings');

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('missing files give defaults and zero count', () => {
  const s = createStore(dir);
  expect(s.loadSettings()).toEqual(DEFAULTS);
  expect(s.loadDaily(new Date(2026, 0, 5, 10)).count).toBe(0);
});

test('settings and count survive a restart (new store, same dir)', () => {
  const a = createStore(dir);
  const res = a.saveSettings({ ...DEFAULTS, intervalMin: 45, dailyGoal: 6 });
  expect(res.valid).toBe(true);
  const now = new Date(2026, 0, 5, 10);
  a.addDrink(now); a.addDrink(now);
  const b = createStore(dir);
  expect(b.loadSettings().intervalMin).toBe(45);
  expect(b.loadDaily(now).count).toBe(2);
});

test('count resets on a new local day', () => {
  const s = createStore(dir);
  s.addDrink(new Date(2026, 0, 5, 23, 59));
  expect(s.loadDaily(new Date(2026, 0, 6, 0, 0)).count).toBe(0);
});

test('invalid settings are rejected and not written', () => {
  const s = createStore(dir);
  const res = s.saveSettings({ ...DEFAULTS, intervalMin: 5 });
  expect(res.valid).toBe(false);
  expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(false);
});

test('corrupt files fall back to defaults', () => {
  fs.writeFileSync(path.join(dir, 'settings.json'), '{not json');
  fs.writeFileSync(path.join(dir, 'daily.json'), 'xx');
  const s = createStore(dir);
  expect(s.loadSettings()).toEqual(DEFAULTS);
  expect(s.loadDaily(new Date()).count).toBe(0);
});
