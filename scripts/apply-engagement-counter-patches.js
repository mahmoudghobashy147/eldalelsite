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
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(oldText, newText);
  changed = true;
  console.log(`✓ ${label} applied`);
}

function replaceRegexOnce(regex, replacement, label, appliedNeedle) {
  if (appliedNeedle && source.includes(appliedNeedle)) {
    console.log(`✓ ${label} already applied`);
    return;
  }
  const matches = source.match(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g")) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  source = source.replace(regex, replacement);
  changed = true;
  console.log(`✓ ${label} applied`);
}

replaceOnce(
`      await setDoc(doc(db,\`members/\${userId}/saved\`,memberId), { memberId, savedAt: new Date() });
      await updateDoc(doc(db,"members",memberId), { saves: increment(1) });`,
`      await setDoc(doc(db,\`members/\${userId}/saved\`,memberId), { memberId, savedAt: new Date() });
      // saves aggregate is updated by a trusted Cloud Function trigger.`,
"move save counter server-side"
);

replaceOnce(
`      await deleteDoc(doc(db,\`members/\${userId}/saved\`,memberId));
      await updateDoc(doc(db,"members",memberId), { saves: increment(-1) });`,
`      await deleteDoc(doc(db,\`members/\${userId}/saved\`,memberId));
      // saves aggregate is updated by a trusted Cloud Function trigger.`,
"move unsave counter server-side"
);

replaceOnce(
`      // نحدّث عداد المتابعين المخزّن على العضو نفسه (denormalized) بدل عدّهم من الصفر كل مرة
      await updateDoc(doc(db,"members",followingId), { followersCount: increment(1) }).catch(()=>{});`,
`      // followersCount is updated by a trusted Cloud Function trigger.`,
"move follow counter server-side"
);

replaceOnce(
`      await deleteDoc(doc(db,\`members/\${followingId}/followers\`,followerId));
      await updateDoc(doc(db,"members",followingId), { followersCount: increment(-1) }).catch(()=>{});`,
`      await deleteDoc(doc(db,\`members/\${followingId}/followers\`,followerId));
      // followersCount is updated by a trusted Cloud Function trigger.`,
"move unfollow counter server-side"
);

replaceRegexOnce(
/\n\s*\/\/ كان بيزود عدد المراجعات[\s\S]*?\n\s*await runTransaction\(db, async \(tx\) => \{[\s\S]*?\n\s*\}\);/,
`\n      // rating/reviews aggregates are updated by a trusted Cloud Function trigger.`,
"move review aggregate server-side",
"rating/reviews aggregates are updated by a trusted Cloud Function trigger."
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Engagement counter patches written to src/App.jsx");
} else {
  console.log("All engagement counter patches were already present");
}
