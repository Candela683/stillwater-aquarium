import assert from "node:assert/strict";
import * as T from "three";
import { advanceSchool, createSchoolGroups } from "../src/schooling.js";
let seed = 23;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
const fish = Array.from({ length: 38 }, (_, i) => ({
  p: new T.Vector3(((i % 8) - 4) * 0.12, 1.7, ((i % 3) - 1) * 0.1),
  v: new T.Vector3(0.3, 0, 0),
  group: new T.Group(),
  phase: i * 2.399,
}));
const state = createSchoolGroups(fish, random);
assert(state.groups.length >= 3 && state.groups.length <= 4);
assert(
  Math.max(...state.groups.map((g) => g.count)) -
    Math.min(...state.groups.map((g) => g.count)) <=
    1,
);
let switches = 0;
for (let i = 0; i < 3600; i++) {
  const before = fish.map((f) => f.school.id);
  advanceSchool(fish, [], i / 30, 1 / 30);
  fish.forEach((f, j) => {
    if (f.school.id !== before[j]) switches++;
    assert(f.school.transition >= 0 && f.school.transition <= 1);
  });
  for (const g of state.groups)
    assert.equal(g.count, fish.filter((f) => f.school.id === g.id).length);
  assert(state.groups.every((g) => g.count >= 4));
}
assert(switches > 0, "nearby fish can change schools");
console.log(
  "PASS: seeded random groups, balanced start, local membership exchanges, minimum group size, consistent counts; exchanges:",
  switches,
);
