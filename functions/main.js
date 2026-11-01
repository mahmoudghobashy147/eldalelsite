// Firebase Functions entrypoint.
// Load the existing backend first (it initializes firebase-admin), then add the
// feature modules kept separate so auth/security code stays isolated.
module.exports = {
  ...require("./index"),
  ...require("./play-billing/index.cjs"),
  ...require("./pending-phones/index.cjs"),
  ...require("./phone-registration/callables.cjs"),
  ...require("./notification-triggers"),
  ...require("./engagement-triggers"),
  ...require("./service-requests"),
  ...require("./member-interactions"),
  ...require("./post-retention"),
};
