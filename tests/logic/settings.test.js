const { validateSettings, mergeWithDefaults, DEFAULTS, CHARACTERS } = require('../../src/logic/settings');

const withField = (k, v) => validateSettings({ ...DEFAULTS, [k]: v });

describe('validateSettings', () => {
  test('defaults are valid', () => {
    const r = validateSettings({});
    expect(r.valid).toBe(true);
    expect(r.value).toEqual(DEFAULTS);
  });
  test.each([[14, false], [15, true], [240, true], [241, false]])('interval %p -> %p', (v, ok) => {
    const r = withField('intervalMin', v);
    expect(r.valid).toBe(ok);
    if (!ok) expect(r.errors.intervalMin).toBeDefined();
  });
  test.each([[0, false], [1, true], [20, true], [21, false]])('goal %p -> %p', (v, ok) => {
    expect(withField('dailyGoal', v).valid).toBe(ok);
  });
  test.each([[0, false], [1, true], [30, true], [31, false]])('snooze %p -> %p', (v, ok) => {
    expect(withField('snoozeMin', v).valid).toBe(ok);
  });
  test('rejects non-integers', () => {
    for (const v of [30.5, 'abc', '', NaN, null, {}, '1.5']) {
      expect(withField('intervalMin', v).valid).toBe(false);
    }
  });
  test('coerces numeric strings', () => {
    expect(withField('intervalMin', '30').value.intervalMin).toBe(30);
  });
  test.each(['9:00', '24:00', '12:60', 'abc', '', 900, null])('bad time %p', (v) => {
    const r = withField('startTime', v);
    expect(r.valid).toBe(false);
    expect(r.errors.startTime).toBeDefined();
  });
  test('start == end rejected', () => {
    const r = validateSettings({ ...DEFAULTS, startTime: '10:00', endTime: '10:00' });
    expect(r.valid).toBe(false);
    expect(r.errors.endTime).toBeDefined();
  });
  test('overnight range valid', () => {
    expect(validateSettings({ ...DEFAULTS, startTime: '22:00', endTime: '06:00' }).valid).toBe(true);
  });
  test('character', () => {
    for (const c of ['random', ...CHARACTERS]) expect(withField('character', c).valid).toBe(true);
    expect(withField('character', 'bob').errors.character).toBeDefined();
  });
  test('autoStart must be boolean', () => {
    expect(withField('autoStart', true).valid).toBe(true);
    expect(withField('autoStart', 'yes').valid).toBe(false);
  });
  test('drops unknown keys, null value when invalid', () => {
    expect(validateSettings({ ...DEFAULTS, evil: 1 }).value).not.toHaveProperty('evil');
    expect(withField('intervalMin', 1).value).toBeNull();
  });
  test('non-object input', () => {
    expect(validateSettings(null).valid).toBe(true);
  });
});

describe('mergeWithDefaults', () => {
  test('fills missing and replaces invalid', () => {
    const r = mergeWithDefaults({ intervalMin: 999, dailyGoal: 5, junk: 1 });
    expect(r).toEqual({ ...DEFAULTS, dailyGoal: 5 });
  });
  test('handles garbage and start==end', () => {
    expect(mergeWithDefaults('x')).toEqual(DEFAULTS);
    const r = mergeWithDefaults({ startTime: '10:00', endTime: '10:00' });
    expect(validateSettings(r).valid).toBe(true);
  });
});

describe('enterFrom', () => {
  const { validateSettings, DEFAULTS } = require('../../src/logic/settings');
  test.each(['random', 'left', 'right', 'top', 'bottom'])('accepts %s', (d) => {
    expect(validateSettings({ ...DEFAULTS, enterFrom: d }).valid).toBe(true);
  });
  test.each(['up', '', null, 3])('rejects %p', (d) => {
    const r = validateSettings({ ...DEFAULTS, enterFrom: d });
    expect(r.valid).toBe(false);
    expect(r.errors.enterFrom).toBeDefined();
  });
  test('defaults to random', () => {
    expect(DEFAULTS.enterFrom).toBe('random');
  });
});

test('random pool only holds selectable characters (girl, boy, cat); old placeholders are not selectable', () => {
  const { RANDOM_POOL, CHARACTERS } = require('../../src/logic/settings');
  expect(RANDOM_POOL).toEqual(['girl', 'boy', 'cat']);
  for (const id of RANDOM_POOL) expect(CHARACTERS).toContain(id);
  expect(validateSettings({ ...DEFAULTS, character: 'luna' }).valid).toBe(false);
  expect(validateSettings({ ...DEFAULTS, character: 'pixelcat' }).valid).toBe(false);
});
