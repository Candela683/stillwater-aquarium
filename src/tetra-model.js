import { bendFishBody } from "./fish-body.js";
import * as T from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  FloatVertexAttributeTexture,
} from "three-mesh-bvh";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// The original AeroPlankton skeletal clip is cached; each fish has its own playback clock.
export async function loadTetra() {
  const asset = await new GLTFLoader().loadAsync(
    (import.meta.env?.BASE_URL ?? "/") +
      "models/neon-tetra/Neon%20Tetra%203.gltf",
  );
  return createTetra(asset);
}
export function createTetra(asset) {
  let source;
  asset.scene.traverse((o) => {
    if (o.isSkinnedMesh) source = o;
  });
  if (!source) throw new Error("Neon tetra archive has no skinned mesh");
  const mixer = new T.AnimationMixer(asset.scene);
  if (asset.animations[0]) mixer.clipAction(asset.animations[0]).play();
  asset.scene.updateMatrixWorld(true);
  source.skeleton.update();
  const duration = asset.animations[0]?.duration || 1;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.BufferAttribute(
      new Float32Array(source.geometry.attributes.position.count * 3),
      3,
    ).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute("uv", source.geometry.attributes.uv.clone());
  geometry.setIndex(source.geometry.index.clone());
  const p = new T.Vector3(),
    scale = 0.36 / 3.59094;
  const normalize = new T.Matrix4()
    .makeRotationY(-Math.PI / 2)
    .multiply(new T.Matrix4().makeScale(scale, scale, scale))
    .multiply(new T.Matrix4().makeTranslation(0, -0.18038, -0.029108));
  function bake(time) {
    mixer.setTime(time);
    asset.scene.updateMatrixWorld(true);
    source.skeleton.update();
    const out = geometry.attributes.position;
    for (let i = 0; i < out.count; i++) {
      source
        .getVertexPosition(i, p)
        .applyMatrix4(source.matrixWorld)
        .applyMatrix4(normalize);
      bendFishBody(p, (time / duration) * Math.PI * 10);
      out.setXYZ(i, p.x, p.y, p.z);
    }
    out.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  // Cache 96 poses once. Raster and ray rendering select the exact same pose.
  const poseCount = 96,
    poses = [];
  const atlasPositions = [],
    atlasUVs = [],
    atlasIndices = [],
    uvSource = geometry.attributes.uv;
  for (let frame = 0; frame < poseCount; frame++) {
    bake((duration * frame) / poseCount);
    poses.push(geometry.clone());
    const offset = atlasPositions.length / 3,
      pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      atlasPositions.push(pos.getX(i) + frame, pos.getY(i), pos.getZ(i));
      atlasUVs.push(uvSource.getX(i), uvSource.getY(i));
    }
    for (let i = 0; i < geometry.index.count; i++)
      atlasIndices.push(offset + geometry.index.getX(i));
  }
  const atlas = new T.BufferGeometry();
  atlas.setAttribute(
    "position",
    new T.Float32BufferAttribute(atlasPositions, 3),
  );
  atlas.setAttribute("uv", new T.Float32BufferAttribute(atlasUVs, 2));
  atlas.setIndex(atlasIndices);
  const tree = new MeshBVH(atlas, { maxLeafSize: 4 }),
    gpu = new MeshBVHUniformStruct();
  gpu.updateFrom(tree);
  const uv = new FloatVertexAttributeTexture();
  uv.updateFrom(atlas.attributes.uv);
  const map = source.material.map;
  map.anisotropy = 4;
  const material = new T.MeshPhysicalMaterial({
    map,
    side: T.DoubleSide,
    alphaTest: 0.25,
    roughness: 0.35,
    metalness: 0.33,
    iridescence: 1,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [180, 420],
  });
  material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      "#include <lights_physical_fragment>\nmaterial.iridescence *= smoothstep(0.02,0.15,diffuseColor.b-diffuseColor.r);",
    );
  };
  return {
    geometry: poses[0],
    poses,
    duration,
    poseCount,
    tree,
    material,
    map,
    gpu,
    uv,
    update(fish) {
      for (const f of fish) {
        const time = f.swim?.gait.animationTime ?? f.phase * 0.73;
        const index = Math.floor(
          ((((time % duration) + duration) % duration) / duration) * poseCount,
        );
        f.poseIndex = index;
        if (f.body.geometry !== poses[index]) f.body.geometry = poses[index];
      }
    },
  };
}
