'use strict';
// Generates 64x64 pixel-art placeholder sprites: assets/characters/<id>/<state>.png
// Uses only Node built-ins (zlib) for PNG encoding. Output is deterministic.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 64;
const OUTLINE = [30, 24, 40];
const WHITE = [255, 255, 255];
const CUP = [76, 175, 80];
const CUP_DARK = [46, 125, 50];
const BLUSH = [240, 130, 140];

// Original characters: hair / outfit / accent / pants colours and hair style.
const CHARACTERS = {
  luna: { hair: [120, 80, 200], outfit: [60, 70, 150], accent: [250, 220, 90], pants: [40, 40, 90], skin: [250, 215, 185], style: 'long' },
  kai: { hair: [230, 120, 40], outfit: [30, 150, 160], accent: [255, 255, 255], pants: [60, 60, 70], skin: [225, 170, 125], style: 'spiky' },
  momo: { hair: [250, 150, 190], outfit: [250, 240, 220], accent: [220, 70, 90], pants: [150, 100, 70], skin: [255, 225, 200], style: 'buns' },
  pip: { hair: [60, 190, 120], outfit: [220, 190, 50], accent: [120, 70, 40], pants: [90, 60, 40], skin: [190, 130, 90], style: 'short' },
};
// Original cat character (not in CHARACTERS because it is animal-shaped, not a hair/outfit palette).
const CAT = {
  id: 'pixelcat',
  fur: [235, 150, 60],
  stripe: [190, 100, 35],
  cream: [255, 235, 200],
  ear: [245, 150, 150],
  nose: [220, 90, 110],
  eye: [60, 150, 90],
};
const STATES = ['idle_cup', 'drinking', 'happy', 'leaving'];
const WALK_STATES = ['walk_1', 'walk_2'];

// Tiny grid: pixels are RGB arrays or null (transparent).
function makeGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
}
function rect(g, x, y, w, h, color) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE) g[j][i] = color;
    }
  }
}
// Every transparent pixel touching a filled one (4-neighbour) becomes outline.
function addOutline(g) {
  const marks = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x]) continue;
      const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      if (n.some(([i, j]) => i >= 0 && j >= 0 && i < SIZE && j < SIZE && g[j][i])) marks.push([x, y]);
    }
  }
  marks.forEach(([x, y]) => { g[y][x] = OUTLINE; });
}

function drawHair(g, c, x, y, w) {
  rect(g, x - 1, y - 2, w + 2, 8, c.hair); // top
  rect(g, x - 1, y + 4, 3, 10, c.hair); // left side
  rect(g, x + w - 2, y + 4, 3, 10, c.hair); // right side
  rect(g, x + 2, y + 5, w - 4, 3, c.hair); // fringe
  if (c.style === 'long') {
    rect(g, x - 2, y + 10, 4, 22, c.hair);
    rect(g, x + w - 2, y + 10, 4, 22, c.hair);
  } else if (c.style === 'spiky') {
    [[x, y - 5], [x + 5, y - 7], [x + 10, y - 5], [x + 15, y - 7]].forEach(([sx, sy]) => rect(g, sx, sy, 4, 5, c.hair));
  } else if (c.style === 'buns') {
    rect(g, x - 4, y - 5, 6, 6, c.hair);
    rect(g, x + w - 2, y - 5, 6, 6, c.hair);
  } else {
    rect(g, x + 4, y - 4, 8, 3, c.hair); // short tuft
  }
}

// Walk cycle helpers. walk_1: left foot lifted/forward, free (left) arm swung forward.
// walk_2: mirror (right foot lifted), free arm back.
function drawWalkLegs(g, state, leg, foot) {
  const leftUp = state === 'walk_1';
  const [ux, px] = leftUp ? [26, 33] : [33, 26]; // lifted / planted leg x
  rect(g, px, 44, 5, 8, leg);
  rect(g, px - 1, 52, 7, 3, foot);
  rect(g, ux, 44, 5, 5, leg);
  rect(g, ux - 2, 49, 9, 3, foot);
}
function drawWalkArm(g, state, sleeve, hand) {
  if (state === 'walk_1') {
    rect(g, 20, 31, 4, 7, sleeve); rect(g, 17, 36, 5, 3, hand);
  } else {
    rect(g, 21, 31, 3, 11, sleeve); rect(g, 21, 42, 3, 3, hand);
  }
}
// Raise the whole figure by 1px (passing frame).
function shiftUp(g) {
  g.shift();
  g.push(new Array(SIZE).fill(null));
}

