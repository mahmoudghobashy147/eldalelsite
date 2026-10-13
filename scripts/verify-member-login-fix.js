const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname,"..","src","App.jsx"),"utf8");
const fn = fs.readFileSync(path.join(__dirname,"..","functions","index.js"),"utf8");

const checks = [
  [app.includes('httpsCallable(functions, "secureMemberLogin")'), "client secureMemberLogin"],
  [app.includes("phoneNormalized: normalizeMemberPhone(form.phone)"), "registration phoneNormalized"],
  [fn.includes("exports.secureMemberLogin = onCall"), "server secureMemberLogin"],
  [fn.includes('invoker: "public"'), "public callable invoker"],
  [fn.includes("exports.syncMemberPhoneNormalized = onDocumentWritten"), "phone normalization trigger"],
  [fn.includes("createdLogin: true"), "admin missing-auth repair"],
];
const failed = checks.filter(([ok])=>!ok).map(([,name])=>name);
if (failed.length) {
  console.error("Missing member login integration:", failed.join(", "));
  process.exit(1);
}
console.log("✅ Member login integration verified");
