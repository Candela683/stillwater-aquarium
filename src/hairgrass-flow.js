import { advanceLeafFlex, leafOffset } from "./leaf-flex.js";

// Compact fish wakes only: there is no time-based global wind or whole-clump rotation.
export function updateHairgrass(batch, field, dt) {
  batch.tick += dt;
  if (batch.tick < 1 / 12) return false;
  const step = Math.min(batch.tick, 0.1);
  batch.tick = 0;
  const { position, normal } = batch.mesh.geometry.attributes;
  let changed = false;
  for (const clump of batch.clumps) {
    field.sample(clump.point, clump.flow);
    // Attenuated transfer from the lower swimming layer; horizontal wake support stays local.
    clump.probe.copy(clump.point);
    clump.probe.y += 0.65;
    field.sample(clump.probe, clump.upper);
    clump.flow.x += clump.upper.x * 0.35;
    clump.flow.z += clump.upper.z * 0.35;
    for (const leaf of clump.leaves) {
      if (!advanceLeafFlex(leaf.flex, leaf.flows, step)) continue;
      changed = true;
      const q = leaf.flex.q;
      for (let row = 0; row <= leaf.segments; row++) {
        const t = row / leaf.segments;
        leafOffset(leaf.flex, t, leaf.offset);
        const da = 3 * t - 1.5 * t * t,
          db = 8 * t - 12 * t * t;
        const dx = (q[0] * da + q[2] * db) / leaf.length,
          dz = (q[1] * da + q[3] * db) / leaf.length;
        for (let col = 0; col < leaf.columns; col++) {
          const j = row * leaf.columns + col,
            rest = leaf.rest[j],
            n = leaf.restNormals[j];
          position.setXYZ(
            leaf.start + j,
            rest.x + leaf.offset.x,
            rest.y,
            rest.z + leaf.offset.z,
          );
          const ny = n.y - n.x * dx - n.z * dz,
            inv = 1 / (Math.hypot(n.x, ny, n.z) || 1);
          normal.setXYZ(leaf.start + j, n.x * inv, ny * inv, n.z * inv);
        }
      }
    }
  }
  if (changed) {
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }
  return changed;
}