function drawCup(g, x, y) {
  rect(g, x, y, 7, 9, CUP);
  rect(g, x, y, 7, 2, CUP_DARK);
  rect(g, x + 1, y + 4, 2, 3, WHITE); // highlight
}

function drawFront(g, c, state) {
  const raised = state === 'happy';
  const drink = state === 'drinking';
  const walk = state.startsWith('walk');
  // legs and shoes
  if (walk) {
    drawWalkLegs(g, state, c.pants, OUTLINE);
  } else {
    rect(g, 26, 44, 5, 8, c.pants);
    rect(g, 33, 44, 5, 8, c.pants);
    rect(g, 25, 52, 7, 3, OUTLINE);
    rect(g, 32, 52, 7, 3, OUTLINE);
  }
  // body
  rect(g, 24, 30, 16, 15, c.outfit);
  rect(g, 24, 38, 16, 2, c.accent);
  // head
  rect(g, 22, 10, 20, 19, c.skin);
  drawHair(g, c, 22, 10, 20);
  // face
  if (raised) {
    rect(g, 27, 20, 3, 1, OUTLINE); rect(g, 34, 20, 3, 1, OUTLINE); // happy eyes
    rect(g, 28, 24, 8, 1, OUTLINE); rect(g, 29, 25, 6, 1, OUTLINE); // open smile
    rect(g, 30, 25, 4, 1, BLUSH);
  } else {
    rect(g, 27, 19, 3, 4, OUTLINE); rect(g, 34, 19, 3, 4, OUTLINE);
    rect(g, 27, 19, 1, 1, WHITE); rect(g, 34, 19, 1, 1, WHITE);
    if (!drink) { rect(g, 30, 25, 4, 1, OUTLINE); rect(g, 29, 24, 1, 1, OUTLINE); rect(g, 34, 24, 1, 1, OUTLINE); }
  }
  rect(g, 24, 23, 3, 2, BLUSH); rect(g, 37, 23, 3, 2, BLUSH);
  // arms
  if (raised) {
    rect(g, 20, 28, 5, 4, c.outfit); rect(g, 39, 28, 5, 4, c.outfit);
    rect(g, 17, 17, 4, 13, c.outfit); rect(g, 43, 17, 4, 13, c.outfit);
    rect(g, 17, 13, 4, 4, c.skin); rect(g, 43, 13, 4, 4, c.skin);
  } else {
    if (walk) drawWalkArm(g, state, c.outfit, c.skin);
    else { rect(g, 20, 31, 4, 11, c.outfit); rect(g, 20, 42, 4, 3, c.skin); }
    if (drink) {
      rect(g, 40, 31, 4, 6, c.outfit);
      rect(g, 36, 33, 8, 4, c.outfit); // forearm toward mouth
      drawCup(g, 31, 22);
      rect(g, 35, 26, 4, 4, c.skin); // hand on cup
    } else {
      rect(g, 40, 31, 4, 11, c.outfit); rect(g, 40, 42, 4, 3, c.skin);
      drawCup(g, 43, 41);
    }
  }
}

function drawLeaving(g, c) {
  const dy = 3; // slightly smaller and lower
  // back leg, front leg stepping forward
  rect(g, 28, 46 + dy, 4, 6, c.pants);
  rect(g, 25, 52 + dy, 7, 3, OUTLINE);
  rect(g, 34, 46 + dy, 4, 5, c.pants);
  rect(g, 34, 51 + dy, 9, 3, OUTLINE);
  // body (side-on)
  rect(g, 27, 32 + dy, 12, 15, c.outfit);
  rect(g, 27, 40 + dy, 12, 2, c.accent);
  // head turned right
  rect(g, 25, 14 + dy, 16, 18, c.skin);
  rect(g, 24, 11 + dy, 17, 7, c.hair);
  rect(g, 23, 15 + dy, 8, 12, c.hair); // back of hair
  if (c.style === 'long') rect(g, 22, 24 + dy, 7, 16, c.hair);
  if (c.style === 'spiky') { rect(g, 26, 7 + dy, 4, 5, c.hair); rect(g, 32, 8 + dy, 4, 4, c.hair); }
  if (c.style === 'buns') rect(g, 21, 8 + dy, 6, 6, c.hair);
  if (c.style === 'short') rect(g, 30, 8 + dy, 7, 3, c.hair);
  rect(g, 36, 22 + dy, 2, 4, OUTLINE); // eye
  rect(g, 36, 28 + dy, 3, 1, OUTLINE); // mouth
  rect(g, 34, 26 + dy, 3, 2, BLUSH);
  // arm swinging, cup held behind
  rect(g, 30, 34 + dy, 4, 10, c.outfit); rect(g, 30, 44 + dy, 4, 3, c.skin);
  drawCup(g, 26, 43 + dy);
}

