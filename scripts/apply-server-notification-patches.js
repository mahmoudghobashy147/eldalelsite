const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

function replaceRegexOnce(regex, replacement, label, alreadyAppliedNeedle) {
  if (alreadyAppliedNeedle && source.includes(alreadyAppliedNeedle)) {
    console.log(`✓ ${label} already applied`);
    return;
  }
  const matches = source.match(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g")) || [];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one source match, found ${matches.length}`);
  }
  source = source.replace(regex, replacement);
  changed = true;
  console.log(`✓ ${label} applied`);
}

// Personal notifications must be created by trusted Cloud Functions, not directly
// by any authenticated browser. The message-created trigger determines the real
// recipient from the parent chat document.
replaceRegexOnce(
  /\n\s*\/\/ إشعار للطرف التاني[^\n]*\n\s*await addDoc\(collection\(db,"notifications"\), \{\s*recipientId: userId2,[\s\S]*?read: false,\s*\}\)\.catch\(\(\)=>\{\}\);/,
  `\n      // Notification is generated server-side by the chat-message Firestore trigger.`,
  "move chat notifications server-side",
  "Notification is generated server-side by the chat-message Firestore trigger."
);

// Follow notifications are based on the follower document that was actually
// created. This prevents a client from forging arbitrary notification payloads.
replaceRegexOnce(
  /\n\s*\/\/ أرسل إشعار شخصي للشخص اللي اتتابع[^\n]*\n\s*await addDoc\(collection\(db,"notifications"\), \{\s*recipientId: followingId,[\s\S]*?followingId,\s*\}\);/,
  `\n      // Notification is generated server-side by the follower-created trigger.`,
  "move follow notifications server-side",
  "Notification is generated server-side by the follower-created trigger."
);

// Matching notifications for a service request must also happen on the server.
// Besides closing the notification-spam permission, this makes anonymous quick
// requests work after restrictive Firestore rules are deployed.
replaceRegexOnce(
  /\n\s*\/\/ نبعت إشعار فوري للصنايعية المتوافقين[^\n]*\n\s*\/\/ عشان الرسالة تظهر للمستخدم بسرعة حتى لو مفيش صنايعية متوافقين حاليًا\n\s*DB\.notifyMatchingCraftsmen\(\{ text: text\.trim\(\), gov \}\)\.catch\(\(\)=>\{\}\);/,
  `\n      // Matching notifications are generated server-side when serviceRequests is created.`,
  "move service-request notifications server-side",
  "Matching notifications are generated server-side when serviceRequests is created."
);

// Profile-view notifications need the authenticated viewer identity, so route
// them through a callable function with server-side validation and rate limiting.
replaceRegexOnce(
  /\n\s*\/\/ أرسل إشعار شخصي إن شخص دخل البروفايل بتاعه[^\n]*\n\s*await addDoc\(collection\(db,"notifications"\), \{\s*recipientId: profileOwnerId,[\s\S]*?profileOwnerId,\s*\}\);/,
  `\n      // Only authenticated viewers can generate the personal notification; the\n      // callable validates identity and rate-limits repeated views server-side.\n      if (viewerId) {\n        const notifyProfileView = httpsCallable(functions, "notifyProfileView");\n        await notifyProfileView({ profileOwnerId }).catch(() => {});\n      }`,
  "move profile-view notifications server-side",
  "const notifyProfileView = httpsCallable(functions, \"notifyProfileView\")"
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Server notification patches written to src/App.jsx");
} else {
  console.log("All server notification patches were already present");
}
