const { createReminderFlow } = require('../../src/logic/flow');

const t0 = new Date(2026, 0, 5, 10, 0);

test('snooze comeback keeps the count; 4th snooze is refused', () => {
  const f = createReminderFlow();
  f.onFire();
  for (let i = 0; i < 3; i++) {
    expect(f.snooze(t0, 10)).toEqual(new Date(2026, 0, 5, 10, 10));
    f.onFire();
  }
  expect(f.canSnooze()).toBe(false);
  expect(f.snooze(t0, 10)).toBeNull();
});

test('regression: a snooze replaced by pause/settings must not leak into the next reminder', () => {
  const f = createReminderFlow();
  f.onFire();
  f.snooze(t0, 10); f.onFire();
  f.snooze(t0, 10); f.onFire();
  f.snooze(t0, 10);          // 3rd snooze pending
  f.reset();                 // user pauses/resumes or saves settings
  expect(f.onFire().canSnooze).toBe(true);
  expect(f.count()).toBe(0);
});

test('yes/remind-now reset via reset()', () => {
  const f = createReminderFlow();
  f.onFire(); f.snooze(t0, 5);
  f.reset();
  expect(f.onFire().canSnooze).toBe(true);
});
