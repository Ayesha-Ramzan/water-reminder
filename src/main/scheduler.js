const { nextReminderTime } = require('../logic/schedule');

const MAX_DELAY = 2 ** 31 - 1;

function createScheduler({ getSettings, onFire, now = () => new Date() }) {
  let timer = null;
  let due = null;
  let paused = false;

  function clear() {
    if (timer) clearTimeout(timer);
    timer = null;
    due = null;
  }

  function arm(date) {
    clear();
    due = date;
    if (paused) return;
    const tick = () => {
      const left = due - now();
      if (left > 0) {
        timer = setTimeout(tick, Math.min(left, MAX_DELAY));
        return;
      }
      timer = null;
      due = null;
      onFire();
    };
    timer = setTimeout(tick, Math.min(Math.max(0, date - now()), MAX_DELAY));
  }

  return {
    scheduleNext() {
      arm(nextReminderTime(now(), getSettings()));
    },
    fireAt(date) {
      arm(date);
    },
    pause() {
      paused = true;
      clear();
    },
    resume() {
      paused = false;
      this.scheduleNext();
    },
    isPaused: () => paused,
    nextDue: () => due,
  };
}

module.exports = { createScheduler };
