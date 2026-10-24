import assert from "node:assert/strict";
import {
  createLeafFlex,
  advanceLeafFlex,
  leafOffset,
} from "../src/leaf-flex.js";
const leaf = createLeafFlex(1.7),
  quiet = createLeafFlex(0.55),
  flow = Array.from({ length: 5 }, () => ({ x: 0.24, z: 0.08 })),
  zero = flow.map(() => ({ x: 0, z: 0 }));
for (let i = 0; i < 120; i++) {
  advanceLeafFlex(leaf, flow, 1 / 60);
  assert.equal(advanceLeafFlex(quiet, zero, 1 / 60), false);
}
assert.deepEqual(leafOffset(leaf, 0), { x: 0, z: 0 });
assert(leafOffset(leaf, 0.0001).x / 0.0001 < 0.0001, "pinned root tangent");
assert(
  leafOffset(leaf, 1).x > 0 && leafOffset(leaf, 1).x < 0.066,
  "subtle bounded bending",
);
const eps = 0.00001;
for (let t = 0.05; t < 0.99; t += 0.05) {
  const a = leafOffset(leaf, t - eps),
    b = leafOffset(leaf, t),
    c = leafOffset(leaf, t + eps);
  assert(
    Math.abs((b.x - a.x) / eps - (c.x - b.x) / eps) < 0.0001,
    "continuous slope",
  );
}
assert.deepEqual(
  leafOffset(quiet, 1),
  { x: 0, z: 0 },
  "independent leaves remain still",
);
for (let i = 0; i < 900; i++) advanceLeafFlex(leaf, zero, 1 / 60);
assert(leaf.sleeping);
assert.deepEqual(leafOffset(leaf, 1), { x: 0, z: 0 });
console.log(
  "PASS: continuous bending, fixed root/tangent, bounded motion, independent still leaves, damped rest and sleep.",
);
