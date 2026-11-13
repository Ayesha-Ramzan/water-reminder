const { canSnooze, nextSnoozeCount, snoozeUntil, MAX_SNOOZES } = require('./snooze');

// Snooze state of the current reminder. Pure, so main.js stays thin and this is testable.
function createReminderFlow() {
  let count = 0;
  let returning = false;

  return {
    // A scheduled reminder fired; a snooze comeback keeps the count, anything else is new.
    onFire() {
      if (!returning) count = 0;
      returning = false;
      return { canSnooze: canSnooze(count), maxSnoozes: MAX_SNOOZES };
    },
    // "Remind now", "Yes", or a pending snooze being replaced (pause/resume, settings save).
    reset() {
      count = 0;
      returning = false;
    },
    // Returns the comeback time, or null when the limit is reached.
    snooze(now, minutes) {
      if (!canSnooze(count)) return null;
      count = nextSnoozeCount(count);
      returning = true;
      return snoozeUntil(now, minutes);
    },
    count: () => count,
    canSnooze: () => canSnooze(count),
  };
}

module.exports = { createReminderFlow };
