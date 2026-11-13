const $ = (id) => document.getElementById(id);
const root = $('root'), actor = $('actor'), box = $('box'), boxText = $('boxText'), charEl = $('char'), sprite = $('sprite');
const fallback = $('fallback'), ring = $('ring'), ringFg = $('ringFg'), ringText = $('ringText');
const buttons = $('buttons'), yesBtn = $('yes'), snoozeBtn = $('snooze'), glass = $('glass');

const REMINDER_TEXT = 'TIME TO DRINK WATER TO KEEP YOUR SKIN GLOWING!';
const RING_LEN = 2 * Math.PI * 52;
const WALK_SPEED = 0.16; // px per ms
// If the reminder is ignored the character gets annoyed, then angry.
const ANNOYED_AFTER_MS = 20000;
const ANGRY_AFTER_MS = 45000;
const ANNOYED_TEXT = "HEY! I'M WAITING...";
const ANGRY_TEXT = "I'M ANGRY! DRINK YOUR WATER NOW!";
const SVG_NS = 'http://www.w3.org/2000/svg';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let info = null;
let busy = false;
let walkTimer = null;
let moodTimers = [];
let showVersion = 0;

// Decode before entering so disk/image decoding never interrupts the first stride.
async function preloadCharacter(ch) {
  const urls = new Set([...ch.walk, ...Object.values(ch.walks).flat(), ...Object.values(ch.gestures || {}).flat(), ...Object.values(ch.images)]);
  if (ch.rig) {
    urls.add(ch.rig.body);
    for (const limb of [...Object.values(ch.rig.arms), ...Object.values(ch.rig.legs)]) urls.add(limb.url);
  }
  await Promise.all([...urls].filter(Boolean).map(async (url) => {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { /* setImage retains the visible fallback. */ }
  }));
}

function travelSpeed(travel) {
  const ch = info.character;
  const { frames } = walkForTravel(ch, travel);
  // Human side cycles cover roughly 0.72 character-heights per complete stride.
  // Keep the old speed for vertical and legacy two-frame characters.
  if (ch.style === 'smooth' && frames.length >= 8 && ['left', 'right'].includes(travel)) {
    return (ch.height || 280) * 0.72 / (frames.length * 1000 / ch.walkFps);
  }
  return WALK_SPEED;
}

function useFallback() {
  sprite.hidden = true;
  glass.hidden = true;
  for (const el of charEl.querySelectorAll('.arm, .leg')) el.remove();
  fallback.hidden = false;
}

function limb(kind, side, a) {
  const el = document.createElement('div');
  el.className = `${kind} ${kind}-${side}`;
  el.style.setProperty('--px', `${a.pivot[0]}%`);
  el.style.setProperty('--py', `${a.pivot[1]}%`);
  const img = document.createElement('img');
  img.alt = '';
  img.src = a.url;
  el.appendChild(img);
  return el;
}

// Rebuild limb layers for a rigged character; the glass rides inside the glass arm.
function setupRig() {
  for (const el of charEl.querySelectorAll('.arm, .leg')) el.remove();
  charEl.appendChild(glass);
  const rig = info.character.rig;
  if (!rig || info.character.gestures?.greeting?.length) return;
  for (const [side, a] of Object.entries(rig.legs || {})) {
    const el = limb('leg', side, a);
    el.style.setProperty('--sw', `${a.swing}deg`);
    charEl.appendChild(el);
  }
  for (const [side, a] of Object.entries(rig.arms || {})) {
    const el = limb('arm', side, a);
    el.style.setProperty('--dx', `${a.drink[0]}%`);
    el.style.setProperty('--dy', `${a.drink[1]}%`);
    el.style.setProperty('--da', `${a.drink[2]}deg`);
    el.style.setProperty('--gt', `${-a.drink[2] - 35}deg`);
    el.style.setProperty('--w0', `${a.wave[0]}deg`);
    el.style.setProperty('--w1', `${a.wave[1]}deg`);
    if (side === rig.glassArm) {
      el.classList.add('arm-drink');
      el.appendChild(glass);
    } else {
      el.classList.add('arm-wave');
    }
    charEl.appendChild(el);
  }
}

function pct(el, prop, v) {
  el.style.setProperty(prop, `${v}%`);
}

