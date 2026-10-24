import assert from "node:assert/strict";
import * as T from "three";
import {
  advanceSchool,
  createSchoolGroups,
  startleSchool,
} from "../src/schooling.js";
function make(positions) {
  let seed = 61;
  const fish = positions.map((p, i) => ({
    p: new T.Vector3(...p),
    v: new T.Vector3(0.25, 0, 0),
    group: new T.Group(),
    phase: i * 2.399,
  }));
  createSchoolGroups(
    fish,
    () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
  );
  return fish;
}
function check(f) {
  assert(
    Number.isFinite(f.p.length()) && f.v.length() <= 1.151,
    "finite bounded speed",
  );
  assert(
    Math.abs(f.p.x) < 2.82 &&
      Math.abs(f.p.z) < 1.31 &&
      f.p.y > 0.53 &&
      f.p.y < 2.69,
    "escape avoids the numerical boundary",
  );
  const forward = new T.Vector3(1, 0, 0).applyQuaternion(f.group.quaternion),
    up = new T.Vector3(0, 1, 0).applyQuaternion(f.group.quaternion);
  assert(
    forward.dot(f.v.clone().normalize()) > 0.9999 && up.y > Math.cos(0.321),
    "upright fish follows velocity during escape",
  );
}
const positions = [
    [0, 1.65, -0.2],
    [0.22, 1.7, 0.2],
    [0.35, 1.55, 0],
    [2.1, 1.6, -0.4],
    [2.2, 1.8, 0.3],
  ],
  fish = make(positions),
  control = make(positions);
const origin = new T.Vector3(-0.45, 1.65, 0),
  initial = fish.map((f) => f.p.clone());
assert.equal(
  startleSchool(fish, origin, [], 0),
  3,
  "only nearby fish are startled",
);
assert(
  fish.slice(0, 3).every((f) => f.dart.mode === "react" && f.dart.delay > 0),
  "small reaction delay",
);
assert(
  fish.slice(3).every((f) => f.dart.mode === "cruise"),
  "distant fish stay calm",
);
assert(
  fish.every((f, i) => f.p.equals(initial[i])),
  "click never teleports fish",
);
assert.equal(
  startleSchool(fish, origin, [], 0.05),
  0,
  "rapid repeated clicks are debounced",
);
let peak = 0,
  escapeGain = 0;
for (let step = 1; step <= 240; step++) {
  const time = step / 60;
  advanceSchool(fish, [], time, 1 / 60);
  advanceSchool(control, [], time, 1 / 60);
  fish.forEach(check);
  peak = Math.max(peak, ...fish.slice(0, 3).map((f) => f.v.length()));
  if (step === 60)
    escapeGain =
      fish
        .slice(0, 3)
        .reduce(
          (sum, f, i) =>
            sum + f.p.distanceTo(origin) - control[i].p.distanceTo(origin),
          0,
        ) / 3;
}
assert(
  peak > 0.85 && escapeGain > 0.15,
  "nearby fish visibly accelerate away from the tap",
);
assert(
  fish
    .slice(0, 3)
    .every((f) => f.dart.mode === "cruise" && f.v.length() <= 0.531),
  "fish settle back to cruise",
);
assert(
  fish.slice(3).every((f) => f.dart.scares === 0),
  "no unrelated school-wide panic",
);
const rocks = [{ p: new T.Vector3(0.7, 1.5, 0), r: 0.27, h: 0.3 }],
  nearRock = make([[0, 1.65, 0]]);
assert.equal(
  startleSchool(nearRock, new T.Vector3(-0.4, 1.65, 0), rocks, 0),
  1,
);
assert(
  Math.abs(nearRock[0].dart.direction.z) > 0.2,
  "escape route steers around the rock",
);
const nearWall = make([[2.2, 1.6, 0.8]]);
assert.equal(startleSchool(nearWall, new T.Vector3(1.8, 1.6, 0.6), [], 0), 1);
for (let step = 1; step <= 240; step++) {
  advanceSchool(nearRock, rocks, step / 60, 1 / 60);
  advanceSchool(nearWall, [], step / 60, 1 / 60);
  nearRock.forEach(check);
  nearWall.forEach(check);
}
console.log(
  "PASS: localized delayed startle, escape acceleration, upright bodies, calm distant fish, debounce, rock/wall avoidance and recovery.",
  { peak, escapeGain },
);
