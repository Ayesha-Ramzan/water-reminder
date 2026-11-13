const fs = require('fs');
const path = require('path');
const { mergeWithDefaults, validateSettings } = require('../logic/settings');
const { rolloverDaily, incrementDaily } = require('../logic/daily');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function createStore(dir) {
  const settingsFile = path.join(dir, 'settings.json');
  const dailyFile = path.join(dir, 'daily.json');

  return {
    loadSettings() {
      const raw = readJson(settingsFile);
      return mergeWithDefaults(raw && typeof raw === 'object' ? raw : {});
    },
    // Validates first; nothing is written when invalid.
    saveSettings(input) {
      const result = validateSettings(input);
      if (result.valid) writeJson(settingsFile, result.value);
      return result;
    },
    loadDaily(now = new Date()) {
      return rolloverDaily(readJson(dailyFile), now);
    },
    addDrink(now = new Date()) {
      const next = incrementDaily(readJson(dailyFile), now);
      writeJson(dailyFile, next);
      return next;
    },
  };
}

module.exports = { createStore };