// Angry overlay built from the character's face anchors: slanted brows, red flush, anger mark, steam.
function setupFace() {
  for (const el of charEl.querySelectorAll('.fx')) el.remove();
  const f = info.character.face;
  if (!f) return;
  const add = (cls) => {
    const el = document.createElement('div');
    el.className = `fx ${cls}`;
    charEl.appendChild(el);
    return el;
  };
  const flush = add('flush');
  pct(flush, '--cx', f.center[0]);
  pct(flush, '--cy', f.center[1]);
  pct(flush, '--r', f.radius);
  f.brows.forEach(([x, y], i) => {
    const brow = add(`brow brow-${i ? 'right' : 'left'}`);
    pct(brow, '--x', x);
    pct(brow, '--y', y);
    pct(brow, '--len', f.browLen);
  });
  for (const side of [-1, 1]) {
    const puff = add(`steam steam-${side < 0 ? 'left' : 'right'}`);
    pct(puff, '--x', f.center[0] + side * f.radius);
    pct(puff, '--y', f.brows[0][1] - 4);
  }
  if (f.mouth) {
    // Show the mouth region of the character's own image upside down: the smile becomes a frown.
    const [mx, my, mw, mh] = f.mouth;
    const ch = info.character;
    const frown = add('frown');
    pct(frown, '--x', mx - mw / 2);
    pct(frown, '--y', my - mh / 2);
    pct(frown, '--w', mw);
    pct(frown, '--hh', mh);
    frown.style.backgroundImage = `url("${ch.rig ? ch.rig.body : ch.images.idle_cup}")`;
    frown.style.backgroundSize = `${10000 / mw}% ${10000 / mh}%`;
    frown.style.backgroundPosition = `${((mx - mw / 2) / (100 - mw)) * 100}% ${((my - mh / 2) / (100 - mh)) * 100}%`;
  }
  const mark = add('mark');
  pct(mark, '--x', f.mark[0]);
  pct(mark, '--y', f.mark[1]);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  for (const d of ['M9 3Q9 9 3 9', 'M15 3Q15 9 21 9', 'M9 21Q9 15 3 15', 'M15 21Q15 15 21 15']) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  mark.appendChild(svg);
}

function clearMood() {
  moodTimers.forEach(clearTimeout);
  moodTimers = [];
  box.classList.remove('mad');
}

function startMoodTimers() {
  clearMood();
  moodTimers.push(setTimeout(() => {
    if (busy) return;
    boxText.textContent = ANNOYED_TEXT;
    popIn(box);
    setPose('idle_cup', 'tapping');
  }, ANNOYED_AFTER_MS));
  moodTimers.push(setTimeout(() => {
    if (busy) return;
    boxText.textContent = ANGRY_TEXT;
    box.classList.add('mad');
    popIn(box);
    setPose('angry', 'angry');
  }, ANGRY_AFTER_MS));
}

function setImage(url, onError = useFallback) {
  if (!url) return useFallback();
  fallback.hidden = true;
  sprite.hidden = false;
  sprite.onerror = onError;
  if (sprite.getAttribute('src') !== url) sprite.src = url;
}

// Pick the drawn cycle for the actual direction of travel. Old characters safely use
// their original generic walk frames (or their animated rig when no frames exist).
function walkForTravel(ch, travel) {
  const direction = { left: 'side', right: 'side', down: 'front', up: 'back' }[travel];
  if (direction && ch.walks[direction].length) {
    return { frames: ch.walks[direction], facing: direction === 'side' ? ch.walkFacing : 'front' };
  }
  return { frames: ch.walk, facing: ch.walkFacing };
}

