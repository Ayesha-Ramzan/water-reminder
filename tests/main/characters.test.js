const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCharacter } = require('../../src/main/characters');

test('bundled girl character: smooth, glass anchors, idle used for every state', () => {
  const c = loadCharacter('girl');
  expect(c.style).toBe('smooth');
  expect(c.glass).toEqual({ hand: [75, 67], mouth: [53, 31] });
  expect(c.images.drinking).toMatch(/girl\/idle\.png$/);
});

test.each(['girl', 'boy', 'cat'])('%s has complete greeting and bottle-drinking sequences', (id) => {
  const c = loadCharacter(id);
  for (const name of ['greeting', 'drinking']) {
    expect(c.gestures[name]).toHaveLength(name === 'drinking' ? 8 : 4);
    expect(c.gestures[name][3]).toMatch(new RegExp(`${id}/${name}_4\\.png$`));
  }
});

test('partial gesture sequences are ignored instead of playing a broken body pose', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-gesture-'));
  const dir = path.join(root, 'custom');
  fs.mkdirSync(dir);
  try {
    for (let i = 1; i <= 3; i++) fs.writeFileSync(path.join(dir, `greeting_${i}.png`), '');
    expect(loadCharacter('custom', root).gestures.greeting).toEqual([]);
    fs.writeFileSync(path.join(dir, 'greeting_4.png'), '');
    expect(loadCharacter('custom', root).gestures.greeting).toHaveLength(4);
    expect(loadCharacter('custom', root).gestures.drinking).toEqual([]);
    for (let i = 1; i <= 5; i++) fs.writeFileSync(path.join(dir, `drinking_${i}.png`), '');
    expect(loadCharacter('custom', root).gestures.drinking).toEqual([]);
    for (let i = 6; i <= 8; i++) fs.writeFileSync(path.join(dir, `drinking_${i}.png`), '');
    expect(loadCharacter('custom', root).gestures.drinking).toHaveLength(8);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Girl and Boy provide eight side poses and retain front/back walk cycles', () => {
  for (const id of ['girl', 'boy']) {
    const c = loadCharacter(id);
    expect(c.walkFps).toBe(8);
    expect(c.walkFacing).toBe('right');
    for (const direction of ['side', 'front', 'back']) {
      expect(c.walks[direction]).toHaveLength(direction === 'side' ? 8 : 4);
      expect(c.walks[direction][0]).toMatch(new RegExp(`${id}/walk_${direction}_1\\.png$`));
    }
  }
});

test('pixel placeholder keeps its own state images and has no glass overlay', () => {
  const c = loadCharacter('luna');
  expect(c.style).toBe('pixel');
  expect(c.glass).toBeNull();
  expect(c.images.drinking).toMatch(/luna\/drinking\.png$/);
});

test('missing folder or bad manifest does not throw', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'x'));
  fs.writeFileSync(path.join(root, 'x', 'character.json'), '{bad');
  expect(loadCharacter('x', root).images.idle_cup).toBeNull();
  expect(loadCharacter('nope', root).glass).toBeNull();
  fs.rmSync(root, { recursive: true, force: true });
});

test('out-of-range glass anchors are ignored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'y'));
  fs.writeFileSync(path.join(root, 'y', 'character.json'), JSON.stringify({ glass: { hand: [150, 2], mouth: [1, 1] } }));
  expect(loadCharacter('y', root).glass).toBeNull();
  fs.rmSync(root, { recursive: true, force: true });
});

test('girl rig: body + two arm layers with pivots, glass on the right arm', () => {
  const { rig } = loadCharacter('girl');
  expect(rig.body).toMatch(/girl\/body\.png$/);
  expect(Object.keys(rig.arms).sort()).toEqual(['left', 'right']);
  expect(rig.glassArm).toBe('right');
  expect(rig.arms.right.drink).toHaveLength(3);
});

test('rig with missing files or path tricks is ignored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'z'));
  fs.writeFileSync(path.join(root, 'z', 'character.json'), JSON.stringify({ rig: { body: '../../etc/passwd' } }));
  expect(loadCharacter('z', root).rig).toBeNull();
  fs.writeFileSync(path.join(root, 'z', 'character.json'), JSON.stringify({ rig: { body: 'nope.png' } }));
  expect(loadCharacter('z', root).rig).toBeNull();
  fs.rmSync(root, { recursive: true, force: true });
});

