import assert from "node:assert/strict";
import * as T from "three";
import { createAquariumLight } from "../src/aquarium-light.js";
for (const [width, height] of [
  [6, 3.1],
  [4.5, 2.8],
]) {
  const scene = new T.Scene(),
    light = createAquariumLight({ scene, width, height });
  scene.updateMatrixWorld(true);
  for (const { pad, x } of light.feet) {
    const bounds = new T.Box3().setFromObject(pad);
    assert(
      Math.abs(bounds.min.y - height) < 1e-7,
      "feet must rest on the top rim",
    );
    assert(
      bounds.min.x <= x - 0.0225 && bounds.max.x >= x + 0.0225,
      "foot spans the actual side glass",
    );
    assert(
      Math.abs(Math.abs(x) - width / 2) < 1e-9,
      "feet cannot float inside tank",
    );
  }
  // All pieces must form a single physically connected assembly, including the diffuser.
  const bounds = light.parts.map((part) =>
    new T.Box3().setFromObject(part).expandByScalar(1e-6),
  );
  const connected = new Set([0]);
  for (let pass = 0; pass < bounds.length; pass++)
    for (let i = 0; i < bounds.length; i++) {
      if ([...connected].some((j) => bounds[i].intersectsBox(bounds[j])))
        connected.add(i);
    }
  assert.equal(
    connected.size,
    light.parts.length,
    "lamp body, arms and feet must connect",
  );
}
console.log(
  "PASS: rim contact, glass alignment and connected lamp assembly at both tank sizes.",
);
