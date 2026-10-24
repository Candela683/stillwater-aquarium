import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const files = readdirSync("tests")
  .filter((name) => name.endsWith(".mjs"))
  .sort();
for (const file of files) {
  console.log(`\n${file}`);
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nAll ${files.length} checks passed.`);