test('rigs carry leg layers with hip pivots; boy has legs but no arms', () => {
  const girl = loadCharacter('girl').rig;
  expect(Object.keys(girl.legs).sort()).toEqual(['left', 'right']);
  expect(girl.legs.left.swing).toBe(6);
  const boy = loadCharacter('boy').rig;
  expect(Object.keys(boy.legs).sort()).toEqual(['left', 'right']);
  expect(boy.arms).toEqual({});
  expect(boy.glassArm).toBeNull();
});

test('characters without a rig report rig null and no walk frames when none exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'w'));
  expect(loadCharacter('w', root).rig).toBeNull();
  expect(loadCharacter('w', root).walk).toEqual([]);
  expect(loadCharacter('w', root).walks).toEqual({ side: [], front: [], back: [] });
  fs.rmSync(root, { recursive: true, force: true });
});

test('walk frames: fps and facing from character.json, safe defaults otherwise', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  const dir = path.join(root, 'v');
  fs.mkdirSync(dir);
  for (let i = 1; i <= 3; i++) fs.writeFileSync(path.join(dir, `walk_${i}.png`), '');
  let c = loadCharacter('v', root);
  expect(c.walk).toHaveLength(3);
  expect(c.walkFps).toBe(12);
  expect(c.walkFacing).toBe('front');
  fs.writeFileSync(path.join(dir, 'character.json'), JSON.stringify({ walkFps: 10, walkFacing: 'right' }));
  c = loadCharacter('v', root);
  expect(c.walkFps).toBe(10);
  expect(c.walkFacing).toBe('right');
  fs.writeFileSync(path.join(dir, 'character.json'), JSON.stringify({ walkFps: 500, walkFacing: 'up' }));
  c = loadCharacter('v', root);
  expect(c.walkFps).toBe(12);
  expect(c.walkFacing).toBe('front');
  fs.rmSync(root, { recursive: true, force: true });
});

test('pixel characters keep 2-frame walk at 4 fps', () => {
  const c = loadCharacter('pixelcat');
  expect(c.walk).toHaveLength(2);
  expect(c.walkFps).toBe(4);
});

test('reference cat: side-facing smooth image with a custom height', () => {
  const c = loadCharacter('cat');
  expect(c.style).toBe('smooth');
  expect(c.facing).toBe('left');
  expect(c.walkFacing).toBe('left');
  expect(c.height).toBe(210);
  expect(c.images.idle_cup).toMatch(/cat\/idle\.png$/);
  expect(c.walk).toEqual([]);
});

test('facing and height fall back safely', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'f'));
  fs.writeFileSync(path.join(root, 'f', 'character.json'), JSON.stringify({ facing: 'up', height: 5000 }));
  const c = loadCharacter('f', root);
  expect(c.facing).toBe('front');
  expect(c.height).toBeNull();
  fs.rmSync(root, { recursive: true, force: true });
});

test('selectable characters have face anchors for the angry overlay', () => {
  for (const id of ['girl', 'boy', 'cat']) {
    const { face } = loadCharacter(id);
    expect(face.brows).toHaveLength(2);
    expect(face.radius).toBeGreaterThan(0);
  }
  expect(loadCharacter('girl').face.mouth).toHaveLength(4);
  expect(loadCharacter('cat').face.mouth).toBeNull();
});

test('bad face data is ignored; angry image is optional', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ch-'));
  fs.mkdirSync(path.join(root, 'g'));
  fs.writeFileSync(path.join(root, 'g', 'character.json'), JSON.stringify({ face: { brows: [[1, 2]], browLen: 5, center: [1, 1], radius: 5, mark: [1, 1] } }));
  let c = loadCharacter('g', root);
  expect(c.face).toBeNull();
  expect(c.angry).toBeNull();
  fs.writeFileSync(path.join(root, 'g', 'angry.png'), '');
  c = loadCharacter('g', root);
  expect(c.angry).toMatch(/g\/angry\.png$/);
  fs.rmSync(root, { recursive: true, force: true });
});
