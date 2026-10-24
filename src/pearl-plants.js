import * as T from "three";
import { createLeafFlex, advanceLeafFlex, leafOffset } from "./leaf-flex.js";
import {
  pearlShootTraits,
  pearlLeafTraits,
  pearlLeafSurface,
  pearlLeafOutline,
} from "./pearl-leaf.js";
import { plantLeafColor } from "./plant-colors.js";
const clamp = T.MathUtils.clamp;
const boundedReach = (point, angle, length) =>
  Math.min(
    length,
    (2.76 - Math.abs(point.x)) / Math.max(0.001, Math.abs(Math.cos(angle))),
    (1.23 - Math.abs(point.z)) / Math.max(0.001, Math.abs(Math.sin(angle))),
  );

// Upright round-leaf stems and creeping, paired spoon leaves, built as curved surfaces.
export function createPearlPlants({
  scene,
  soilHeight,
  obstacles,
  random,
  material,
  lightPosition = new T.Vector3(0, 4.061, 0),
  viewPosition = new T.Vector3(7, 4.6, 10),
}) {
  const batches = [],
    meshes = [],
    stats = { tallLeaves: 0, lowLeaves: 0, shoots: [], triangles: 0 };
  const patches = [
    [
      [-2.3, 0.12, 0.4, 0.34],
      [-0.64, 0.03, 0.54, 0.4],
      [0.38, -0.16, 0.61, 0.42],
      [1.48, 0.14, 0.56, 0.35],
      [2.35, -0.12, 0.34, 0.4],
    ],
    [
      [-2.3, 0.59, 0.43, 0.26],
      [-1.03, 0.63, 0.49, 0.26],
      [0.02, 0.54, 0.57, 0.28],
      [1.12, 0.56, 0.5, 0.26],
      [2.25, 0.49, 0.42, 0.29],
    ],
  ];
  for (let kind = 0; kind < 2; kind++) {
    const positions = [],
      normals = [],
      colors = [],
      indices = [],
      rest = [],
      stemWeights = [],
      shoots = [];
    const dark = new T.Color(kind ? "#376c32" : "#356334");
    function vertex(p, n, color, weight) {
      const i = rest.length;
      rest.push(p.clone());
      stemWeights.push(weight);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      colors.push(color.r, color.g, color.b);
      return i;
    }
    function stem(path, shoot) {
      const segments = kind ? 5 : 6,
        sides = kind ? 2 : 3,
        start = rest.length;
      for (let row = 0; row <= segments; row++) {
        const t = row / segments,
          p = path(t),
          color = dark.clone().multiplyScalar(0.62 + 0.23 * t);
        for (let col = 0; col < sides; col++) {
          const a = (col / sides) * Math.PI * 2,
            n = kind
              ? new T.Vector3(0, 1, 0)
              : new T.Vector3(Math.cos(a), 0, Math.sin(a));
          const point = p.clone();
          if (kind) point.z += (col - 0.5) * 0.007;
          else point.addScaledVector(n, 0.0045 * (1 - 0.5 * t));
          vertex(
            point,
            n,
            color,
            kind ? 0 : clamp((p.y - shoot.root.y) / shoot.height, 0, 1),
          );
        }
      }
      for (let row = 0; row < segments; row++)
        for (let col = 0; col < (kind ? 1 : sides); col++) {
          const next = (col + 1) % sides,
            a = start + row * sides + col,
            b = start + row * sides + next;
          indices.push(a, a + sides, b, b, a + sides, b + sides);
        }
    }
    function leaf(anchor, angle, maturity, shoot) {
      const start = rest.length,
        along = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)),
        across = new T.Vector3(-along.z, 0, along.x);
      const baseT = kind
          ? 0
          : clamp((anchor.y - shoot.root.y) / shoot.height, 0, 1),
        weights = [],
        slopes = [],
        tangentS = [],
        tangentV = [];
      const shape = pearlLeafTraits(kind, shoot.traits, maturity, random),
        rim = kind ? 8 : 10;
      const color = plantLeafColor(
        clamp((1 - maturity) / 0.66, 0, 1),
        shoot.tone,
        random,
        kind ? "lowPearl" : "tallPearl",
      );
      const local = new T.Vector3(),
        a = new T.Vector3(),
        b = new T.Vector3(),
        ds = new T.Vector3(),
        dv = new T.Vector3();
      const tilt = new T.Quaternion(),
        identity = new T.Quaternion();
      const rotate = (v) => {
        const x = v.x,
          z = v.z;
        return v
          .set(along.x * x + across.x * z, v.y, along.z * x + across.z * z)
          .applyQuaternion(tilt);
      };
      if (!kind) {
        // Tip direction and face direction are distinct: tilt the actual surface, not just its yaw.
        pearlLeafSurface(0.5001, 0, shape, a);
        pearlLeafSurface(0.4999, 0, shape, b);
        rotate(ds.copy(a).sub(b));
        pearlLeafSurface(0.5, 0.0001, shape, a);
        pearlLeafSurface(0.5, -0.0001, shape, b);
        rotate(dv.copy(a).sub(b));
        const naturalNormal = new T.Vector3().crossVectors(dv, ds).normalize();
        const viewBias = (random() < 0.42 ? 0.72 : 0.03) + random() * 0.18;
        const normal = lightPosition
          .clone()
          .sub(anchor)
          .normalize()
          .lerp(viewPosition.clone().sub(anchor).normalize(), viewBias);
        normal.x += (random() - 0.5) * 0.18;
        normal.z += (random() - 0.5) * 0.18;
        normal.normalize();
        tilt.setFromUnitVectors(naturalNormal, normal);
        // Lower/edge leaves can tilt only as far as the soil and glass allow.
        for (let attempt = 0; attempt < 6; attempt++) {
          let inside = true;
          for (let i = 0; i < rim; i++) {
            const [s, v] = pearlLeafOutline((i / rim) * Math.PI * 2, shape),
              p = rotate(pearlLeafSurface(s, v, shape, local)).add(anchor);
            if (
              Math.abs(p.x) > 2.94 ||
              Math.abs(p.z) > 1.44 ||
              p.y < soilHeight(p.x, p.z) + 0.002
            ) {
              inside = false;
              break;
            }
          }
          if (inside) break;
          tilt.slerp(identity, attempt === 5 ? 1 : 0.4);
        }
      }
      function point(s, v) {
        const p = rotate(pearlLeafSurface(s, v, shape, local)).add(anchor);
        const eps = 0.0001;
        pearlLeafSurface(s + eps, v, shape, a);
        pearlLeafSurface(s - eps, v, shape, b);
        rotate(
          ds
            .copy(a)
            .sub(b)
            .multiplyScalar(0.5 / eps),
        );
        pearlLeafSurface(s, v + eps, shape, a);
        pearlLeafSurface(s, v - eps, shape, b);
        rotate(
          dv
            .copy(a)
            .sub(b)
            .multiplyScalar(0.5 / eps),
        );
        const n = new T.Vector3().crossVectors(dv, ds).normalize();
        vertex(
          p,
          n,
          color
            .clone()
            .multiplyScalar(0.78 + 0.18 * s + 0.06 * (1 - Math.abs(v))),
          baseT,
        );
        weights.push((s * s * (3 - s)) / 2);
        slopes.push(3 * s - 1.5 * s * s);
        tangentS.push(ds.x, ds.y, ds.z);
        tangentV.push(dv.x, dv.y, dv.z);
      }
      point(0.5, 0);
      for (let i = 0; i < rim; i++)
        point(...pearlLeafOutline((i / rim) * Math.PI * 2, shape));
      for (let i = 0; i < rim; i++)
        indices.push(start, start + 1 + ((i + 1) % rim), start + 1 + i);
      const flow =
        shoot.flows[
          Math.min(
            shoot.flows.length - 1,
            Math.floor(baseT * shoot.flows.length),
          )
        ];
      shoot.leaves.push({
        start,
        count: rim + 1,
        weights,
        slopes,
        shape,
        baseT,
        anchor: anchor.clone(),
        tangentS: new Float32Array(tangentS),
        tangentV: new Float32Array(tangentV),
        flex: createLeafFlex(shape.length, {
          maxRatio: 0.025,
          maxDeflection: 0.002,
          strength: 0.22 + random() * 0.18,
        }),
        flows: [flow],
        offset: { x: 0, z: 0 },
      });
      if (kind) stats.lowLeaves++;
      else stats.tallLeaves++;
    }
    for (let index = 0; index < (kind ? 105 : 120); index++) {
      let x,
        z,
        valid = false;
      for (let attempt = 0; attempt < 45; attempt++) {
        const patch =
            patches[kind][Math.floor(random() * patches[kind].length)],
          angle = random() * Math.PI * 2,
          r = Math.sqrt(random());
        x = patch[0] + Math.cos(angle) * patch[2] * r;
        z = patch[1] + Math.sin(angle) * patch[3] * r;
        if (
          Math.abs(x) > 2.62 ||
          Math.abs(z) > 1.1 ||
          obstacles.some((o) => Math.hypot(x - o.p.x, z - o.p.z) < o.r * 0.83)
        )
          continue;
        valid = true;
        break;
      }
      if (!valid) continue;
      const angle = random() * Math.PI * 2,
        height = kind
          ? 0.1
          : (0.6 + random() * 0.48) * (0.91 + 0.12 * Math.sin(x * 2.4));
      const root = new T.Vector3(x, soilHeight(x, z) + 0.006, z),
        bend = 0.08 + random() * 0.13,
        spread = 0.24 + random() * 0.14;
      const reach = boundedReach(root, angle, kind ? spread : bend);
      const path = (t) => {
        const p = root.clone();
        p.x += Math.cos(angle) * reach * (kind ? t : t * t);
        p.z += Math.sin(angle) * reach * (kind ? t : t * t);
        p.y = kind
          ? soilHeight(p.x, p.z) + 0.014 + 0.012 * Math.sin(t * Math.PI)
          : root.y + height * t;
        return p;
      };
      const sampleCount = kind ? 1 : 3;
      const shoot = {
        root,
        height,
        traits: pearlShootTraits(kind, random),
        tone: (random() - 0.5) * 0.22,
        start: rest.length,
        end: 0,
        leaves: [],
        flex: kind
          ? null
          : createLeafFlex(height, {
              maxRatio: 0.025,
              maxDeflection: 0.02,
              strength: 0.55,
            }),
        samples: Array.from({ length: sampleCount }, (_, i) =>
          path((i + 1) / sampleCount),
        ),
        flows: Array.from({ length: sampleCount }, () => ({ x: 0, z: 0 })),
        offset: { x: 0, z: 0 },
      };
      if (kind) shoot.samples[0].y += 0.07;
      stem(path, shoot);
      const nodes = kind ? 5 : 8 + Math.floor(random() * 2),
        handedness = random() < 0.5 ? -1 : 1;
      for (let node = 0; node < nodes; node++) {
        const t =
            0.16 + (0.81 * (node + (random() - 0.5) * 0.22)) / (nodes - 1),
          p = path(t),
          maturity = 1 - 0.75 * t ** 3;
        const azimuth =
          angle + node * Math.PI * 0.5 * handedness + (random() - 0.5) * 0.4;
        for (let side = 0; side < 2; side++)
          leaf(
            p,
            azimuth + side * Math.PI + (random() - 0.5) * 0.18,
            maturity,
            shoot,
          );
      }
      // A bounded stochastic branching rule; side shoots inherit the parent traits.
      if (!kind && random() < 0.45) {
        const origin = path(0.28 + random() * 0.2),
          branchAngle = angle + handedness * (0.85 + random() * 0.9),
          branchHeight = height * (0.32 + random() * 0.16);
        const branchReach = boundedReach(origin, branchAngle, 0.2);
        const branch = (t) =>
          origin
            .clone()
            .add(
              new T.Vector3(
                Math.cos(branchAngle) * branchReach * t,
                branchHeight * (t - 0.08 * t * t),
                Math.sin(branchAngle) * branchReach * t,
              ),
            );
        stem(branch, shoot);
        for (let node = 0; node < 4; node++)
          for (let side = 0; side < 2; side++) {
            const t = 0.18 + node * 0.25,
              p = branch(t);
            leaf(
              p,
              branchAngle + node * Math.PI * 0.5 + side * Math.PI,
              0.78 - 0.5 * t ** 3,
              shoot,
            );
          }
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
    mesh.name = kind ? "Low pearl runners" : "Tall round-leaf pearl stems";
    mesh.frustumCulled = false;
    mesh.userData.leafSurface = true;
    mesh.userData.deformableLeaves = true;
    scene.add(mesh);
    meshes.push(mesh);
    batches.push({
      mesh,
      pearl: true,
      kind,
      shoots,
      rest,
      restNormals: new Float32Array(normals),
      stemWeights,
    });
    stats.shoots.push(shoots.length);
    stats.triangles += indices.length / 3;
  }
  return { batches, meshes, stats };
}