function drawSprite(c, state) {
  const g = makeGrid();
  if (state === 'leaving') drawLeaving(g, c); else drawFront(g, c, state);
  if (state === 'walk_2') shiftUp(g);
  addOutline(g);
  return g;
}

function drawCatTail(g, x, y) {
  rect(g, x, y, 5, 14, CAT.fur);
  rect(g, x - 2, y - 6, 5, 8, CAT.fur);
  [[x, y + 2], [x, y + 8], [x - 2, y - 4]].forEach(([sx, sy]) => rect(g, sx, sy, 5, 2, CAT.stripe));
  rect(g, x - 2, y - 6, 5, 2, CAT.cream);
}

function drawCatFront(g, state) {
  const raised = state === 'happy';
  const drink = state === 'drinking';
  drawCatTail(g, 17, 42);
  const walk = state.startsWith('walk');
  // legs and feet
  if (walk) {
    drawWalkLegs(g, state, CAT.fur, CAT.cream);
  } else {
    rect(g, 26, 44, 5, 8, CAT.fur);
    rect(g, 33, 44, 5, 8, CAT.fur);
    rect(g, 25, 52, 7, 3, CAT.cream);
    rect(g, 32, 52, 7, 3, CAT.cream);
  }
  // body and belly
  rect(g, 24, 30, 16, 15, CAT.fur);
  rect(g, 28, 32, 8, 12, CAT.cream);
  rect(g, 24, 36, 3, 2, CAT.stripe); rect(g, 37, 36, 3, 2, CAT.stripe);
  // head and ears
  rect(g, 22, 12, 20, 17, CAT.fur);
  rect(g, 22, 8, 6, 5, CAT.fur); rect(g, 36, 8, 6, 5, CAT.fur);
  rect(g, 23, 6, 3, 2, CAT.fur); rect(g, 38, 6, 3, 2, CAT.fur);
  rect(g, 24, 9, 2, 3, CAT.ear); rect(g, 38, 9, 2, 3, CAT.ear);
  rect(g, 29, 12, 1, 3, CAT.stripe); rect(g, 31, 12, 2, 4, CAT.stripe); rect(g, 34, 12, 1, 3, CAT.stripe);
  rect(g, 22, 19, 2, 1, CAT.stripe); rect(g, 40, 19, 2, 1, CAT.stripe);
  rect(g, 26, 24, 12, 5, CAT.cream); // muzzle
  // face
  if (raised) {
    [27, 34].forEach((ex) => { rect(g, ex, 21, 1, 1, OUTLINE); rect(g, ex + 1, 20, 2, 1, OUTLINE); rect(g, ex + 3, 21, 1, 1, OUTLINE); });
    rect(g, 29, 26, 6, 1, OUTLINE); rect(g, 30, 27, 4, 1, OUTLINE);
    rect(g, 31, 27, 2, 1, BLUSH);
  } else {
    rect(g, 27, 19, 3, 4, OUTLINE); rect(g, 34, 19, 3, 4, OUTLINE);
    rect(g, 28, 20, 1, 2, CAT.eye); rect(g, 35, 20, 1, 2, CAT.eye);
    rect(g, 27, 19, 1, 1, WHITE); rect(g, 34, 19, 1, 1, WHITE);
    if (!drink) { rect(g, 30, 27, 4, 1, OUTLINE); rect(g, 29, 26, 1, 1, OUTLINE); rect(g, 34, 26, 1, 1, OUTLINE); }
  }
  rect(g, 31, 24, 2, 1, CAT.nose);
  rect(g, 24, 23, 2, 2, BLUSH); rect(g, 38, 23, 2, 2, BLUSH);
  // arms
  if (raised) {
    rect(g, 20, 28, 5, 4, CAT.fur); rect(g, 39, 28, 5, 4, CAT.fur);
    rect(g, 17, 17, 4, 13, CAT.fur); rect(g, 43, 17, 4, 13, CAT.fur);
    rect(g, 17, 13, 4, 4, CAT.cream); rect(g, 43, 13, 4, 4, CAT.cream);
  } else {
    if (walk) drawWalkArm(g, state, CAT.fur, CAT.cream);
    else { rect(g, 20, 31, 4, 11, CAT.fur); rect(g, 20, 42, 4, 3, CAT.cream); }
    if (drink) {
      rect(g, 40, 31, 4, 6, CAT.fur);
      rect(g, 36, 33, 8, 4, CAT.fur);
      drawCup(g, 29, 25);
      rect(g, 35, 27, 4, 4, CAT.cream); // paw on cup
    } else {
      rect(g, 40, 31, 4, 11, CAT.fur); rect(g, 40, 42, 4, 3, CAT.cream);
      drawCup(g, 43, 41);
    }
  }
}

