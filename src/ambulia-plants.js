import * as T from "three";
import { createLeafFlex } from "./leaf-flex.js";
import { plantLeafColor } from "./plant-colors.js";
// Both plants use the same continuous stem/frond bending and derivative normals.
export { updatePearlPlants as updateAmbuliaPlants } from "./pearl-plants.js";

export function createAmbuliaPlants({
  scene,
  soilHeight,
  obstacles,
  random,
  material,
}) {
  const positions = [],
    normals = [],
    colors = [],
    indices = [],
    rest = [],
    stemWeights = [],
    shoots = [];
  const stats = { shoots: 0, whorls: 0, leaves: 0, pinnae: 0, triangles: 0 };
  const dark = new T.Color("#2e6634"),
    budColor = new T.Color("#c4e778");
  const smooth = (a, b, value) => {
    const t = T.MathUtils.clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const vertex = (p, n, c, t) => {
    const i = rest.length;
    rest.push(p.clone());
    stemWeights.push(t);
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    colors.push(c.r, c.g, c.b);
    return i;
  };
  function frond(anchor, angle, size, rise, level, shoot) {
    const up = shoot.tangentAt(level),
      along = new T.Vector3(Math.cos(angle), 0, Math.sin(angle))
        .projectOnPlane(up)
        .normalize();
    const across = new T.Vector3().crossVectors(along, up).normalize();
    // A finely pinnate leaf: a narrow rachis with individually sized, tapered pinnae.
    const length = size * (0.82 + random() * 0.35),
      width = length * (0.28 + random() * 0.13),
      twist = (random() - 0.5) * 0.45;
    const curl = (random() - 0.5) * 0.23,
      asymmetry = (random() - 0.5) * 0.22;
    const crown = smooth(0.76, 0.96, level),
      arch = crown * 0.075;
    const color = plantLeafColor(level, shoot.tone, random).lerp(
      budColor,
      crown * 0.42,
    );
    const start = rest.length,
      weights = [],
      slopes = [],
      tangentS = [],
      tangentV = [];
    function point(s, v) {
      const side = width * v * (1 + asymmetry * v),
        p = anchor
          .clone()
          .addScaledVector(along, length * s)
          .addScaledVector(across, side);
      p.addScaledVector(
        up,
        length * (rise * s + arch * Math.sin(Math.PI * s)) +
          width * (curl * v * v + twist * v * s),
      );
      const ds = along
        .clone()
        .multiplyScalar(length)
        .addScaledVector(
          up,
          length * (rise + arch * Math.PI * Math.cos(Math.PI * s)) +
            width * twist * v,
        );
      const dv = across
        .clone()
        .multiplyScalar(width * (1 + 2 * asymmetry * v))
        .addScaledVector(up, width * (2 * curl * v + twist * s));
      const n = new T.Vector3().crossVectors(dv, ds).normalize();
      const id = vertex(
        p,
        n,
        color.clone().multiplyScalar(0.8 + 0.18 * s + 0.05 * Math.abs(v)),
        level,
      );
      weights.push((s * s * (3 - s)) / 2);
      slopes.push(3 * s - 1.5 * s * s);
      tangentS.push(ds.x, ds.y, ds.z);
      tangentV.push(dv.x, dv.y, dv.z);
      return id;
    }
    // Two longitudinal intervals on the thin midrib, independent of the flex modes.
    for (let i = 0; i < 3; i++) {
      point(i / 2, -0.022);
      point(i / 2, 0.022);
    }
    for (let i = 0; i < 2; i++) {
      const q = start + i * 2;
      indices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
    const pairs = crown > 0.4 ? 5 : 4;
    for (let i = 0; i < pairs; i++)
      for (const side of [-1, 1]) {
        const s = 0.1 + (i * 0.57) / (pairs - 1) + (random() - 0.5) * 0.025;
        const span =
          (0.56 + 0.44 * Math.sin(((i + 0.8) / (pairs + 0.5)) * Math.PI)) *
          (0.84 + random() * 0.26);
        const advance = 0.15 + random() * 0.09,
          thin = (0.025 + random() * 0.02) * (1 - 0.22 * level);
        const root = point(s, 0),
          a = point(s + advance * 0.5 - thin, side * span * 0.52);
        if (i >= 3) {
          // The smallest distal pinnae taper to a single wedge; spend faces on extra shoots.
          const tip = point(Math.min(0.98, s + advance), side * span);
          if (side > 0) indices.push(root, a, tip);
          else indices.push(root, tip, a);
        } else {
          const b = point(s + advance * 0.5 + thin, side * span * 0.52),
            tip = point(Math.min(0.98, s + advance), side * span);
          if (side > 0) indices.push(root, a, b, b, a, tip);
          else indices.push(root, b, a, a, b, tip);
        }
        stats.pinnae++;
      }
    const flow = shoot.flows[Math.min(3, Math.floor(level * 4))];
    shoot.leaves.push({
      start,
      count: rest.length - start,
      weights,
      slopes,
      baseT: level,
      anchor: anchor.clone(),
      length,
      crown,
      tangentS: new Float32Array(tangentS),
      tangentV: new Float32Array(tangentV),
      flex: createLeafFlex(length, {
        maxRatio: 0.022,
        maxDeflection: 0.003,
        strength: 0.32 + random() * 0.12,
      }),
      flows: [flow],
      offset: { x: 0, z: 0 },
    });
    stats.leaves++;
  }
  const columns = 9,
    rows = 4;
  for (let index = 0; index < columns * rows; index++) {
    let x,
      z,
      valid = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      x =
        attempt < 12
          ? -2.65 +
            (((index % columns) + 0.13 + random() * 0.74) / columns) * 5.3
          : (random() - 0.5) * 5.1;
      z =
        attempt < 12
          ? -1.17 +
            ((Math.floor(index / columns) + 0.15 + random() * 0.7) / rows) *
              0.55
          : -1.15 + random() * 0.47;
      if (obstacles.some((o) => Math.hypot(x - o.p.x, z - o.p.z) < o.r * 0.69))
        continue;
      if (shoots.some((s) => Math.hypot(x - s.root.x, z - s.root.z) < 0.11))
        continue;
      valid = true;
      break;
    }
    if (!valid) continue;
    const root = new T.Vector3(x, soilHeight(x, z) + 0.006, z),
      height = Math.min(
        2.6 - root.y,
        1.72 + random() * 0.47 + 0.1 * Math.sin(x * 2.1),
      );
    let leanX = (random() - 0.5) * 0.52,
      leanZ = 0.07 + random() * 0.19,
      bowX = (random() - 0.5) * 0.56,
      bowZ = (random() - 0.5) * 0.2;
    // A continuous cubic centreline: individual arcs and gentle S-curves, pinned at the root.
    let fitX = 1,
      fitZ = 1;
    for (let i = 1; i <= 24; i++) {
      const t = i / 24,
        mode = 4 * t * t * (1 - t),
        dx = leanX * t * t + bowX * mode,
        dz = leanZ * t * t + bowZ * mode;
      if (dx > 0) fitX = Math.min(fitX, (2.69 - x) / dx);
      else if (dx < 0) fitX = Math.min(fitX, (-2.69 - x) / dx);
      if (dz > 0) fitZ = Math.min(fitZ, (-0.26 - z) / dz);
      else if (dz < 0) fitZ = Math.min(fitZ, (-1.2 - z) / dz);
    }
    leanX *= fitX;
    bowX *= fitX;
    leanZ *= fitZ;
    bowZ *= fitZ;
    const path = (t) =>
      root
        .clone()
        .add(
          new T.Vector3(
            leanX * t * t + bowX * 4 * t * t * (1 - t),
            height * t,
            leanZ * t * t + bowZ * 4 * t * t * (1 - t),
          ),
        );
    const tangentAt = (t) =>
      new T.Vector3(
        2 * leanX * t + bowX * (8 * t - 12 * t * t),
        height,
        2 * leanZ * t + bowZ * (8 * t - 12 * t * t),
      ).normalize();
    const shoot = {
      root,
      height,
      tangentAt,
      tone: (random() - 0.5) * 0.24,
      start: rest.length,
      end: 0,
      leaves: [],
      flex: createLeafFlex(height, {
        maxRatio: 0.012,
        maxDeflection: 0.019,
        strength: 0.48,
      }),
      samples: Array.from({ length: 4 }, (_, i) => path((i + 1) / 4)),
      flows: Array.from({ length: 4 }, () => ({ x: 0, z: 0 })),
      offset: { x: 0, z: 0 },
    };
    const segments = 9;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments,
        p = path(t),
        up = tangentAt(t);
      for (let side = 0; side < 3; side++) {
        const angle = (side / 3) * Math.PI * 2,
          n = new T.Vector3(Math.cos(angle), 0, Math.sin(angle))
            .projectOnPlane(up)
            .normalize();
        vertex(
          p.clone().addScaledVector(n, 0.005 * (1 - t * 0.65)),
          n,
          dark.clone().multiplyScalar(0.64 + t * 0.3),
          t,
        );
      }
    }
    for (let row = 0; row < segments; row++)
      for (let side = 0; side < 3; side++) {
        const a = shoot.start + row * 3 + side,
          b = shoot.start + row * 3 + ((side + 1) % 3);
        indices.push(a, a + 3, b, b, a + 3, b + 3);
      }
    const nodes = 8 + Math.floor(random() * 3),
      orientation = random() * Math.PI * 2,
      shootSize = 0.92 + random() * 0.16;
    shoot.whorls = [];
    for (let node = 0; node < nodes; node++) {
      const u = T.MathUtils.clamp(
          (node + (random() - 0.5) * 0.1) / (nodes - 1),
          0,
          1,
        ),
        level = 0.12 + 0.86 * (1 - (1 - u) ** 2),
        anchor = path(level);
      const crown = smooth(0.76, 0.98, level),
        size =
          0.262 *
          shootSize *
          (1 - 0.26 * crown) *
          (1 - 0.2 * smooth(0.93, 0.99, level));
      const rise = 0.1 + random() * 0.16 + 0.5 * level ** 6,
        leafCount = node < 3 ? 4 : node >= nodes - 3 ? 8 : 6;
      shoot.whorls.push({ level, count: leafCount });
      for (let k = 0; k < leafCount; k++) {
        const angle =
          orientation +
          node * 0.71 +
          (k * Math.PI * 2) / leafCount +
          (random() - 0.5) * 0.22;
        const maxSize = Math.min(
          size,
          (2.91 - Math.abs(anchor.x)) / 1.5,
          (1.41 - Math.abs(anchor.z)) / 1.5,
        );
        frond(
          anchor,
          angle,
          maxSize,
          rise + crown * 0.16 * Math.sin(k * 2.4 + orientation),
          level,
          shoot,
        );
      }
      stats.whorls++;
    }
    shoot.end = rest.length;
    shoots.push(shoot);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute(
    "normal",
    new T.Float32BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Feathery whorled ambulia background";
  mesh.frustumCulled = false;
  mesh.userData.leafSurface = true;
  mesh.userData.deformableLeaves = true;
  scene.add(mesh);
  stats.shoots = shoots.length;
  stats.triangles = indices.length / 3;
  return {
    mesh,
    batch: {
      mesh,
      ambulia: true,
      shoots,
      rest,
      restNormals: new Float32Array(normals),
      stemWeights,
    },
    stats,
  };
}
