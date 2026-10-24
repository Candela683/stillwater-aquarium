import assert from "node:assert/strict";
import * as T from "three";
import { advanceSchool, createSchoolGroups } from "../src/schooling.js";
const fish = Array.from({ length: 38 }, (_, i) => ({
  p: new T.Vector3(
    ((i % 8) - 3.5) * 0.32,
    1.5 + Math.floor(i / 8) * 0.09,
    ((i % 3) - 1) * 0.35,
  ),
  v: new T.Vector3(0.3, 0, 0.03),
  group: new T.Group(),
  phase: i * 2.399,
}));
const obstacles = [
  { p: new T.Vector3(-1.5, 0.9, -0.25), r: 0.98, h: 1.15 },
  { p: new T.Vector3(1.55, 0.7, -0.6), r: 0.88, h: 0.8 },
];
let seed = 47;
createSchoolGroups(
  fish,
  () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
);
let edge = 0,
  total = 0,
  maxTurn = 0,
  maxSpeed = 0,
  dartSamples = 0,
  recoveries = 0;
const recovered = new Set();
for (let step = 0; step < 3600; step++) {
  const previous = fish.map((f) => ({
    heading: f.v.clone().normalize(),
    mode: f.dart?.mode,
  }));
  advanceSchool(fish, obstacles, step / 30, 1 / 30);
  assert(
    fish.filter((f) => f.dart.mode === "dart").length <= 1,
    "darts stay individual",
  );
  fish.forEach((f, i) => {
    assert(
      f.swim.keyNeighbours.length <= 2,
      "at most two influential neighbours",
    );
    assert(Number.isFinite(f.p.length()));
    assert(f.v.length() > 0.1 && f.v.length() < 0.98);
    maxSpeed = Math.max(maxSpeed, f.v.length());
    if (f.dart.mode === "dart") dartSamples++;
    if (previous[i].mode === "recover" && f.dart.mode === "cruise") {
      recoveries++;
      recovered.add(i);
      assert(f.v.length() <= 0.531, "back to cruise speed after a dart");
    }
    const forward = new T.Vector3(1, 0, 0).applyQuaternion(f.group.quaternion);
    assert(
      forward.dot(f.v.clone().normalize()) > 0.9999,
      "body must follow velocity, no lateral skating",
    );
    const back = new T.Vector3(0, 1, 0).applyQuaternion(f.group.quaternion);
    const side = new T.Vector3(0, 0, 1).applyQuaternion(f.group.quaternion);
    assert(back.y > Math.cos(0.321), "back stays upright");
    assert(Math.abs(side.y) < 1e-6, "no rolling during turns");
    const turn = previous[i].heading.angleTo(f.v);
    const turnLimit =
      Math.hypot(1.55 + 1.55 * f.dart.boost, 0.45 + 0.25 * f.dart.boost) / 30;
    assert(
      turn <= turnLimit + 1e-6,
      "turn rate follows bounded dart/cruise envelope",
    );
    maxTurn = Math.max(maxTurn, turn);
    if (
      Math.abs(f.p.x) > 2.82 ||
      Math.abs(f.p.z) > 1.31 ||
      f.p.y < 0.53 ||
      f.p.y > 2.69
    )
      edge++;
    total++;
  });
}
assert(maxTurn < 0.107, "bounded turning rate even while darting");
assert(edge / total < 0.005, "predictive steering should avoid safety clamp");
assert(
  Math.max(...fish.map((f) => f.v.length())) -
    Math.min(...fish.map((f) => f.v.length())) >
    0.015,
  "individual speeds",
);
assert(maxSpeed > 0.75, "darts visibly accelerate beyond ordinary cruise");
assert(
  dartSamples > 30 && dartSamples / total < 0.004,
  "brief occasional darts, not a constantly racing school",
);
assert(
  recoveries >= 4 && recovered.size >= 3,
  "multiple individuals recover from darts",
);
console.log(
  "PASS: 120 seconds, finite motion, bounded turns, upright bodies, rare individual darts and recovery.",
  { edge, total, maxTurn, maxSpeed, dartSamples, recoveries },
);