export function updatePearlPlants(batch, field, dt) {
  const { position, normal } = batch.mesh.geometry.attributes;
  let changed = false;
  const ds = new T.Vector3(),
    dv = new T.Vector3(),
    n = new T.Vector3();
  for (const shoot of batch.shoots) {
    for (let i = 0; i < shoot.samples.length; i++)
      field.sample(shoot.samples[i], shoot.flows[i]);
    let moved = shoot.flex
      ? advanceLeafFlex(shoot.flex, shoot.flows, dt)
      : false;
    for (const leaf of shoot.leaves)
      moved = advanceLeafFlex(leaf.flex, leaf.flows, dt) || moved;
    if (!moved) continue;
    changed = true;
    for (let i = shoot.start; i < shoot.end; i++) {
      const rest = batch.rest[i];
      shoot.offset.x = shoot.offset.z = 0;
      if (shoot.flex)
        leafOffset(shoot.flex, batch.stemWeights[i], shoot.offset);
      position.setXYZ(
        i,
        rest.x + shoot.offset.x,
        rest.y,
        rest.z + shoot.offset.z,
      );
      n.fromArray(batch.restNormals, i * 3);
      if (shoot.flex) {
        const t = batch.stemWeights[i],
          d1 = (3 * t - 1.5 * t * t) / shoot.height,
          d2 = (8 * t - 12 * t * t) / shoot.height,
          q = shoot.flex.q;
        n.y -= (q[0] * d1 + q[2] * d2) * n.x + (q[1] * d1 + q[3] * d2) * n.z;
        n.normalize();
      }
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    for (const leaf of shoot.leaves) {
      leafOffset(leaf.flex, 1, leaf.offset);
      for (let i = 0; i < leaf.count; i++) {
        const index = leaf.start + i,
          w = leaf.weights[i];
        position.setX(index, position.getX(index) + leaf.offset.x * w);
        position.setZ(index, position.getZ(index) + leaf.offset.z * w);
        ds.fromArray(leaf.tangentS, i * 3);
        dv.fromArray(leaf.tangentV, i * 3);
        ds.x += leaf.offset.x * leaf.slopes[i];
        ds.z += leaf.offset.z * leaf.slopes[i];
        n.crossVectors(dv, ds).normalize();
        normal.setXYZ(index, n.x, n.y, n.z);
      }
    }
  }
  // Surface derivatives preserve smooth shading during flex; no triangle-fan normal seams.
  if (changed) {
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }
  return changed;
}
