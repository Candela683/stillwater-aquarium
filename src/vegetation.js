import * as T from "three";
import { createLeafFlex } from "./leaf-flex.js";
import { createPearlPlants } from "./pearl-plants.js";
import { createAmbuliaPlants } from "./ambulia-plants.js";
import { plantLeafColor } from "./plant-colors.js";
const smooth = (a, b, x) => {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Botanical variation is fixed at growth time; flow only bends the existing leaf.
export function leafSurface(t, u, p, out = new T.Vector3()) {
  let w;
  if (p.type === 0) {
    w =
      p.width *
      (0.45 + 0.55 * Math.sin(Math.PI * t) ** 0.5) *
      smooth(0, 0.035, t) *
      (1 - smooth(0.78, 1, t));
  } else if (p.type === 2) {
    // Eleocharis-inspired fine stems: nearly constant width, tapering at the tip.
    w = p.width * (1 - 0.23 * t) * (1 - smooth(0.72, 1, t));
  } else {
    const blade = smooth(0.22, 1, t);
    w = Math.max(
      0.0014 * Math.sin(Math.PI * t),
      p.width * Math.sin(Math.PI * blade) ** 0.8,
    );
  }
  const twist = p.twist * t * t,
    edge = Math.sin(t * 19 + p.phase) * p.ripple * w * Math.abs(u);
  const cupping = w * 0.18 * (1 - u * u) * Math.sin(Math.PI * t);
  out.set(
    p.length * p.side * t * t * (1 - 0.35 * t) + u * w * Math.cos(twist),
    p.length * (t - p.droop * t * t * t) + u * w * Math.sin(twist) * 0.2,
    p.length * p.lean * t * t + u * w * Math.sin(twist) + cupping + edge,
  );
  return out;
}

export function createVegetation({
  scene,
  soilHeight,
  obstacles,
  random,
  lightPosition,
  viewPosition,
}) {
  const batches = [],
    allMeshes = [],
    stats = { leaves: [0, 0, 0], triangles: 0, clumps: [0, 0, 0] };
  const material = new T.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.65,
    side: T.DoubleSide,
  });
  // A restrained thin-leaf fill for the unobstructed raster view. Ray lighting below uses the same intent.
  material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      "#include <lights_fragment_end>",
      "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * 0.055;",
    );
  };
  // Overlapping rooted patches form a lush backdrop and continuous foreground carpet.
  const patches = [
    [
      [-2.12, -0.93, 0.6, 0.32],
      [-0.85, -0.96, 0.69, 0.31],
      [0.4, -0.98, 0.69, 0.3],
      [1.92, -0.91, 0.72, 0.34],
    ],
    [
      [-2.15, 0.3, 0.48, 0.43],
      [-0.75, 0.22, 0.55, 0.43],
      [0.1, 0.28, 0.62, 0.45],
      [1.28, 0.35, 0.62, 0.4],
      [2.24, 0.37, 0.34, 0.38],
    ],
  ];
  const tmp = new T.Vector3(),
    a = new T.Vector3(),
    b = new T.Vector3(),
    root = new T.Vector3();
  for (let type = 0; type < 3; type++) {
    if (type === 0) {
      const ambulia = createAmbuliaPlants({
        scene,
        soilHeight,
        obstacles,
        random,
        material,
      });
      batches.push(ambulia.batch);
      allMeshes.push(ambulia.mesh);
      stats.ambulia = ambulia.stats;
      stats.leaves[0] = ambulia.stats.leaves;
      stats.clumps[0] = ambulia.stats.shoots;
      stats.triangles += ambulia.stats.triangles;
      continue;
    }
    if (type === 1) {
      const pearl = createPearlPlants({
        scene,
        soilHeight,
        obstacles,
        random,
        material,
        lightPosition,
        viewPosition,
      });
      batches.push(...pearl.batches);
      allMeshes.push(...pearl.meshes);
      stats.pearl = pearl.stats;
      stats.leaves[1] = pearl.stats.tallLeaves + pearl.stats.lowLeaves;
      stats.clumps[1] = pearl.stats.shoots.reduce((a, b) => a + b, 0);
      stats.triangles += pearl.stats.triangles;
      continue;
    }
    const positions = [],
      normals = [],
      colors = [],
      indices = [],
      leaves = [],
      clumps = [];
    // Short stems need only six triangles; spend the budget on coverage.
    const lawnColumns = 72,
      lawnRows = 17;
    const clumpCount = [110, 54, lawnColumns * lawnRows][type],
      segments = [16, 10, 3][type],
      columns = type === 1 ? 5 : type === 2 ? 2 : 3;
    for (let clump = 0; clump < clumpCount; clump++) {
      let x,
        z,
        valid = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (type === 2) {
          // Jittered coverage prevents both bare random holes and visible planted rows.
          x =
            -2.83 +
            (((clump % lawnColumns) + 0.12 + random() * 0.76) / lawnColumns) *
              5.66;
          z =
            -0.48 +
            ((Math.floor(clump / lawnColumns) + 0.1 + random() * 0.8) /
              lawnRows) *
              1.82;
          const backEdge =
            -0.29 + 0.15 * Math.sin(x * 2.1) + 0.07 * Math.sin(x * 5.3);
          if (z < backEdge) break;
        } else {
          const patch =
            patches[type][Math.floor(random() * patches[type].length)];
          const theta = random() * Math.PI * 2,
            rr = Math.sqrt(random());
          x = patch[0] + Math.cos(theta) * rr * patch[2];
          z = patch[1] + Math.sin(theta) * rr * patch[3];
          if (Math.abs(x) > 2.7 || Math.abs(z) > 1.29) continue;
        }
        if (
          obstacles.some(
            (o) =>
              Math.hypot(x - o.p.x, z - o.p.z) <
              o.r * (type === 2 ? 0.78 : 0.72),
          )
        ) {
          if (type === 2) break;
          continue;
        }
        valid = true;
        break;
      }
      if (!valid) continue;
      stats.clumps[type]++;
      const leafCount =
        type === 2
          ? 4 + Math.floor(random() * 2)
          : 5 + Math.floor(random() * 3);
      const clumpAngle = random() * Math.PI * 2;
      // Neighbouring shoots share a growth zone, while individual leaves retain variation.
      const growth =
        0.5 +
        0.3 * Math.sin(x * 2.25 + z * 1.4) +
        0.2 * Math.sin(x * 4.1 - z * 2.6);
      const clumpSize =
        (0.78 + random() * 0.35) *
        (type === 0
          ? 0.83 + 0.24 * growth
          : type === 1
            ? 0.86 + 0.22 * growth
            : 0.88 + 0.19 * growth);
      const clumpTone =
        (random() - 0.5) * 0.19 + 0.045 * Math.sin(x * 2.25 + z * 1.4);
      const lawnClump =
        type === 2
          ? {
              point: new T.Vector3(x, soilHeight(x, z) + 0.21 * clumpSize, z),
              probe: new T.Vector3(),
              flow: { x: 0, z: 0 },
              upper: { x: 0, z: 0 },
              leaves: [],
            }
          : null;
      if (lawnClump) clumps.push(lawnClump);
      for (let k = 0; k < leafCount; k++) {
        const age = k / Math.max(1, leafCount - 1),
          length =
            [2.05, 0.76, 0.24][type] *
            clumpSize *
            (type === 2 ? 0.72 + 0.28 * age : 0.52 + 0.57 * age) *
            (0.84 + random() * 0.25);
        const angle = clumpAngle + k * 2.399 + (random() - 0.5) * 0.25;
        const p = {
          type,
          length,
          width:
            [0.043, 0.123, 0.0044][type] *
            (0.65 + 0.5 * age) *
            (0.8 + random() * 0.35),
          droop:
            (type === 0 ? 0.075 : type === 1 ? 0.3 : 0.035) +
            age * (type === 0 ? 0.25 : type === 1 ? 0.18 : 0.09),
          lean:
            (type === 0 ? 0.12 : type === 1 ? 0.3 : 0.12) +
            age * (type === 0 ? 0.3 : type === 1 ? 0.43 : 0.22),
          twist:
            (random() - 0.5) * (type === 0 ? 0.85 : type === 1 ? 0.7 : 0.3),
          side: (random() - 0.5) * (type === 2 ? 0.3 : 0.14),
          ripple: type === 1 ? 0.09 : type === 2 ? 0 : 0.018,
          phase: random() * 6.28,
        };
        const rootSpread = type === 2 ? 0.026 : 0.018;
        root.set(
          x + Math.cos(angle) * rootSpread,
          soilHeight(x, z) + 0.005,
          z + Math.sin(angle) * rootSpread,
        );
        const cos = Math.cos(angle),
          sin = Math.sin(angle),
          rest = [],
          leafNormals = [];
        let inside = true;
        for (let row = 0; row <= segments; row++)
          for (let col = 0; col < columns; col++) {
            const t = row / segments,
              u = (col / (columns - 1)) * 2 - 1;
            leafSurface(t, u, p, tmp);
            const point = new T.Vector3(
              root.x + cos * tmp.x + sin * tmp.z,
              root.y + tmp.y,
              root.z - sin * tmp.x + cos * tmp.z,
            );
            if (
              Math.abs(point.x) > 2.94 ||
              Math.abs(point.z) > 1.44 ||
              point.y > 2.65
            )
              inside = false;
            rest.push(point);
            // Analytic-surface finite derivatives give a smooth normal, including the curled margin.
            const tt = T.MathUtils.clamp(t, 0.0001, 0.9999),
              eps = 0.0001;
            leafSurface(tt + eps, u, p, a);
            leafSurface(tt - eps, u, p, b);
            a.sub(b);
            leafSurface(tt, u + eps, p, b);
            leafSurface(tt, u - eps, p, tmp);
            b.sub(tmp);
            a.cross(b).normalize();
            leafNormals.push(
              new T.Vector3(cos * a.x + sin * a.z, a.y, -sin * a.x + cos * a.z),
            );
          }
        if (!inside) continue;
        const start = positions.length / 3;
        const leafColor = plantLeafColor(
          (1 - age) * 0.9,
          clumpTone,
          random,
          "hairgrass",
        );
        for (let j = 0; j < rest.length; j++) {
          const t = Math.floor(j / columns) / segments,
            u = ((j % columns) / (columns - 1)) * 2 - 1;
          const midrib = Math.exp(-u * u * 45) * 0.065;
          const shade =
            0.43 + 0.54 * smooth(0, 0.65, t) + midrib - 0.045 * Math.abs(u);
          positions.push(...rest[j].toArray());
          normals.push(...leafNormals[j].toArray());
          colors.push(
            leafColor.r * shade,
            leafColor.g * shade,
            leafColor.b * shade,
          );
        }
        for (let row = 0; row < segments; row++)
          for (let col = 0; col < columns - 1; col++) {
            const q = start + row * columns + col;
            indices.push(
              q,
              q + columns,
              q + 1,
              q + 1,
              q + columns,
              q + columns + 1,
            );
          }
        if (type < 2) {
          const middle = (columns - 1) / 2;
          const samples = Array.from({ length: 5 }, (_, i) => {
            const row = ((i + 1) / 5) * segments,
              lo = Math.floor(row),
              hi = Math.min(segments, lo + 1);
            return rest[lo * columns + middle]
              .clone()
              .lerp(rest[hi * columns + middle], row - lo);
          });
          leaves.push({
            start,
            rest,
            segments,
            columns,
            samples,
            flex: createLeafFlex(length),
            flows: samples.map(() => ({ x: 0, z: 0 })),
            point: new T.Vector3(),
            offset: { x: 0, z: 0 },
          });
        } else {
          // Each stem bends independently; nearby stems share local wake samples.
          const leaf = {
            start,
            rest,
            restNormals: leafNormals,
            segments,
            columns,
            length,
            flex: createLeafFlex(length, {
              maxRatio: 0.015,
              maxDeflection: 0.004,
              strength: 0.55 * (0.8 + age * 0.25),
            }),
            flows: [lawnClump.flow],
            offset: { x: 0, z: 0 },
          };
          leaves.push(leaf);
          lawnClump.leaves.push(leaf);
        }
        stats.leaves[type]++;
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.attributes.position.setUsage(T.DynamicDrawUsage);
    if (type === 2) geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.userData.leafSurface = true;
    mesh.userData.deformableLeaves = true;
    scene.add(mesh);
    allMeshes.push(mesh);
    batches.push({ mesh, leaves, hairgrass: type === 2, clumps, tick: 0 });
    stats.triangles += indices.length / 3;
  }
  return { batches, allMeshes, stats };
}
