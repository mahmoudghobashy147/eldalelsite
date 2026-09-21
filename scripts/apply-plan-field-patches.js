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

// `type` is the professional account type (craftsman/engineer/company...).
// `plan` is the subscription tier (starter/basic/premium/vip...). Never mix them.
replaceOnce(
`      (!memberTypeFilter || m.type === memberTypeFilter) &&`,
`      (!memberTypeFilter || getMemberPlan(m) === memberTypeFilter) &&`,
"filter members by subscription plan instead of professional type"
);

replaceOnce(
`                  <select value={m.type||"starter"} onChange={e=>changeMemberType(m.id,e.target.value)}`,
`                  <select value={getMemberPlan(m)} onChange={e=>changeMemberType(m.id,e.target.value)}`,
"show actual subscription plan in admin selector"
);

replaceOnce(
`      await updateDoc(doc(db,"members",memberId), { type:"starter", plan:"starter", subscriptionCancelledAt: new Date() });
      setMembers(p => p.map(m => m.id===memberId ? {...m, type:"starter", plan:"starter"} : m));`,
`      await updateDoc(doc(db,"members",memberId), { plan:"starter", subscriptionCancelledAt: new Date() });
      setMembers(p => p.map(m => m.id===memberId ? {...m, plan:"starter"} : m));`,
"cancel subscription without erasing professional type"
);

replaceOnce(
`      const updateData = { type: newType, plan: newType, updatedAt: new Date() };`,
`      const updateData = { plan: newType, updatedAt: new Date() };`,
"change subscription plan without overwriting professional type"
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Plan/type separation patches written to src/App.jsx");
} else {
  console.log("All plan/type separation patches were already present");
}
