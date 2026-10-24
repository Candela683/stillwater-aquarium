import * as T from "three";
export function packRockDetail(normalData, armData) {
  const packed = new Uint8Array(normalData.length);
  for (let i = 0; i < packed.length; i += 4) {
    packed[i] = normalData[i];
    packed[i + 1] = normalData[i + 1];
    packed[i + 2] = armData[i + 1];
    packed[i + 3] = armData[i];
  }
  return packed;
}
export async function loadAquascapeRock() {
  const dir = (import.meta.env?.BASE_URL ?? "/") + "models/rock-07/";
  const [geometry, map, normalMap, arm] = await Promise.all([
    new T.BufferGeometryLoader().loadAsync(dir + "rock-07-low.json"),
    new T.TextureLoader().loadAsync(dir + "textures/rock_07_diff_1k.jpg"),
    new T.TextureLoader().loadAsync(dir + "textures/rock_07_nor_gl_1k.jpg"),
    new T.TextureLoader().loadAsync(dir + "textures/rock_07_arm_1k.jpg"),
  ]);
  for (const texture of [map, normalMap, arm]) {
    texture.flipY = false;
    texture.anisotropy = 4;
  }
  map.colorSpace = T.SRGBColorSpace;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new T.Vector3()),
    size = geometry.boundingBox.getSize(new T.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(2 / size.x, 2 / size.y, 2 / size.z);
  geometry.computeVertexNormals();
  // Pack normal XY, roughness and occlusion into one ray-shader sampler (16 total).
  const canvas = document.createElement("canvas");
  canvas.width = normalMap.image.width;
  canvas.height = normalMap.image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(normalMap.image, 0, 0, canvas.width, canvas.height);
  const normalData = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  ).data;
  context.drawImage(arm.image, 0, 0, canvas.width, canvas.height);
  const armData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const detail = new T.DataTexture(
    packRockDetail(normalData, armData),
    canvas.width,
    canvas.height,
    T.RGBAFormat,
  );
  detail.flipY = false;
  detail.generateMipmaps = true;
  detail.minFilter = T.LinearMipmapLinearFilter;
  detail.magFilter = T.LinearFilter;
  detail.needsUpdate = true;
  const material = new T.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new T.Vector2(0.85, 0.85),
    roughnessMap: arm,
    roughness: 0.76,
    metalness: 0,
    color: 0x87928f,
    aoMap: arm,
    aoMapIntensity: 0.7,
  });
  return { geometry, material, map, detail };
}
