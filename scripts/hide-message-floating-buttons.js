const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'../src/App.jsx');
let source=fs.readFileSync(file,'utf8');
const changes=[['<FloatingWhatsApp phone={OWNER_WHATSAPP}/>','{activeTab !== "messages" && <FloatingWhatsApp phone={OWNER_WHATSAPP}/>}'],['!selectedMember&&!showPayment&&!showQuickRequest&&activeTab!=="catalog"&&(', '!selectedMember&&!showPayment&&!showQuickRequest&&activeTab!=="catalog"&&activeTab!=="messages"&&(']];
for(const [before,after] of changes){if(source.includes(after))continue;if(!source.includes(before))throw new Error('Missing floating button anchor: '+before);source=source.replace(before,after);}
fs.writeFileSync(file,source);
