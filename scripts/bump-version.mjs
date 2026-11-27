import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const next = process.argv[2]?.replace(/^v/, "").trim();
if (!next || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error("Usage: npm run bump <semver>  (e.g. npm run bump 0.2.0)");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");

function updateJson(relPath) {
  const full = resolve(root, relPath);
  const raw = readFileSync(full, "utf8");
  const updated = raw.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`);
  if (updated === raw) {
    throw new Error(`No version field updated in ${relPath}`);
  }
  writeFileSync(full, updated, "utf8");
  console.log(`Updated ${relPath} -> ${next}`);
}

updateJson("package.json");
updateJson("src-tauri/tauri.conf.json");

const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const cargoRaw = readFileSync(cargoPath, "utf8");
const cargoUpdated = cargoRaw.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${next}"`,
);
if (cargoUpdated === cargoRaw) {
  throw new Error("No version field updated in src-tauri/Cargo.toml");
}
writeFileSync(cargoPath, cargoUpdated, "utf8");
console.log(`Updated src-tauri/Cargo.toml -> ${next}`);

console.log(`\nNext steps:`);
console.log(`  1. Update CHANGELOG.md for v${next}`);
console.log(`  2. git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md`);
console.log(`  3. git commit -m "chore(release): v${next}"`);
console.log(`  4. git tag v${next} && git push origin master --tags`);
