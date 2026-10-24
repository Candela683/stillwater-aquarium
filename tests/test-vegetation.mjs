import * as T from "three";
import assert from "node:assert/strict";
import { createVegetation } from "../src/vegetation.js";
import { createFlowField } from "../src/flow-field.js";
import { updateHairgrass } from "../src/hairgrass-flow.js";
let seed = 18;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const scene = new T.Scene();
const soilHeight = (x, z) =>
  0.18 +
  (0.17 * (z + 1.5)) / 3 +
  0.18 * Math.exp(-((x + 1.6) ** 2 + (z + 0.5) ** 2));
const obstacles = [
  [-1.5, -0.35, 0.92],
  [-2.05, 0.12, 0.52],
  [1.55, -0.65, 0.68],
].map(([x, z, r]) => ({ p: new T.Vector3(x, 0, z), r }));
const plants = createVegetation({ scene, soilHeight, obstacles, random });
console.log(plants.stats);
for (const mesh of plants.allMeshes) {
  const { position, normal } = mesh.geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    if (
      ![
        position.getX(i),
        position.getY(i),
        position.getZ(i),
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i),
      ].every(Number.isFinite)
    )
      throw Error("Non-finite geometry");
    if (Math.abs(position.getX(i)) > 2.94 || Math.abs(position.getZ(i)) > 1.44)
      throw Error("outside tank");
  }
}
// Denser tall pearl planting: keep added plant geometry below 12% of the last scene.
assert(
  plants.stats.triangles < 95526 * 1.12,
  "dense pearl planting geometry budget",
);
const lawn = plants.batches.find((batch) => batch.hairgrass),
  field = createFlowField();
assert(
  lawn && lawn.mesh.userData.deformableLeaves,
  "moving lawn also belongs to the refracted scene",
);
const pos = lawn.mesh.geometry.attributes.position,
  normal = lawn.mesh.geometry.attributes.normal;
const original = pos.array.slice(),
  version = pos.version;
field.update([], 0);
for (let i = 0; i < 24; i++)
  assert.equal(updateHairgrass(lawn, field, 1 / 24), false);
assert.equal(pos.version, version, "quiet lawn must not upload vertices");
const near = lawn.clumps[Math.floor(lawn.clumps.length / 2)];
const fish = {
  p: near.point.clone().add(new T.Vector3(0.1, 0.05, 0)),
  v: { x: 0.45, z: 0 },
  phase: 0,
};
for (let i = 0; i < 48; i++) {
  field.update([fish], i / 24);
  updateHairgrass(lawn, field, 1 / 24);
}
assert(
  near.leaves.some((leaf) => !leaf.flex.sleeping),
  "passing fish bends nearby stems",
);
let active = 0,
  quiet = 0,
  maxOffset = 0;
for (const clump of lawn.clumps)
  for (const leaf of clump.leaves) {
    if (leaf.flex.sleeping) quiet++;
    else active++;
    for (let j = 0; j < leaf.rest.length; j++) {
      const index = leaf.start + j,
        delta = Math.hypot(
          pos.getX(index) - original[index * 3],
          pos.getZ(index) - original[index * 3 + 2],
        );
      maxOffset = Math.max(maxOffset, delta);
      if (j < leaf.columns) assert(delta < 1e-7, "roots stay pinned");
      if (clump.point.distanceTo(fish.p) > 1)
        assert(delta < 1e-7, "distant grass stays still");
      assert(
        delta < leaf.length * 0.024,
        "grass only bends a small fraction of its height",
      );
      const n = Math.hypot(
        normal.getX(index),
        normal.getY(index),
        normal.getZ(index),
      );
      assert(
        Number.isFinite(n) && Math.abs(n - 1) < 1e-5,
        "smooth finite normals",
      );
    }
  }
assert(active > 0 && quiet > active, "wake remains local");
assert(maxOffset > 1e-5 && maxOffset < 0.006, "tiny but nonzero motion");
field.update([], 0);
for (let i = 0; i < 240; i++) updateHairgrass(lawn, field, 1 / 24);
assert(
  lawn.leaves.every((leaf) => leaf.flex.sleeping),
  "grass settles after the fish passes",
);
assert.deepEqual(
  pos.array,
  original,
  "settled lawn returns exactly to its rest shape",
);
console.log(
  "PASS: finite surfaces, tank bounds, geometry budget, local subtle grass flex, pinned roots, smooth normals and damped sleep.",
  { active, quiet, maxOffset },
);
