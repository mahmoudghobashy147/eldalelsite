const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "apply-marketplace-home-patches.js");
let source = fs.readFileSync(target, "utf8");
let normalized = false;

// This patch file is itself made mostly of template literals that contain React
// source code. Any unescaped ${...} inside those templates belongs to the React
// code we are generating, not to this Node patch runner. Escape all such markers
// before requiring the file. The few interpolation expressions used only for
// patch-runner log/error messages may become literal text, which is harmless;
// correctness of the generated App.jsx takes priority.
if (source.includes("const marketplace = String.raw`")) {
  source = source.replace("const marketplace = String.raw`", "const marketplace = `");
  normalized = true;
}

const escaped = source.replace(/(?<!\\)\$\{/g, "\\${");
if (escaped !== source) {
  source = escaped;
  normalized = true;
}

if (normalized) {
  fs.writeFileSync(target, source, "utf8");
  console.log("✓ normalized marketplace patch templates");
}

require(target);
