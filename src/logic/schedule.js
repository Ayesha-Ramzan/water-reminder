'use strict';

function parseTime(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function isWithinActiveHours(date, settings) {
  const start = parseTime(settings.startTime);
  const end = parseTime(settings.endTime);
  const mins = date.getHours() * 60 + date.getMinutes();
  if (start < end) return mins >= start && mins < end;
  if (start > end) return mins >= start || mins < end;
  return false;
}

function atTime(base, dayOffset, timeStr) {
  const t = parseTime(timeStr);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset,
    Math.floor(t / 60), t % 60);
}

function nextReminderTime(now, settings) {
  const candidate = new Date(now.getTime() + settings.intervalMin * 60000);
  if (isWithinActiveHours(candidate, settings)) return candidate;
  const todayStart = atTime(now, 0, settings.startTime);
  return now < todayStart ? todayStart : atTime(now, 1, settings.startTime);
}

module.exports = { nextReminderTime, isWithinActiveHours };
