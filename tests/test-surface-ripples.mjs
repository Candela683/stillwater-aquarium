import assert from "node:assert/strict";
import { createSurfaceRippleDriver } from "../src/surface-ripples.js";
const size = 64,
  driver = createSurfaceRippleDriver({ size, width: 6, depth: 3 });
const h = new Float32Array(size * size),
  v = new Float32Array(size * size),
  next = new Float32Array(size * size);
let peak = 0,
  minRms = Infinity,
  maxRms = 0;
for (let frame = 0; frame < 7200; frame++) {
  driver.inject(v, 1 / 60);
  for (let z = 1; z < size - 1; z++)
    for (let x = 1; x < size - 1; x++) {
      const i = z * size + x;
      v[i] =
        (v[i] +
          ((h[i - 1] + h[i + 1] + h[i - size] + h[i + size]) * 0.25 - h[i]) *
            2) *
        0.995;
      next[i] = h[i] + v[i];
    }
  h.set(next);
  if (frame % 60 === 0) {
    let squared = 0;
    for (const height of h) {
      assert(Number.isFinite(height));
      peak = Math.max(peak, Math.abs(height));
      squared += height * height;
    }
    const rms = Math.sqrt(squared / h.length);
    if (frame > 600) {
      minRms = Math.min(minRms, rms);
      maxRms = Math.max(maxRms, rms);
    }
  }
}
assert(minRms > 0.0001, "ripples remain present without fish or clicks");
assert(peak < 0.035, "sustained movement stays gentle and stable");
assert(maxRms / minRms < 4, "no long-term runaway energy");
for (let i = 0; i < size; i++)
  for (const edge of [i, (size - 1) * size + i, i * size, i * size + size - 1])
    assert.equal(h[edge], 0, "tank boundaries remain pinned");
const impulse = new Float64Array(size * size),
  isolated = createSurfaceRippleDriver({ size, width: 6, depth: 3 });
for (let i = 0; i < 100; i++) isolated.inject(impulse, 1 / 60);
assert(
  Math.abs(impulse.reduce((sum, value) => sum + value, 0)) < 1e-10,
  "circulation does not add water volume",
);
console.log(
  "PASS: two minutes of persistent gentle ripples, bounded energy, zero-volume forcing and fixed boundaries.",
  { peak, minRms, maxRms },
);