function drawCatLeaving(g) {
  const dy = 3;
  drawCatTail(g, 19, 42 + dy);
  // legs: back leg, front leg stepping forward
  rect(g, 28, 46 + dy, 4, 6, CAT.fur);
  rect(g, 25, 52 + dy, 7, 3, CAT.cream);
  rect(g, 34, 46 + dy, 4, 5, CAT.fur);
  rect(g, 34, 51 + dy, 9, 3, CAT.cream);
  // body side-on
  rect(g, 27, 32 + dy, 12, 15, CAT.fur);
  rect(g, 33, 34 + dy, 6, 11, CAT.cream);
  rect(g, 27, 38 + dy, 3, 2, CAT.stripe);
  // head turned right, ear, snout
  rect(g, 25, 14 + dy, 16, 18, CAT.fur);
  rect(g, 41, 22 + dy, 3, 6, CAT.cream); // snout
  rect(g, 27, 8 + dy, 6, 7, CAT.fur); rect(g, 28, 6 + dy, 3, 2, CAT.fur);
  rect(g, 29, 10 + dy, 2, 3, CAT.ear);
  rect(g, 34, 14 + dy, 1, 3, CAT.stripe); rect(g, 36, 14 + dy, 2, 4, CAT.stripe);
  rect(g, 36, 22 + dy, 2, 4, OUTLINE); rect(g, 36, 22 + dy, 1, 1, WHITE); // eye
  rect(g, 43, 22 + dy, 1, 1, CAT.nose);
  rect(g, 40, 28 + dy, 3, 1, OUTLINE); // mouth
  rect(g, 34, 26 + dy, 3, 2, BLUSH);
  // arm swinging, cup held behind
  rect(g, 30, 34 + dy, 4, 10, CAT.fur); rect(g, 30, 44 + dy, 4, 3, CAT.cream);
  drawCup(g, 26, 43 + dy);
}

function drawCatSprite(state) {
  const g = makeGrid();
  if (state === 'leaving') drawCatLeaving(g); else drawCatFront(g, state);
  if (state === 'walk_2') shiftUp(g);
  addOutline(g);
  return g;
}

// --- PNG encoding (RGBA, 8-bit) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let v = n;
  for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
  return v >>> 0;
});
function crc32(buf) {
  let v = 0xffffffff;
  for (const b of buf) v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(g) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let o = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const p = g[y][x];
      raw[o++] = p ? p[0] : 0; raw[o++] = p ? p[1] : 0; raw[o++] = p ? p[2] : 0; raw[o++] = p ? 255 : 0;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const root = path.join(__dirname, '..', 'assets', 'characters');
  for (const [id, c] of Object.entries(CHARACTERS)) {
    fs.mkdirSync(path.join(root, id), { recursive: true });
    for (const state of [...STATES, ...WALK_STATES]) {
      fs.writeFileSync(path.join(root, id, `${state}.png`), encodePng(drawSprite(c, state)));
    }
  }
  fs.mkdirSync(path.join(root, CAT.id), { recursive: true });
  for (const state of [...STATES, ...WALK_STATES]) {
    fs.writeFileSync(path.join(root, CAT.id, `${state}.png`), encodePng(drawCatSprite(state)));
  }
  fs.writeFileSync(path.join(root, CAT.id, 'character.json'), '{"name": "Pixel Cat", "style": "pixel"}\n');
  console.log(`Wrote ${(Object.keys(CHARACTERS).length + 1) * (STATES.length + WALK_STATES.length)} sprites to ${root}`);
}

main();
