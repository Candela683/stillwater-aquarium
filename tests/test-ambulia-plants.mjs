import assert from "node:assert/strict";
import * as T from "three";
import {
  createAmbuliaPlants,
  updateAmbuliaPlants,
} from "../src/ambulia-plants.js";
import { createFlowField } from "../src/flow-field.js";
import { leafOffset } from "../src/leaf-flex.js";
function make(seed) {
  return createAmbuliaPlants({
    scene: new T.Scene(),
    soilHeight: () => 0.3,
    obstacles: [],
    material: new T.MeshStandardMaterial(),
    random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
  });
}
for (let seed = 1; seed <= 12; seed++) {
  const { mesh, stats } = make(seed),
    position = mesh.geometry.attributes.position;
  assert(
    stats.leaves === stats.whorls * 6 &&
      stats.pinnae > stats.leaves * 8 &&
      stats.pinnae <= stats.leaves * 10,
    "leaf budget redistributed into finer crowns",
  );
  assert(
    stats.shoots >= 30 && stats.triangles < 42000,
    "lush but bounded geometry",
  );
  for (let i = 0; i < position.count; i++)
    assert(
      Math.abs(position.getX(i)) < 2.94 &&
        Math.abs(position.getZ(i)) < 1.44 &&
        position.getY(i) < 2.79,
      "plants stay inside glass and below water",
    );
}
const { batch, stats } = make(18),
  { position, normal } = batch.mesh.geometry.attributes,
  original = position.array.slice();
const field = createFlowField(),
  version = position.version;
let bent = 0,
  left = 0,
  right = 0;
for (const shoot of batch.shoots) {
  assert(
    shoot.leaves.length >= 48 && shoot.leaves.length <= 60,
    "many stacked leaf whorls",
  );
  const levels = shoot.whorls.map((w) => w.level),
    last = levels.length - 1;
  assert(
    levels[last] - levels[last - 2] < (levels[2] - levels[0]) * 0.35,
    "upper internodes are compressed into a crown",
  );
  assert(
    shoot.whorls.slice(-3).every((w) => w.count === 8) &&
      shoot.whorls.slice(0, 3).every((w) => w.count === 4),
    "leaf whorls get fuller toward the crown",
  );
  const end = shoot.samples[3],
    middle = shoot.samples[1],
    lineMiddle = shoot.root.clone().lerp(end, 0.5);
  if (middle.distanceTo(lineMiddle) > 0.035) bent++;
  if (end.x - shoot.root.x < -0.04) left++;
  if (end.x - shoot.root.x > 0.04) right++;
  assert(
    shoot.tangentAt(1).y > 0.6,
    "crowns lean gently without folding the stem",
  );
}
assert(
  bent > stats.shoots * 0.65 && left > 5 && right > 5,
  "visible, differently directed stem arcs and S-curves",
);
field.update([], 0);
for (let i = 0; i < 24; i++)
  assert.equal(updateAmbuliaPlants(batch, field, 1 / 24), false);
assert.equal(
  position.version,
  version,
  "no global swaying or uploads without flow",
);
const near = batch.shoots[15],
  fish = {
    p: near.samples[2].clone().add(new T.Vector3(0.1, 0, 0)),
    v: { x: 0.65, z: 0 },
    phase: 0,
  };
for (let i = 0; i < 48; i++) {
  field.update([fish], i / 24);
  updateAmbuliaPlants(batch, field, 1 / 24);
}
let active = 0,
  still = 0,
  maxOffset = 0;
for (const shoot of batch.shoots) {
  if (!shoot.flex.sleeping) active++;
  else still++;
  for (const leaf of shoot.leaves) {
    const offset = leafOffset(shoot.flex, leaf.baseT);
    assert(
      Math.abs(
        position.getX(leaf.start) - original[leaf.start * 3] - offset.x,
      ) < 1e-6,
      "frond root remains on its moving stem",
    );
    assert(
      Math.abs(
        position.getZ(leaf.start) - original[leaf.start * 3 + 2] - offset.z,
      ) < 1e-6,
      "frond root remains on its moving stem",
    );
  }
  for (let i = shoot.start; i < shoot.end; i++) {
    const delta = Math.hypot(
      position.getX(i) - original[i * 3],
      position.getZ(i) - original[i * 3 + 2],
    );
    maxOffset = Math.max(maxOffset, delta);
    if (i === shoot.start) assert(delta < 1e-7, "stem root pinned");
    const n = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    assert(
      Number.isFinite(n) && Math.abs(n - 1) < 1e-5,
      "smooth finite normals",
    );
  }
}
assert(
  active > 0 && still > active && maxOffset > 0 && maxOffset < 0.035,
  "subtle local response",
);
field.update([], 0);
for (let i = 0; i < 240; i++) updateAmbuliaPlants(batch, field, 1 / 24);
assert.deepEqual(
  position.array,
  original,
  "returns to the exact generated shape",
);
console.log(
  "PASS: curved stems, varied lean, compact leafy crowns, tank clearance, local flex, attached roots and resting sleep.",
  { stats, bent, left, right, active, still, maxOffset },
);
