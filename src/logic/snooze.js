'use strict';

const MAX_SNOOZES = 3;

function canSnooze(count) {
  return count < MAX_SNOOZES;
}

function snoozeUntil(now, minutes) {
  return new Date(now.getTime() + minutes * 60000);
}

function nextSnoozeCount(count) {
  if (!canSnooze(count)) throw new RangeError('Snooze limit reached');
  return count + 1;
}

module.exports = { MAX_SNOOZES, canSnooze, snoozeUntil, nextSnoozeCount };
