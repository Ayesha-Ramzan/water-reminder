'use strict';

function dateKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function rolloverDaily(state, now) {
  const key = dateKey(now);
  if (state && typeof state === 'object' && state.date === key &&
      Number.isInteger(state.count) && state.count >= 0) {
    return { date: key, count: state.count };
  }
  return { date: key, count: 0 };
}

function incrementDaily(state, now) {
  const s = rolloverDaily(state, now);
  return { date: s.date, count: s.count + 1 };
}

function progressRatio(count, goal) {
  if (!(goal > 0) || !(count > 0)) return 0;
  return Math.min(1, count / goal);
}

module.exports = { dateKey, rolloverDaily, incrementDaily, progressRatio };
