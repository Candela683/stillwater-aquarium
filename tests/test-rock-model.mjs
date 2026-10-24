import fs from "node:fs";
import assert from "node:assert/strict";
import * as T from "three";
import { packRockDetail } from "../src/rock-model.js";
const g = new T.BufferGeometryLoader().parse(
  JSON.parse(fs.readFileSync("public/models/rock-07/rock-07-low.json")),
);
assert(g.index.count / 3 < 4000);
for (const key of ["position", "normal", "uv"])
  assert([...g.attributes[key].array].every(Number.isFinite));
assert.equal(g.attributes.uv.count, g.attributes.position.count);
assert.deepEqual(
  packRockDetail(
    Uint8Array.from([128, 133, 255, 255, 98, 167, 242, 255]),
    Uint8Array.from([214, 175, 0, 255, 142, 201, 0, 255]),
  ),
  Uint8Array.from([128, 133, 175, 214, 98, 167, 201, 142]),
  "preserve normal XY, roughness and occlusion in a single texture",
);
console.log(
  "PASS: textured rock geometry, valid UVs/normals, under 4,000 triangles.",
);
