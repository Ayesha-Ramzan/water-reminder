'use strict';

const CHARACTERS = ['girl', 'boy', 'cat'];
// "Random" picks only from the user's own characters.
const RANDOM_POOL = ['girl', 'boy', 'cat'];
const DIRECTIONS = ['random', 'left', 'right', 'top', 'bottom'];
const LIMITS = { intervalMin: [15, 240], dailyGoal: [1, 20], snoozeMin: [1, 30] };
const DEFAULTS = {
  intervalMin: 60,
  startTime: '09:00',
  endTime: '21:00',
  dailyGoal: 8,
  snoozeMin: 10,
  character: 'random',
  enterFrom: 'random',
  autoStart: false,
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
  return null;
}

function validateSettings(obj) {
  const src = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const errors = {};
  const value = {};

  for (const key of Object.keys(LIMITS)) {
    const [min, max] = LIMITS[key];
    const raw = src[key] === undefined ? DEFAULTS[key] : src[key];
    const n = toInt(raw);
    if (n === null) errors[key] = 'must be a whole number';
    else if (n < min || n > max) errors[key] = `must be between ${min} and ${max}`;
    else value[key] = n;
  }

  for (const key of ['startTime', 'endTime']) {
    const raw = src[key] === undefined ? DEFAULTS[key] : src[key];
    if (typeof raw !== 'string' || !TIME_RE.test(raw)) errors[key] = 'must be HH:MM (24h)';
    else value[key] = raw;
  }
  if (value.startTime && value.endTime && value.startTime === value.endTime) {
    errors.endTime = 'must differ from start time';
  }

  const ch = src.character === undefined ? DEFAULTS.character : src.character;
  if (ch === 'random' || CHARACTERS.includes(ch)) value.character = ch;
  else errors.character = 'unknown character';

  const dir = src.enterFrom === undefined ? DEFAULTS.enterFrom : src.enterFrom;
  if (DIRECTIONS.includes(dir)) value.enterFrom = dir;
  else errors.enterFrom = 'unknown direction';

  const auto = src.autoStart === undefined ? DEFAULTS.autoStart : src.autoStart;
  if (typeof auto === 'boolean') value.autoStart = auto;
  else errors.autoStart = 'must be true or false';

  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? value : null };
}

function mergeWithDefaults(partial) {
  const src = partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {};
  const result = validateSettings(src);
  if (result.valid) return result.value;
  const fixed = {};
  for (const key of Object.keys(DEFAULTS)) {
    fixed[key] = key in result.errors || src[key] === undefined ? DEFAULTS[key] : src[key];
  }
  // start/end conflict or other cross-field errors: fall back fully on those fields
  const again = validateSettings(fixed);
  if (again.valid) return again.value;
  return Object.assign({}, DEFAULTS);
}

module.exports = { CHARACTERS, RANDOM_POOL, DIRECTIONS, LIMITS, DEFAULTS, validateSettings, mergeWithDefaults };
