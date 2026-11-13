const fs = require('fs');
const vm = require('vm');
const { loadCharacter } = require('../../src/main/characters');

function renderer(id = 'girl') {
  const elements = {};
  const element = () => ({
    style: { setProperty: jest.fn() }, classList: { remove() {}, add() {} },
    addEventListener() {}, getAttribute() { return this.src; },
  });
  const callbacks = new Map();
  let next = 0;
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] ||= element(), addEventListener() {} },
    window: { water: { onShow() {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: (fn) => { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    setInterval: jest.fn(), clearInterval() {},
    character: loadCharacter(id),
  });
  vm.runInContext(fs.readFileSync(require.resolve('../../src/renderer/popup/popup.js'), 'utf8'), context);
  vm.runInContext('info = { character }; setPose("idle_cup", "walking", { travel: "left" });', context);
  return { elements, callbacks, context, tick(time) {
    const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach((fn) => fn(time));
  } };
}

test.each(['girl', 'boy'])('%s walk catches up after a delayed frame and stops on idle', (id) => {
  const r = renderer(id);
  expect(r.elements.char.className).toContain('flip');
  expect(r.elements.sprite.src).toMatch(/walk_side_1.png$/);
  r.tick(375);
  expect(r.elements.sprite.src).toMatch(/walk_side_4.png$/);
  r.tick(1000);
  expect(r.elements.sprite.src).toMatch(/walk_side_1.png$/);
  vm.runInContext('setPose("idle_cup", "idle")', r.context);
  expect(r.callbacks.size).toBe(0);
  expect(r.elements.sprite.src).toMatch(/greeting_1.png$/);
});

test('direction changes cancel the old loop and vertical frames are never mirrored', () => {
  const r = renderer();
  vm.runInContext('setPose("idle_cup", "walking", { travel: "up" })', r.context);
  expect(r.callbacks.size).toBe(1);
  expect(r.elements.char.className).not.toContain('flip');
  expect(r.elements.sprite.src).toMatch(/walk_back_1.png$/);
  r.tick(125);
  expect(r.elements.sprite.src).toMatch(/walk_back_2.png$/);
});

test('side travel speed follows cadence and scale; vertical travel keeps its speed', () => {
  const r = renderer();
  expect(vm.runInContext('travelSpeed("left")', r.context)).toBeCloseTo(0.2016);
  vm.runInContext('character.height = 140', r.context);
  expect(vm.runInContext('travelSpeed("right")', r.context)).toBeCloseTo(0.1008);
  expect(vm.runInContext('travelSpeed("up")', r.context)).toBe(0.16);
});

test('preloading decodes each unique asset and tolerates a missing image', async () => {
  const r = renderer();
  const decoded = [];
  r.context.Image = class {
    async decode() {
      decoded.push(this.src);
      if (this.src.includes('side_2')) throw new Error('missing image');
    }
  };
  await vm.runInContext('preloadCharacter(character)', r.context);
  expect(decoded).toContain('../../../assets/characters/girl/walk_side_8.png');
  expect(decoded).toContain('../../../assets/characters/girl/body.png');
  expect(new Set(decoded).size).toBe(decoded.length);
});

test('girl greeting uses connected drawn arms once, then settles without looping', () => {
  const r = renderer();
  vm.runInContext('character.gestures = { greeting: ["g1", "g2", "g3", "g4"], drinking: ["d1", "d2", "d3", "d4"] }; setPose("idle_cup", "idle", { wave: true })', r.context);
  expect(r.elements.char.className).toContain('drawn-gesture');
  expect(r.elements.sprite.src).toBe('g1');
  r.tick(350);
  expect(r.elements.sprite.src).toBe('g2');
  r.tick(950);
  expect(r.elements.sprite.src).toBe('g4');
  expect(r.callbacks.size).toBe(0);
  vm.runInContext('setPose("idle_cup", "idle")', r.context);
  expect(r.elements.sprite.src).toBe('g1');
  expect(r.callbacks.size).toBe(0);
});

test('drawn drinking reaches the sip pose and lowers the cup without a second rig sip', () => {
  const r = renderer();
  vm.runInContext('character.gestures = { greeting: [], drinking: ["d1", "d2", "d3", "d4"] }; setPose("drinking", "drinking")', r.context);
  expect(r.elements.char.className).toContain('drawn-gesture');
  expect(r.elements.char.className).not.toContain(' sip');
  r.tick(1100);
  expect(r.elements.sprite.src).toBe('d3');
  r.tick(1600);
  expect(r.elements.sprite.src).toBe('d4');
  expect(r.callbacks.size).toBe(0);
});

test.each(['girl', 'boy', 'cat'])('%s keeps the full body while waiting and angry', (id) => {
  const r = renderer(id);
  vm.runInContext('setPose("idle_cup", "idle")', r.context);
  expect(r.elements.char.className).toContain('drawn-gesture');
  expect(r.elements.sprite.src).toMatch(/greeting_1.png$/);
  vm.runInContext('setPose("angry", "angry")', r.context);
  expect(r.elements.char.className).toContain('drawn-gesture');
  expect(r.elements.sprite.src).not.toMatch(/body.png$/);
  // Regression: the face must actually turn angry, not stay on the smiling greeting pose.
  expect(r.elements.sprite.src).toMatch(/angry.png$/);
  expect(r.elements.char.className).toContain('angry');
  vm.runInContext('setPose("idle_cup", "idle")', r.context);
  expect(r.elements.sprite.src).toMatch(/greeting_1.png$/);
});

test('a failed gesture frame falls back to the complete original body and stops playback', () => {
  const r = renderer();
  vm.runInContext('character.gestures = { greeting: ["g1", "g2", "g3", "g4"] }; setPose("idle_cup", "idle", { wave: true })', r.context);
  r.elements.sprite.onerror();
  expect(r.elements.sprite.src).toMatch(/girl\/idle.png$/);
  expect(r.elements.char.className).toContain('drawn-gesture');
  expect(r.callbacks.size).toBe(0);
});

test('missing gesture sets retain the original complete image instead of the cutout torso', () => {
  const r = renderer();
  vm.runInContext('character.gestures = { greeting: [], drinking: [] }; setPose("idle_cup", "idle")', r.context);
  expect(r.elements.sprite.src).toMatch(/girl\/idle.png$/);
  expect(r.elements.char.className).toContain('full-body');
});

test('eight-pose straw sipping holds near the mouth then lowers in two seconds', () => {
  const r = renderer();
  vm.runInContext('character.gestures = { drinking: Array.from({length:8}, (_,i)=>`sip${i+1}`) }; setPose("drinking", "drinking")', r.context);
  r.tick(750);
  expect(r.elements.sprite.src).toBe('sip4');
  r.tick(1250);
  expect(r.elements.sprite.src).toBe('sip6');
  r.tick(1750);
  expect(r.elements.sprite.src).toBe('sip8');
  expect(r.callbacks.size).toBe(0);
});
