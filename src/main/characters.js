const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'characters');
const STATES = ['idle_cup', 'drinking', 'happy', 'leaving'];

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'character.json'), 'utf8'));
  } catch {
    return {};
  }
}

function isPoint(p) {
  return Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n) && n >= 0 && n <= 100);
}

function isNums(a, n) {
  return Array.isArray(a) && a.length === n && a.every((v) => Number.isFinite(v) && Math.abs(v) <= 360);
}

// Optional face anchors (all in % of the image) for the angry overlay: brows, face centre + radius, anger mark.
function readFace(f) {
  if (!f || typeof f !== 'object') return null;
  const ok = Array.isArray(f.brows) && f.brows.length === 2 && f.brows.every(isPoint)
    && isPoint(f.center) && isPoint(f.mark)
    && [f.browLen, f.radius].every((n) => Number.isFinite(n) && n > 0 && n <= 60);
  if (!ok) return null;
  // Optional mouth box [x, y, w, h]: flipped upside down when angry, turning a smile into a frown.
  const mouth = Array.isArray(f.mouth) && f.mouth.length === 4 && f.mouth.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ? f.mouth : null;
  return { brows: f.brows, browLen: f.browLen, center: f.center, radius: f.radius, mark: f.mark, mouth };
}

// Optional puppet rig: a body image plus forearm and leg layers that rotate around a pivot (elbow / hip).
function readLimbs(src, id, has, extra) {
  const out = {};
  for (const side of ['left', 'right']) {
    const a = src && src[side];
    if (!a || typeof a.image !== 'string' || !has(a.image) || !isPoint(a.pivot)) continue;
    out[side] = { url: `../../../assets/characters/${id}/${a.image}`, pivot: a.pivot, ...extra(a) };
  }
  return out;
}

function readRig(rig, id, has) {
  if (!rig || typeof rig !== 'object' || typeof rig.body !== 'string' || !has(rig.body)) return null;
  const arms = readLimbs(rig.arms, id, has, (a) => ({
    drink: isNums(a.drink, 3) ? a.drink : [0, 0, 0],
    wave: isNums(a.wave, 2) ? a.wave : [0, 0],
  }));
  const legs = readLimbs(rig.legs, id, has, (a) => ({
    swing: Number.isFinite(a.swing) && Math.abs(a.swing) <= 30 ? a.swing : 6,
  }));
  return {
    body: `../../../assets/characters/${id}/${rig.body}`,
    arms,
    legs,
    glassArm: arms[rig.glassArm] ? rig.glassArm : null,
  };
}

// Image URL per state (relative to the popup page), falling back to idle.png, else null (placeholder shape).
function loadCharacter(id, root = ASSETS) {
  const dir = path.join(root, id);
  const m = readManifest(dir);
  const has = (f) => !f.includes('/') && !f.includes('\\') && fs.existsSync(path.join(dir, f));
  const idle = has('idle.png') ? 'idle.png' : has('idle_cup.png') ? 'idle_cup.png' : null;
  const images = {};
  for (const s of STATES) {
    const file = has(`${s}.png`) ? `${s}.png` : idle;
    images[s] = file ? `../../../assets/characters/${id}/${file}` : null;
  }
  const facing = ['left', 'right'].includes(m.facing) ? m.facing : 'front';
  // Optional walk cycle frames: walk_1.png, walk_2.png, ...
  const walk = [];
  for (let i = 1; has(`walk_${i}.png`); i++) walk.push(`../../../assets/characters/${id}/walk_${i}.png`);
  // Directional walk cycles. Side frames face walkFacing and are mirrored by the renderer;
  // front/back frames are used while travelling vertically.
  const walks = {};
  for (const direction of ['side', 'front', 'back']) {
    const frames = [];
    for (let i = 1; has(`walk_${direction}_${i}.png`); i++) {
      frames.push(`../../../assets/characters/${id}/walk_${direction}_${i}.png`);
    }
    walks[direction] = frames;
  }
  const glass = m.glass && isPoint(m.glass.hand) && isPoint(m.glass.mouth) ? { hand: m.glass.hand, mouth: m.glass.mouth } : null;
  // Complete optional gestures. Greetings use four poses; sipping may use eight.
  // Reject partial sets so the renderer can retain the complete original image.
  const gestures = {};
  for (const name of ['greeting', 'drinking']) {
    const count = name === 'drinking' && has('drinking_5.png') ? 8 : 4;
    const files = Array.from({ length: count }, (_, i) => `${name}_${i + 1}.png`);
    gestures[name] = files.every(has) ? files.map((file) => `../../../assets/characters/${id}/${file}`) : [];
  }
  return {
    id,
    name: typeof m.name === 'string' ? m.name : id.charAt(0).toUpperCase() + id.slice(1),
    style: m.style === 'smooth' ? 'smooth' : 'pixel',
    glass,
    images,
    walk,
    walks,
    gestures,
    // Walk frames: playback speed and which way the drawn character faces (mirrored to match the direction of travel).
    walkFps: Number.isFinite(m.walkFps) && m.walkFps >= 1 && m.walkFps <= 30 ? m.walkFps : walk.length > 2 ? 12 : 4,
    walkFacing: ['left', 'right'].includes(m.walkFacing) ? m.walkFacing : facing,
    // Which way the standing image faces; side-facing characters are mirrored to face where they walk.
    facing,
    height: Number.isFinite(m.height) && m.height >= 80 && m.height <= 300 ? m.height : null,
    rig: readRig(m.rig, id, has),
    face: readFace(m.face),
    // Optional dedicated angry image (used instead of the overlay face when present).
    angry: has('angry.png') ? `../../../assets/characters/${id}/angry.png` : null,
  };
}

module.exports = { loadCharacter, STATES };
