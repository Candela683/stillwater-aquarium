import { Vector2 } from "three";

export const detailViews = {
  "1": { name: "aquascape", position: [1.25, 3.2, 7.4], target: [0, 1.45, 0], fov: 37 },
  "2": { name: "school", position: [0.7, 2.6, 4.7], target: [0.35, 1.65, 0], fov: 30 },
  "3": { name: "plants", position: [1.1, 1.95, 3.8], target: [0.65, 0.7, 0.15], fov: 30 },
};

const sampleOffsets = [
  [-0.375, -0.125], [0.125, -0.375], [0.375, 0.125], [-0.125, 0.375],
  [-0.375, 0.375], [0.375, -0.375], [-0.125, -0.125], [0.125, 0.125],
];
const linear = Float32Array.from({ length: 256 }, (_, value) => {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
});
function srgb(x) {
  return Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055));
}

export async function renderStill({
  renderer, camera, controls, render, pause,
  width = 3840, height = 2160,
  createCanvas = () => document.createElement("canvas"),
  yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0)),
}) {
  const oldSize = renderer.getSize(new Vector2());
  const oldRatio = renderer.getPixelRatio(), oldAspect = camera.aspect;
  const oldView = camera.view ? { ...camera.view } : null;
  const oldEnabled = controls.enabled, oldTarget = renderer.getRenderTarget();
  let resume, output;
  try {
    resume = pause();
    controls.enabled = false;
    renderer.setRenderTarget(null);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    const gl = renderer.getContext();
    if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
      throw new Error("The GPU could not allocate the requested screenshot size");
    }
    camera.aspect = width / height;
    const pixels = new Uint8Array(width * height * 4);
    const sum = new Float32Array(width * height * 3);
    // Freeze the scene and accumulate subpixel samples in linear color space.
    for (const [x, y] of sampleOffsets) {
      if (gl.isContextLost()) throw new Error("WebGL context lost during screenshot");
      camera.setViewOffset(width, height, x, y, width, height);
      render();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
        sum[j] += linear[pixels[i]];
        sum[j + 1] += linear[pixels[i + 1]];
        sum[j + 2] += linear[pixels[i + 2]];
      }
      await yieldFrame();
    }
    output = createCanvas();
    output.width = width;
    output.height = height;
    const context = output.getContext("2d");
    if (!context) throw new Error("PNG encoding canvas unavailable");
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const source = (y * width + x) * 3;
        const target = ((height - 1 - y) * width + x) * 4;
        for (let c = 0; c < 3; c++) image.data[target + c] = srgb(sum[source + c] / sampleOffsets.length);
        image.data[target + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Screenshot encoding failed");
    return blob;
  } finally {
    if (output) output.width = output.height = 0;
    renderer.setPixelRatio(oldRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);
    renderer.setRenderTarget(oldTarget);
    camera.aspect = oldAspect;
    camera.view = oldView;
    camera.updateProjectionMatrix();
    controls.enabled = oldEnabled;
    resume?.();
  }
}
