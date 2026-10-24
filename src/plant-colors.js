import * as T from "three";

// Species-specific three-stop palettes, shared by raster and refracted vertex colour.
const palettes = {
  ambulia: ["#205432", "#579f40", "#d3df7b"],
  tallPearl: ["#164d32", "#429b48", "#dce786"],
  lowPearl: ["#23582c", "#65a73d", "#d7e477"],
  hairgrass: ["#244d2b", "#5c993d", "#cbdc72"],
};
for (const key of Object.keys(palettes))
  palettes[key] = palettes[key].map((hex) => new T.Color(hex));
export function plantLeafColor(vigor, shootTone, random, species = "ambulia") {
  const [deep, green, young] = palettes[species] || palettes.ambulia,
    out = new T.Color();
  // Stronger per-leaf pigment variation in the smaller foreground/midground foliage.
  // Keep one random draw so changing colour does not rearrange the planted geometry.
  const t = T.MathUtils.clamp(
    species === "ambulia"
      ? 0.08 + 0.68 * vigor + shootTone + (random() - 0.5) * 0.58
      : 0.12 + 0.62 * vigor + shootTone + (random() - 0.5) * 0.96,
    0,
    1,
  );
  if (t < 0.52) return out.copy(deep).lerp(green, t / 0.52);
  return out.copy(green).lerp(young, (t - 0.52) / 0.48);
}
