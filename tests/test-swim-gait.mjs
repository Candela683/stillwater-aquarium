import assert from "node:assert/strict";
import { createGait, advanceGait } from "../src/swim-gait.js";
const a = createGait(0.3),
  b = createGait(2.7);
let burst = 0,
  coast = 0,
  different = 0,
  bs = 0,
  cs = 0;
for (let i = 0; i < 1800; i++) {
  const before = a.animationTime;
  advanceGait(a, 1 / 60, 0.3);
  advanceGait(b, 1 / 60, 2.7);
  if (a.mode === "burst") {
    burst++;
    bs += a.animationTime - before;
  } else {
    coast++;
    cs += a.animationTime - before;
    assert.equal(a.drive, 0);
  }
  if (a.mode !== b.mode) different++;
  assert(a.drive >= 0 && a.drive <= 1);
}
assert(burst > 100 && coast > 100);
assert(different > 200);
assert(bs / burst > (cs / coast) * 3);
console.log(
  "PASS: alternating strokes/coasts, asynchronous fish, zero propulsion during coasts, tail playback tied to propulsion.",
);
