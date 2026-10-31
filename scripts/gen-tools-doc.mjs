// Regenerates docs/tools.md from tools.json. `--check` exits 1 when the file is out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { readJson, renderToolsDoc } from "./lib.mjs";

const out = new URL("../docs/tools.md", import.meta.url);
const text = renderToolsDoc(readJson("tools.json"));

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(out, "utf8"); } catch { /* missing */ }
  if (current !== text) {
    console.error("docs/tools.md is out of date. Run: npm run docs");
    process.exit(1);
  }
  console.log("docs/tools.md is up to date");
} else {
  writeFileSync(out, text);
  console.log("wrote docs/tools.md");
}
