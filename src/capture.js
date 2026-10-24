// Capture only this aquarium canvas. No microphone, desktop or other tabs.
export function installCapture({
  renderer,
  camera,
  controls,
  render,
  startle,
}) {
  let recording = false;
  function save(blob, name) {
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function screenshot() {
    render();
    const blob = await new Promise((resolve) =>
      renderer.domElement.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Screenshot encoding failed");
    save(blob, "aquarium-screenshot.png");
    return blob;
  }
  async function recordTour({ duration = 24000 } = {}) {
    if (recording) return;
    if (!globalThis.MediaRecorder || !renderer.domElement.captureStream)
      throw new Error("Canvas recording is unavailable in this browser");
    recording = true;
    const oldPosition = camera.position.clone(),
      oldTarget = controls.target.clone(),
      oldEnabled = controls.enabled;
    const oldRatio = renderer.getPixelRatio(),
      oldWidth = renderer.domElement.width / oldRatio,
      oldHeight = renderer.domElement.height / oldRatio;
    const oldAspect = camera.aspect;
    // Record at an explicit 1920 x 1080; the normal viewport is restored afterward.
    renderer.setPixelRatio(2);
    renderer.setSize(960, 540, false);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
    controls.enabled = false;
    const format = [
      "video/mp4;codecs=avc1.42E01E",
      "video/webm;codecs=vp9",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    let stream, recorder, animation;
    try {
      stream = renderer.domElement.captureStream(30);
      recorder = new MediaRecorder(stream, {
        ...(format ? { mimeType: format } : {}),
        videoBitsPerSecond: 8000000,
      });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const done = new Promise((resolve, reject) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.onerror = (event) =>
          reject(event.error || new Error("Video recording failed"));
      });
      const began = performance.now();
      let startled = false;
      let tourFrames = 0;
      function tour() {
        tourFrames++;
        const progress = Math.min((performance.now() - began) / duration, 1);
        const eased = progress * progress * (3 - 2 * progress),
          angle = 0.52 - 0.82 * eased;
        camera.position.set(
          Math.sin(angle) * 12.3,
          4.1 - 0.25 * Math.sin(Math.PI * progress),
          Math.cos(angle) * 12.3,
        );
        controls.target.set(0, 1.55, 0);
        camera.lookAt(controls.target);
        if (!startled && progress > 0.46) {
          startled = true;
          startle();
        }
        if (progress < 1) animation = requestAnimationFrame(tour);
      }
      tour();
      render();
      recorder.start(1000);
      await new Promise((resolve) => setTimeout(resolve, duration));
      recorder.stop();
      const blob = await done;
      if (tourFrames < 10) {
        throw new Error("Browser paused the animation. Keep the aquarium tab visible while recording.");
      }
      save(
        blob,
        `aquarium-demo.${blob.type.startsWith("video/mp4") ? "mp4" : "webm"}`,
      );
      return blob;
    } finally {
      cancelAnimationFrame(animation);
      stream?.getTracks().forEach((track) => track.stop());
      if (recorder?.state === "recording") recorder.stop();
      renderer.setPixelRatio(oldRatio);
      renderer.setSize(oldWidth, oldHeight, false);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      camera.position.copy(oldPosition);
      controls.target.copy(oldTarget);
      controls.enabled = oldEnabled;
      controls.update();
      recording = false;
    }
  }
  addEventListener("keydown", (event) => {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (event.key.toLowerCase() === "s") screenshot().catch(console.error);
    if (event.key.toLowerCase() === "r") recordTour().catch(console.error);
  });
  return { screenshot, recordTour };
}