// state picks the image; motion picks the CSS animation (idle, walking, drinking, happy, land).
// travel is the actual direction of movement: left, right, up, or down.
function setPose(state, motion = 'idle', { wave = false, travel = null } = {}) {
  const ch = info.character;
  cancelAnimationFrame(walkTimer);
  walkTimer = null;
  // Complete poses keep all limbs visible and the bottle in the fingers/paws.
  // Play each gesture once and settle into the relaxed bottle-holding pose.
  const gestures = ch.gestures || {};
  // Drawn characters get angry.png: the same resting pose with an angry face (the overlay is hidden on drawn poses).
  if (state === 'angry' && ch.angry && gestures.greeting?.length) {
    charEl.className = `char ${ch.style} ${motion} drawn-gesture`;
    setImage(ch.angry, () => setImage(gestures.greeting[0]));
    return;
  }
  let gesture = [];
  if (motion !== 'walking') {
    if (state === 'drinking') gesture = gestures.drinking || [];
    else if (wave) gesture = gestures.greeting || [];
    else if (gestures.greeting?.length) gesture = [gestures.greeting[0]];
  }
  if (gesture.length) {
    charEl.className = `char ${ch.style} ${motion} drawn-gesture`;
    const originalBody = () => {
      cancelAnimationFrame(walkTimer);
      walkTimer = null;
      charEl.className = `char ${ch.style} idle drawn-gesture`;
      setImage(ch.images.idle_cup);
    };
    setImage(gesture[0], originalBody);
    if (gesture.length === 1) return;
    const started = performance.now();
    const frameMs = (state === 'drinking' ? 2000 : 1200) / gesture.length;
    const tick = (now) => {
      const i = Math.min(gesture.length - 1, Math.floor((now - started) / frameMs));
      setImage(gesture[i], originalBody);
      walkTimer = i < gesture.length - 1 ? requestAnimationFrame(tick) : null;
    };
    walkTimer = requestAnimationFrame(tick);
    return;
  }
  const walk = motion === 'walking' ? walkForTravel(ch, travel) : { frames: [], facing: ch.walkFacing };
  const frames = walk.frames.length > 0;
  const side = frames ? walk.facing : ch.facing;
  const flip = motion === 'walking' && travel && side !== 'front' && side !== travel;
  // If optional gesture files are missing, keep the complete original sprite.
  // Never fall back to the torso-only rig image when a full image is available.
  const complete = motion !== 'walking' && ch.images[state === 'angry' ? 'idle_cup' : state];
  const sip = !complete && ch.rig && ch.rig.glassArm && state === 'drinking' ? ' sip' : '';
  // With a dedicated angry image the face overlay is not needed.
  const own = state === 'angry' && ch.angry ? ' own-angry' : '';
  charEl.className = `char ${ch.style} ${motion}${wave ? ' waving' : ''}${sip}${frames ? ' framed' : ''}${flip ? ' flip' : ''}${own}${complete ? ' full-body' : ''}`;
  if (frames) {
    const started = performance.now();
    setImage(walk.frames[0]);
    const tick = (now) => {
      const i = Math.floor((now - started) * ch.walkFps / 1000) % walk.frames.length;
      setImage(walk.frames[i]);
      walkTimer = requestAnimationFrame(tick);
    };
    walkTimer = requestAnimationFrame(tick);
    return;
  }
  if (state === 'angry') return setImage(ch.angry || complete || (ch.rig ? ch.rig.body : ch.images.idle_cup));
  setImage(complete || (ch.rig ? ch.rig.body : ch.images[state]));
}

function setupGlass() {
  const g = info.character.glass;
  glass.classList.remove('sip');
  glass.hidden = !g || Boolean(info.character.gestures?.drinking?.length);
  if (!g) return;
  charEl.style.setProperty('--hx', `${g.hand[0]}%`);
  charEl.style.setProperty('--hy', `${g.hand[1]}%`);
  charEl.style.setProperty('--mx', `${g.mouth[0]}%`);
  charEl.style.setProperty('--my', `${g.mouth[1]}%`);
}

function setPanel(visible) {
  box.classList.toggle('invisible', !visible);
  buttons.classList.toggle('invisible', !visible);
}

