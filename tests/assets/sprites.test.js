'use strict';
const fs = require('fs');
const path = require('path');

const IDS = ['luna', 'kai', 'momo', 'pip', 'pixelcat'];
const STATES = ['idle_cup', 'drinking', 'happy', 'leaving', 'walk_1', 'walk_2'];
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('character sprites', () => {
  for (const id of IDS) {
    for (const state of STATES) {
      test(`${id}/${state}.png is a 64x64 PNG`, () => {
        const file = path.join(__dirname, '..', '..', 'assets', 'characters', id, `${state}.png`);
        expect(fs.existsSync(file)).toBe(true);
        const buf = fs.readFileSync(file);
        expect(buf.subarray(0, 8).equals(SIG)).toBe(true);
        expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
        expect(buf.readUInt32BE(16)).toBe(64);
        expect(buf.readUInt32BE(20)).toBe(64);
      });
    }
  }
});
