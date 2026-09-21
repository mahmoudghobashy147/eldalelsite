// Firebase Functions entrypoint.
// Load the existing backend first (it initializes firebase-admin), then add the
// notification and engagement triggers kept in separate modules so auth code stays isolated.
module.exports = {
  ...require("./index"),
  ...require("./notification-triggers"),
  ...require("./engagement-triggers"),
};