function popIn(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// Offset that puts the actor just outside the window on the given edge.
function offstage(dir) {
  const w = root.clientWidth, h = root.clientHeight;
  if (dir === 'left') return { x: -(actor.offsetLeft + actor.offsetWidth), y: 0 };
  if (dir === 'top') return { x: 0, y: -(actor.offsetTop + actor.offsetHeight) };
  if (dir === 'bottom') return { x: 0, y: h - actor.offsetTop };
  return { x: w - actor.offsetLeft, y: 0 };
}

function move(from, to, duration, easing) {
  const t = (p) => `translate(${p.x}px, ${p.y}px)`;
  return actor.animate([{ transform: t(from) }, { transform: t(to) }], { duration, easing, fill: 'forwards' }).finished;
}

async function enter() {
  const dir = info.enterFrom || 'right';
  const off = offstage(dir);
  const home = { x: 0, y: 0 };
  const travel = { left: 'right', right: 'left', top: 'down', bottom: 'up' }[dir] || 'left';
  setPose('idle_cup', 'walking', { travel });
  await move(off, home, Math.hypot(off.x, off.y) / travelSpeed(travel), 'linear');
  // Arrived: say hello, then show the speech box and buttons.
  setPose('idle_cup', 'idle', { wave: true });
  setPanel(true);
  popIn(box);
  popIn(buttons);
  await wait(1200);
  if (!busy) setPose('idle_cup', 'idle');
  startMoodTimers();
}

async function leave() {
  clearMood();
  setPanel(false);
  ring.hidden = true;
  charEl.hidden = false;
  const dir = info.enterFrom || 'right';
  const off = offstage(dir);
  const travel = { left: 'left', right: 'right', top: 'up', bottom: 'down' }[dir] || 'right';
  setPose('leaving', 'walking', { travel });
  await move({ x: 0, y: 0 }, off, Math.hypot(off.x, off.y) / travelSpeed(travel), 'linear');
  cancelAnimationFrame(walkTimer);
  walkTimer = null;
  window.water.closePopup();
}

async function show(payload) {
  const version = ++showVersion;
  root.style.visibility = 'hidden';
  cancelAnimationFrame(walkTimer);
  clearMood();
  await preloadCharacter(payload.character);
  if (version !== showVersion) return;
  info = payload;
  busy = false;
  root.className = info.enterFrom === 'left' ? 'side-left' : '';
  box.classList.remove('good');
  boxText.textContent = REMINDER_TEXT;
  ring.hidden = true;
  charEl.hidden = false;
  setPanel(false);
  yesBtn.disabled = false;
  snoozeBtn.disabled = !info.canSnooze;
  charEl.style.setProperty('--h', `${info.character.height || 280}px`);
  clearMood();
  setupRig();
  setupGlass();
  setupFace();
  root.style.visibility = '';
  enter();
}

async function onYes() {
  if (busy) return;
  busy = true;
  clearMood();
  setPanel(false);
  setPose('drinking', 'drinking');
  if (!(info.character.rig && info.character.rig.glassArm)) glass.classList.add('sip');
  const [res] = await Promise.all([window.water.yes(), wait(2000)]);
  glass.classList.remove('sip');
  setPose('happy', 'happy', { wave: true });
  await wait(900);
  charEl.hidden = true;
  ring.hidden = false;
  ringText.textContent = `${res.count}/${res.goal}`;
  requestAnimationFrame(() => {
    ringFg.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.min(1, res.count / res.goal))));
  });
  if (res.reached) {
    box.classList.remove('invisible');
    box.classList.add('good');
    boxText.textContent = 'GOOD JOB!';
    popIn(box);
    confetti();
  }
  await wait(res.reached ? 4000 : 2800);
  leave();
}

async function onSnooze() {
  if (busy || !info.canSnooze) return;
  busy = true;
  const res = await window.water.snooze();
  if (!res.ok) { busy = false; return; }
  clearMood();
  buttons.classList.add('invisible');
  boxText.textContent = `I'LL COME BACK IN ${res.snoozeMin} MINS!`;
  popIn(box);
  setPose('idle_cup', 'idle', { wave: true });
  await wait(2200);
  leave();
}

function confetti() {
  const cv = $('confetti'), ctx = cv.getContext('2d');
  const colors = ['#19e35a', '#4d7cff', '#ffd23f', '#ff5d8f', '#2ec4b6'];
  const cx = actor.offsetLeft + actor.offsetWidth / 2;
  const parts = Array.from({ length: 70 }, () => ({
    x: cx + (Math.random() - 0.5) * 60, y: 230,
    vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 8 - 2,
    s: 4 + Math.floor(Math.random() * 3) * 2, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.25;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    if (++frames < 150) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// Click-through everywhere except elements marked data-hit.
let interactive = false;
document.addEventListener('mousemove', (e) => {
  const hit = !!(e.target.closest && e.target.closest('[data-hit]')) && !e.target.closest('[hidden], .invisible');
  if (hit !== interactive) { interactive = hit; window.water.setInteractive(hit); }
});

yesBtn.addEventListener('click', onYes);
snoozeBtn.addEventListener('click', onSnooze);
window.water.onShow(show);
