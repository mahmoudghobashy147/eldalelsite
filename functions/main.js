// Firebase Functions entrypoint.
// Load the existing backend first (it initializes firebase-admin), then add the
// feature modules kept separate so auth/security code stays isolated.
module.exports = {
  ...require("./index"),
  ...require("./notification-triggers"),
  ...require("./engagement-triggers"),
  ...require("./service-requests"),
};
