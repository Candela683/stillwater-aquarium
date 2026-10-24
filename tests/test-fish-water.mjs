import assert from "node:assert/strict";
import { injectFishWakes } from "../src/fish-water.js";
const config = {
  size: 64,
  width: 6,
  depth: 3,
  waterY: 2.86,
  time: 0.4,
  dt: 1 / 60,
};
const fish = (y) => [
  { p: { x: 0, y, z: 0 }, v: { x: 0.7, z: 0.1 }, phase: 0.2 },
];
const near = new Float32Array(4096),
  deep = new Float32Array(4096);
const a = injectFishWakes(fish(2.6), near, config),
  b = injectFishWakes(fish(1), deep, config);
assert(a > 0 && a > b * 10, "Near-surface fish must cause stronger wakes");
assert(
  Math.abs(near.reduce((a, b) => a + b, 0)) < 1e-8,
  "Wake must not accumulate water volume",
);
const still = fish(2.6);
still[0].v = { x: 0, z: 0 };
assert.equal(injectFishWakes(still, new Float32Array(4096), config), 0);
for (let i = 0; i < 64; i++) assert.equal(near[i], 0);
assert(near.every(Number.isFinite));
console.log(
  "PASS: moving fish disturb water; depth attenuates wakes; stationary fish add no energy; volume and boundaries preserved.",
);
