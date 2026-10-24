import * as T from "three";

export function createAquariumLight({
  scene,
  width,
  height,
  glassThickness = 0.045,
}) {
  const parts = [];
  const metal = new T.MeshStandardMaterial({
    color: 0x333a3d,
    metalness: 0.65,
    roughness: 0.32,
  });
  const rubber = new T.MeshStandardMaterial({
    color: 0x181c1b,
    roughness: 0.95,
  });
  function part(name, size, position, material = metal) {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.userData.rayIgnore = true;
    scene.add(mesh);
    parts.push(mesh);
    return mesh;
  }
  const bodyY = height + 1.02,
    bodyWidth = width - 0.5;
  part("LED housing", [bodyWidth, 0.1, 0.55], [0, bodyY, 0]);
  const emitter = part(
    "LED diffuser",
    [bodyWidth - 0.25, 0.018, 0.43],
    [0, bodyY - 0.059, 0],
    new T.MeshBasicMaterial({ color: 0xf2fff0, toneMapped: false }),
  );
  const feet = [];
  for (const side of [-1, 1]) {
    const x = (side * width) / 2,
      z = -0.17;
    // The pad bottom is exactly on the top edge of the side glass pane.
    const pad = part(
      "Glass rim pad",
      [0.11, 0.014, 0.36],
      [x, height + 0.007, z],
      rubber,
    );
    const foot = part(
      "Rim saddle",
      [0.13, 0.038, 0.38],
      [x, height + 0.033, z],
    );
    for (const face of [-1, 1]) {
      part(
        "Clamp cheek",
        [0.018, 0.1, 0.27],
        [x + face * (glassThickness / 2 + 0.011), height - 0.025, z],
      );
    }
    const stemBottom = height + 0.052,
      stemTop = bodyY - 0.035;
    part(
      "Upright",
      [0.032, stemTop - stemBottom, 0.032],
      [x, (stemTop + stemBottom) / 2, z],
    );
    const inner = side * (bodyWidth / 2 - 0.045);
    part(
      "Inward support arm",
      [Math.abs(x - inner) + 0.032, 0.032, 0.032],
      [(x + inner) / 2, stemTop, z],
    );
    feet.push({ pad, foot, x });
  }
  return {
    parts,
    feet,
    emitterPosition: emitter.position.clone(),
    emitterHalfSize: new T.Vector2((bodyWidth - 0.25) / 2, 0.215),
  };
}
