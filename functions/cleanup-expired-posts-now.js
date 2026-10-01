const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { runPostRetentionCleanup } = require("./post-retention");

runPostRetentionCleanup()
  .then((result) => {
    console.log("Immediate post cleanup complete", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Immediate post cleanup failed", err);
    process.exit(1);
  });
