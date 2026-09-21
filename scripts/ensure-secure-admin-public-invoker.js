const fs = require("fs");
const path = require("path");

const fnPath = path.join(__dirname, "..", "functions", "index.js");
let source = fs.readFileSync(fnPath, "utf8");

const oldDecl = 'exports.secureAdminLogin = onCall(async (request) => {';
const newDecl = 'exports.secureAdminLogin = onCall({ invoker: "public" }, async (request) => {';
const marker = '  const adminLoginTransportVersion = "public-invoker-v2"; void adminLoginTransportVersion;';
let changed = false;

if (!source.includes(newDecl)) {
  if (!source.includes(oldDecl)) throw new Error("secureAdminLogin declaration not found");
  source = source.replace(oldDecl, newDecl);
  changed = true;
}

if (!source.includes(marker)) {
  source = source.replace(newDecl, `${newDecl}\n${marker}`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(fnPath, source, "utf8");
  console.log("✅ secureAdminLogin public invoker forced with deployment marker");
} else {
  console.log("✓ secureAdminLogin public invoker + deployment marker already configured");
}
