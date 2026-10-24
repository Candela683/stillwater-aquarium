import fs from "node:fs";
import assert from "node:assert/strict";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as T from "three";
import { MeshBVH } from "three-mesh-bvh";
import { createTetra } from "../src/tetra-model.js";
globalThis.ProgressEvent = class {};
const path = "public/models/neon-tetra/",
  j = JSON.parse(fs.readFileSync(path + "Neon Tetra 3.gltf"));
j.buffers[0].uri =
  "data:application/octet-stream;base64," +
  fs.readFileSync(path + "Neon Tetra 3.bin").toString("base64");
j.materials = [];
j.textures = [];
j.images = [];
for (const m of j.meshes) for (const p of m.primitives) delete p.material;
const asset = await new GLTFLoader().parseAsync(JSON.stringify(j), "");
asset.scene.traverse((o) => {
  if (o.isMesh) o.material.map = new T.Texture();
});
const tetra = createTetra(asset);
assert.equal(tetra.poses.length, 96);
for (const g of tetra.poses) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++)
    assert(new T.Vector3().fromBufferAttribute(p, i).length() < 0.205);
}
const fish = [0.2, 1.3, 2.9].map((animationTime) => ({
  body: new T.Mesh(tetra.geometry),
  swim: { gait: { animationTime } },
  phase: 0,
}));
tetra.update(fish);
assert.equal(new Set(fish.map((f) => f.poseIndex)).size, 3);
for (const f of fish) assert.equal(f.body.geometry, tetra.poses[f.poseIndex]);
let hits = 0;
for (const index of [0, 15, 47, 95]) {
  const local = new MeshBVH(tetra.poses[index].clone(), { maxLeafSize: 4 });
  for (let x = -0.15; x <= 0.15; x += 0.03) {
    const ray = new T.Ray(
      new T.Vector3(x, 0, 0.25),
      new T.Vector3(0.08, 0, -1).normalize(),
    );
    const expected = local.raycastFirst(ray, T.DoubleSide, 0, 0.5);
    const shifted = ray.clone();
    shifted.origin.x += index;
    const actual = tetra.tree.raycastFirst(shifted, T.DoubleSide, 0, 0.5);
    assert.equal(!!actual, !!expected);
    if (actual) {
      hits++;
      assert(Math.abs(actual.distance - expected.distance) < 0.0001);
    }
  }
}
assert(hits > 0);
console.log(
  "PASS: 96 bounded cached poses; independent fish clocks; raster/ray pose agreement; atlas intersections match local meshes.",
);
