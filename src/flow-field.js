import { sampleFishFlow } from "./plant-flow.js";
// Spatial buckets only select nearby fish. Exact compact-support sampling avoids
// spreading motion into empty regions through coarse-grid interpolation.
export function createFlowField() {
  const cells = new Map();
  let time = 0;
  const key = (x, y, z) => `${x},${y},${z}`;
  return {
    update(fish, t) {
      time = t;
      cells.clear();
      for (const f of fish) {
        if (Math.hypot(f.v.x, f.v.z) < 0.025) continue;
        for (
          let x = Math.floor((f.p.x - 0.8) * 2);
          x <= Math.floor((f.p.x + 0.8) * 2);
          x++
        )
          for (
            let y = Math.floor((f.p.y - 0.3) * 2);
            y <= Math.floor((f.p.y + 0.3) * 2);
            y++
          )
            for (
              let z = Math.floor((f.p.z - 0.8) * 2);
              z <= Math.floor((f.p.z + 0.8) * 2);
              z++
            ) {
              const k = key(x, y, z);
              if (!cells.has(k)) cells.set(k, []);
              cells.get(k).push(f);
            }
      }
    },
    sample(p, out = { x: 0, z: 0 }) {
      const fish = cells.get(
        key(Math.floor(p.x * 2), Math.floor(p.y * 2), Math.floor(p.z * 2)),
      );
      if (!fish) {
        out.x = out.z = 0;
        return out;
      }
      const flow = sampleFishFlow(p, fish, time);
      out.x = flow.x;
      out.z = flow.z;
      return out;
    },
  };
}
