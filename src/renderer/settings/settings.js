const FIELDS = ['intervalMin', 'startTime', 'endTime', 'dailyGoal', 'snoozeMin', 'character', 'enterFrom'];
const NUMERIC = ['intervalMin', 'dailyGoal', 'snoozeMin'];
const $ = (id) => document.getElementById(id);

$('close').addEventListener('click', () => window.close());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });

function read() {
  const data = { autoStart: $('autoStart').checked };
  for (const f of FIELDS) {
    const v = $(f).value;
    data[f] = NUMERIC.includes(f) ? (v === '' ? null : Number(v)) : v;
  }
  return data;
}

function write(s) {
  for (const f of FIELDS) $(f).value = s[f];
  $('autoStart').checked = s.autoStart;
}

function showErrors(errors) {
  for (const f of FIELDS) {
    $(`e-${f}`).textContent = errors[f] || '';
    $(f).classList.toggle('invalid', !!errors[f]);
  }
}

let LIMITS = {};

// Same rules as src/logic/settings.js (main re-validates before saving).
function check(d) {
  const errors = {};
  for (const f of NUMERIC) {
    const [lo, hi] = LIMITS[f];
    if (!Number.isInteger(d[f]) || d[f] < lo || d[f] > hi) errors[f] = `Enter a whole number from ${lo} to ${hi}`;
  }
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hhmm.test(d.startTime)) errors.startTime = 'Pick a start time';
  if (!hhmm.test(d.endTime)) errors.endTime = 'Pick an end time';
  if (!errors.endTime && !errors.startTime && d.startTime === d.endTime) errors.endTime = 'End must differ from start';
  return errors;
}

(async () => {
  const { settings, limits, characters, directions } = await window.water.getSettings();
  const addOption = (select, value, label) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    $(select).appendChild(o);
  };
  addOption('character', 'random', 'Random');
  for (const c of characters) addOption('character', c.id, c.name);
  const DIR_LABELS = { random: 'Random', left: 'Left side', right: 'Right side', top: 'Top', bottom: 'Bottom' };
  for (const d of directions) addOption('enterFrom', d, DIR_LABELS[d] || d);
  for (const f of NUMERIC) {
    $(`h-${f}`).textContent = `${limits[f][0]} to ${limits[f][1]}`;
    $(f).min = limits[f][0];
    $(f).max = limits[f][1];
  }
  LIMITS = limits;
  write(settings);

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('status').textContent = '';
    // Main process validates again before writing; the UI just shows its answer.
    const data = read();
    const local = check(data);
    if (Object.keys(local).length) {
      showErrors(local);
      $('status').textContent = 'Please fix the highlighted fields.';
      return;
    }
    const res = await window.water.saveSettings(data);
    showErrors(res.errors || {});
    if (res.errors && res.errors._form) $('status').textContent = res.errors._form;
    if (res.valid) {
      write(res.settings);
      $('status').textContent = 'Saved.';
      window.close();
    } else if (!(res.errors && res.errors._form)) {
      $('status').textContent = 'Please fix the highlighted fields.';
    }
  });
})();
