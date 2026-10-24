import assert from "node:assert/strict";
import * as T from "three";
import { bendFishBody } from "../src/fish-body.js";
const head = new T.Vector3(0.13, 0.02, 0.01),
  mid = new T.Vector3(-0.035, 0.02, 0),
  tail = new T.Vector3(-0.17, 0, 0);
const a = mid.clone(),
  b = mid.clone();
bendFishBody(a, 0);
bendFishBody(b, Math.PI);
assert(Math.abs(a.z - b.z) > 0.008, "body itself flexes, not just the tail");
const h = head.clone();
bendFishBody(h, 1.2);
assert(h.distanceTo(head) < 1e-8, "head is stable");
let peak = 0;
for (let i = 0; i < 100; i++) {
  const p = tail.clone();
  bendFishBody(p, (i / 100) * 2 * Math.PI);
  peak = Math.max(peak, Math.abs(p.z));
  assert.equal(p.y, tail.y);
}
assert(peak > 0.025 && peak < 0.04);
console.log(
  "PASS: steady head, flexible body, growing tail amplitude and no vertical roll.",
);
