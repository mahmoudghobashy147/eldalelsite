const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "apply-marketplace-home-patches.js");
let source = fs.readFileSync(target, "utf8");

// The marketplace JSX is stored inside a JavaScript template literal. The first
// version used String.raw, which makes escaping nested JSX template literals
// unnecessarily fragile. Normalize that block to a regular template literal and
// escape interpolation markers so they are emitted into App.jsx literally.
const startMarker = "const marketplace = String.raw`";
const endMarker = "\n\n  source = source.replace(oldDecl, marketplace);";

if (source.includes(startMarker)) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error("marketplace patch normalizer: end marker not found");

  const before = source.slice(0, start);
  let block = source.slice(start, end);
  const after = source.slice(end);

  block = block.replace(startMarker, "const marketplace = `");
  // Prevent the patch script itself from evaluating interpolation expressions
  // that belong to the generated React source.
  block = block.replace(/(?<!\\)\$\{/g, "\\${");

  source = before + block + after;
  fs.writeFileSync(target, source, "utf8");
  console.log("✓ normalized marketplace patch template");
}

require(target);
