const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`✓ ${label} already applied`);
    return;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  source = source.replace(oldText, newText);
  changed = true;
  console.log(`✓ ${label} applied`);
}

// Firestore Rules verify that a message sender is a participant of the parent
// chat document. On a brand-new conversation the parent must therefore exist
// before the first message is created.
replaceOnce(
`      const docRef = await addDoc(collection(db,\`chats/\${chatId}/messages\`), {
        senderId: userId1,
        senderName,
        message,
        time: new Date(),
        read: false
      });
      // Update chat metadata
      await setDoc(doc(db,"chats",chatId), {
        users: [userId1, userId2],
        lastMessage: message,
        lastTime: new Date(),
        updatedAt: new Date()
      }, { merge: true });`,
`      // Create/update the parent chat first so Firestore Rules can verify that
      // the sender is a participant even on the very first message.
      await setDoc(doc(db,"chats",chatId), {
        users: [userId1, userId2],
        lastMessage: message,
        lastTime: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      const docRef = await addDoc(collection(db,\`chats/\${chatId}/messages\`), {
        senderId: userId1,
        senderName,
        message,
        time: new Date(),
        read: false
      });`,
"create parent chat before first message"
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Chat/Rules compatibility patches written to src/App.jsx");
} else {
  console.log("All chat/rules compatibility patches were already present");
}
