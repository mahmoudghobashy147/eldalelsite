const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function requireFile(relativePath) {
  const fullPath = path.join(buildDir, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing build/${relativePath}`);
  const stat = fs.statSync(fullPath);
  if (!stat.isFile() || stat.size === 0) fail(`Empty build/${relativePath}`);
  return fullPath;
}

if (!fs.existsSync(buildDir)) fail("build directory does not exist");

const requiredFiles = [
  "index.html",
  "404.html",
  "CNAME",
  "manifest.json",
  "robots.txt",
  "sitemap.xml",
  "firebase-messaging-sw.js",
];

for (const file of requiredFiles) requireFile(file);

const cname = fs.readFileSync(path.join(buildDir, "CNAME"), "utf8").trim();
if (cname !== "eldalel-elshamel.online") {
  fail(`Unexpected CNAME: ${cname || "<empty>"}`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(buildDir, "manifest.json"), "utf8"));
} catch (error) {
  fail(`manifest.json is not valid JSON: ${error.message}`);
}

if (manifest.name !== "الدليل الشامل") fail("manifest app name is incorrect");
if (manifest.start_url !== "/") fail("manifest start_url must be /");
if (manifest.display !== "standalone") fail("manifest display must be standalone");
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) fail("manifest has no app icon");

const sw = fs.readFileSync(path.join(buildDir, "firebase-messaging-sw.js"), "utf8");
if (!sw.includes("firebase.messaging")) fail("Firebase messaging service worker is incomplete");

const robots = fs.readFileSync(path.join(buildDir, "robots.txt"), "utf8");
if (!/Sitemap:/i.test(robots)) fail("robots.txt is missing Sitemap directive");

const sitemap = fs.readFileSync(path.join(buildDir, "sitemap.xml"), "utf8");
if (!sitemap.includes("eldalel-elshamel.online")) fail("sitemap.xml does not reference the production domain");

console.log("✅ Production build smoke checks passed");
