import assert from "node:assert/strict";
import { sampleFishFlow, advancePlant } from "../src/plant-flow.js";
const fish = [{ p: { x: 0, y: 1, z: 0 }, v: { x: 0.6, z: 0 }, phase: 0 }];
const near = sampleFishFlow({ x: -0.3, y: 1, z: 0 }, fish, 0),
  far = sampleFishFlow({ x: 4, y: 1, z: 4 }, fish, 0);
assert(near.x > 0.03 && Math.abs(far.x) < 1e-6);
assert.equal(
  sampleFishFlow({ x: 0, y: 1, z: 0 }, [{ ...fish[0], v: { x: 0, z: 0 } }], 0)
    .x,
  0,
);
const state = { x: 0, z: 0, vx: 0, vz: 0 };
for (let i = 0; i < 60; i++) advancePlant(state, near, 1 / 60);
assert(state.x > 0.03);
const bent = state.x;
for (let i = 0; i < 600; i++) advancePlant(state, { x: 0, z: 0 }, 1 / 60);
assert(Math.abs(state.x) < bent * 0.01);
assert(Number.isFinite(state.x));
console.log(
  "PASS: local fish wake bends plants; distant/stationary fish do not; plants settle after the wake passes.",
);
