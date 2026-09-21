const fs = require("fs");
const path = require("path");

const fnPath = path.join(__dirname, "..", "functions", "index.js");
let source = fs.readFileSync(fnPath, "utf8");

const oldDecl = 'exports.secureAdminLogin = onCall(async (request) => {';
const newDecl = 'exports.secureAdminLogin = onCall({ invoker: "public" }, async (request) => {';

if (source.includes(newDecl)) {
  console.log("✓ secureAdminLogin public invoker already configured");
  process.exit(0);
}

if (!source.includes(oldDecl)) {
  throw new Error("secureAdminLogin declaration not found");
}

source = source.replace(oldDecl, newDecl);
fs.writeFileSync(fnPath, source, "utf8");
console.log("✅ secureAdminLogin Cloud Run invoker configured as public");
