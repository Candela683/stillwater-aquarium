import assert from "node:assert/strict";
import * as T from "three";
import { createPearlPlants, updatePearlPlants } from "../src/pearl-plants.js";
import { pearlLeafSurface } from "../src/pearl-leaf.js";
import { createFlowField } from "../src/flow-field.js";
import { leafOffset } from "../src/leaf-flex.js";
function make(seed) {
  return createPearlPlants({
    scene: new T.Scene(),
    soilHeight: () => 0.25,
    obstacles: [],
    material: new T.MeshStandardMaterial(),
    random: () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296,
  });
}
const plants = make(34),
  repeat = make(34),
  other = make(35),
  field = createFlowField();
assert(
  plants.stats.shoots[0] === 120 && plants.stats.tallLeaves > 2300,
  "denser stems, leaf pairs and side branches",
);
for (let seed = 1; seed <= 12; seed++)
  for (const batch of make(seed).batches) {
    const position = batch.mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++)
      assert(
        Math.abs(position.getX(i)) < 2.94 && Math.abs(position.getZ(i)) < 1.44,
        "growth stays inside glass for different seeds",
      );
  }
let maxOffset = 0,
  active = 0,
  still = 0;
for (let k = 0; k < plants.batches.length; k++) {
  const batch = plants.batches[k],
    { position, normal } = batch.mesh.geometry.attributes;
  const original = position.array.slice(),
    version = position.version,
    leaves = batch.shoots.flatMap((s) => s.leaves);
  assert.deepEqual(
    original,
    repeat.batches[k].mesh.geometry.attributes.position.array,
    "fixed growth seed is repeatable",
  );
  assert.notDeepEqual(
    original,
    other.batches[k].mesh.geometry.attributes.position.array,
    "another seed changes the planting",
  );
  const lengths = leaves.map((l) => l.shape.length),
    widthRatios = leaves.map((l) => l.shape.width / l.shape.length);
  assert(
    Math.max(...lengths) / Math.min(...lengths) > 1.8,
    "size variation is visible",
  );
  assert(
    Math.max(...widthRatios) / Math.min(...widthRatios) > 1.5,
    "width is not a fixed scaled copy",
  );
  assert(
    new Set(
      leaves.map((l) =>
        [l.shape.outline, l.shape.asymmetry, l.shape.cup, l.shape.tipCurl]
          .map((v) => v.toFixed(4))
          .join(","),
      ),
    ).size >
      leaves.length * 0.98,
    "individual silhouettes and curvature",
  );
  let top = 0,
    bottom = 0,
    topCount = 0,
    bottomCount = 0,
    lightFaces = 0,
    frontFaces = 0;
  for (const shoot of batch.shoots) {
    for (const leaf of shoot.leaves) {
      if (leaf.shape.maturity > 0.9) {
        bottom += leaf.shape.length;
        bottomCount++;
      }
      if (leaf.shape.maturity < 0.5) {
        top += leaf.shape.length;
        topCount++;
      }
      if (k === 0) {
        const face = new T.Vector3().fromBufferAttribute(normal, leaf.start);
        const light = new T.Vector3(0, 4.061, 0).sub(leaf.anchor).normalize(),
          front = new T.Vector3(7, 4.6, 10).sub(leaf.anchor).normalize();
        if (face.dot(light) > 0.97) lightFaces++;
        if (face.dot(front) > 0.97 && face.dot(light) < 0.92) frontFaces++;
        assert(face.y > 0, "upper leaf surfaces stay upright");
        for (let i = 0; i < leaf.count; i++)
          assert(
            position.getY(leaf.start + i) > 0.251,
            "tilted leaves clear the soil",
          );
      }
      assert(
        pearlLeafSurface(0, 0, leaf.shape, new T.Vector3()).length() < 1e-10,
        "surface attaches at its root",
      );
      const root = leaf.start + 1 + (leaf.count - 1) / 2;
      assert(
        new T.Vector3()
          .fromBufferAttribute(position, root)
          .distanceTo(leaf.anchor) < 1e-6,
        "leaf touches the stem",
      );
    }
  }
  assert(
    top / topCount < (bottom / bottomCount) * 0.86,
    "new growth is smaller on average",
  );
  if (k === 0) {
    assert(
      lightFaces > leaves.length * 0.25 && frontFaces > leaves.length * 0.2,
      "real leaf faces include both lamp-facing and front-facing leaves",
    );
    console.log("Tall pearl orientations", {
      lightFaces,
      frontFaces,
      total: leaves.length,
    });
  }
  field.update([], 0);
  for (let i = 0; i < 24; i++)
    assert.equal(updatePearlPlants(batch, field, 1 / 24), false);
  assert.equal(
    position.version,
    version,
    "still water makes no geometry uploads",
  );
  const near = batch.shoots[Math.floor(batch.shoots.length / 2)],
    fish = {
      p: near.samples[0].clone().add(new T.Vector3(0.1, 0.04, 0)),
      v: { x: 0.6, z: 0 },
      phase: 0.4,
    };
  for (let i = 0; i < 48; i++) {
    field.update([fish], i / 24);
    updatePearlPlants(batch, field, 1 / 24);
  }
  for (const shoot of batch.shoots) {
    const awake =
      shoot.leaves.some((l) => !l.flex.sleeping) ||
      Boolean(shoot.flex && !shoot.flex.sleeping);
    if (awake) active++;
    else still++;
    for (const leaf of shoot.leaves) {
      const root = leaf.start + 1 + (leaf.count - 1) / 2,
        offset = shoot.flex
          ? leafOffset(shoot.flex, leaf.baseT)
          : { x: 0, z: 0 };
      assert(
        new T.Vector3()
          .fromBufferAttribute(position, root)
          .distanceTo(
            leaf.anchor.clone().add(new T.Vector3(offset.x, 0, offset.z)),
          ) < 1e-6,
        "bending leaf remains attached",
      );
    }
    const p = shoot.start;
    assert(
      Math.hypot(
        position.getX(p) - original[p * 3],
        position.getZ(p) - original[p * 3 + 2],
      ) < 1e-7,
      "stem root stays pinned",
    );
    for (let i = shoot.start; i < shoot.end; i++) {
      const delta = Math.hypot(
        position.getX(i) - original[i * 3],
        position.getZ(i) - original[i * 3 + 2],
      );
      maxOffset = Math.max(maxOffset, delta);
      assert(delta < 0.033, "motion stays restrained");
      const n = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert(
        Number.isFinite(n) && Math.abs(n - 1) < 1e-5,
        "smooth finite normals while moving",
      );
    }
  }
  field.update([], 0);
  for (let i = 0; i < 240; i++) updatePearlPlants(batch, field, 1 / 24);
  assert.deepEqual(
    position.array,
    original,
    "plants settle exactly to their generated shape",
  );
}
assert(active > 0 && still > active, "wake only moves nearby plants");
console.log(
  "PASS: distinct correlated leaf shapes, deterministic growth, smaller new leaves, attached roots, smooth normals, local flex and rest recovery.",
  { active, still, maxOffset, stats: plants.stats },
);
