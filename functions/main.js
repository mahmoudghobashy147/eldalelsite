// Firebase Functions entrypoint.
// Load the existing backend first (it initializes firebase-admin), then add the
// notification triggers kept in a separate module so auth code stays isolated.
module.exports = {
  ...require("./index"),
  ...require("./notification-triggers"),
};
