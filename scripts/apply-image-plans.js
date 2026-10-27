const fs=require('fs');
const path='src/App.jsx';let s=fs.readFileSync(path,'utf8');
function replace(a,b,label){if(s.includes(b))return;let n=s.split(a).length-1;if(n!==1)throw Error(label+': expected one anchor, found '+n);s=s.replace(a,b)}
replace('import { useState,','import planVideoPolicy from "./plan-video-policy.cjs";\nimport { useState,','plan video helper');
function planLine(key,line){const rx=new RegExp('^  '+key+':.*$', 'm');const found=s.match(rx);if(!found)throw Error('missing plan '+key);if(found[0]!==line)s=s.replace(rx,line)}
planLine('starter','  starter: { label:"مبتدئ", price:100, color:"#0EA5E9", maxPhotos:5, maxPosts:0, maxVideos:0, searchPriority:4, features:["تصفح الأقسام والتواصل مع الأعضاء","ظهور في الدليل","رفع حتى 5 صور أعمال","تصميم إعلاني هدية"] },');
planLine('basic','  basic: { label:"أساسي", price:200, color:C.info, maxPhotos:15, maxPosts:5, maxVideos:1, searchPriority:3, features:["5 منشورات شهريًا","فيديو واحد شهريًا","تفاعل وتعليقات على المنشورات","تصميمان إعلانيان وصفحة تعريفية"] },');
planLine('premium','  premium: { label:"مميز", price:300, color:C.gold, maxPhotos:10, maxPosts:10, maxVideos:1, searchPriority:2, features:["ظهور في الدليل وأولوية في البحث","رفع حتى 10 صور أعمال","فيديو واحد لعرض الأعمال","صفحة تعريفية وفيديو ومنشورات هدية"] },');
planLine('vip','  vip: { label:"VIP", price:600, color:C.purple, maxPhotos:30, maxPosts:20, maxVideos:4, searchPriority:1, features:["ظهور على الصفحة الرئيسية","رفع حتى 30 صورة أعمال","4 فيديوهات لعرض الأعمال","صفحة تعريفية وفيديو ومنشورات هدية"] },');
{const a='planPrices: { starter:60, basic:120, premium:250, vip:600, company:1000, elite:1500 },', b='planPrices: { starter:100, basic:200, premium:300, vip:600, company:1000, elite:1500 },';let n=s.split(a).length-1;if(n===2)s=s.split(a).join(b);else if(n!==0)throw Error('default prices: expected two anchors');}
replace('  const videoLimit = getVideoLimit(memberType, cfg);','  const videoLimit = memberType==="basic"?1:memberType==="premium"?1:memberType==="vip"?4:getVideoLimit(memberType,cfg);','video entitlement');
replace('setVideoCount(userPosts.filter(p => p.video).length);','setVideoCount(planVideoPolicy.countPlanVideos(userPosts,postsThisMonth,getMemberPlan(m)));','monthly basic video');
replace('  const [photos, setPhotos] = useState(member.workPhotos || []);','  const [photos, setPhotos] = useState(member.workPhotos || []);\n  const photoLimit = PLANS[getMemberPlan(member)]?.maxPhotos ?? 5;','photo limit');
replace('slice(0, 5 - photos.length)','slice(0, Math.max(0, photoLimit - photos.length))','uploads photo limit');
replace('[...photos, ...urls].slice(0, 5)','[...photos, ...urls].slice(0, photoLimit)','saved photo limit');
replace('photos.length < 5','photos.length < photoLimit','photo button');
replace('أضف حتى 5 صور من أعمالك','أضف حتى {photoLimit} صور من أعمالك','empty state');
replace('يمكنك إضافة حتى 5 صور من أعمالك','يمكنك إضافة حتى {photoLimit} صور من أعمالك','photo help');
replace('${photos.length}/5)', '${photos.length}/${photoLimit})','photo counter');
replace('  const [loadingLimits, setLoadingLimits] = useState(true);','  const [loadingLimits, setLoadingLimits] = useState(true);\n  const [limitsError, setLimitsError] = useState(false);','limit verification state');
replace('const userPosts = await DB.getUserPosts(user.uid);','const postSnapshot = await getDocs(query(collection(db,"posts"), where("authorId","==",user.uid)));\n        const userPosts = postSnapshot.docs.map(d=>({id:d.id,...d.data()}));','count all author posts');
replace('  const canPost = (memberInfo?.isAdmin===true || memberInfo?.status==="approved") && memberInfo?.accountKind !== "customer" && remainingPosts > 0;','  const canPost = !limitsError && (memberInfo?.isAdmin===true || memberInfo?.status==="approved") && memberInfo?.accountKind !== "customer" && remainingPosts > 0;','deny post on count error');
replace('  const canAddVideo = videoLimit > 0 && videoCount < videoLimit;','  const canAddVideo = !limitsError && videoLimit > 0 && videoCount < videoLimit;','deny video on count error');
replace('setVideoCount(planVideoPolicy.countPlanVideos(userPosts,postsThisMonth,getMemberPlan(m)));\n      } catch (e) { console.error(e); }','setVideoCount(planVideoPolicy.countPlanVideos(userPosts,postsThisMonth,getMemberPlan(m)));\n      } catch (e) { console.error(e); setLimitsError(true); }','handle count failures');
replace('{memberInfo?.accountKind === "customer" ? "حساب العميل مخصص لطلب صنايعي"','{limitsError ? "تعذر التحقق من حدود باقتك" : memberInfo?.accountKind === "customer" ? "حساب العميل مخصص لطلب صنايعي"','limit error heading');
replace('{memberInfo?.accountKind === "customer" ? "تقدر تستخدم زر اطلب صنايعي لإرسال طلبك."','{limitsError ? "تأكد من الاتصال بالإنترنت وحاول مرة أخرى." : memberInfo?.accountKind === "customer" ? "تقدر تستخدم زر اطلب صنايعي لإرسال طلبك."','limit error explanation');
// Offer the four requested plans to new subscribers; keep a legacy account's current plan selectable while editing.
{const a='Object.entries(PLANS).map(([key,pl])=>(', plain='Object.entries(PLANS).filter(([key])=>["starter","basic","premium","vip"].includes(key)).map(([key,pl])=>(', legacy='Object.entries(PLANS).filter(([key])=>["starter","basic","premium","vip"].includes(key)||key===originalPlan).map(([key,pl])=>(';let parts=s.split(a);if(parts.length===4)s=parts[0]+plain+parts[1]+plain+parts[2]+legacy+parts[3];else if(parts.length!==1||!s.includes(legacy))throw Error('Unexpected plan selector count');}
fs.writeFileSync(path,s);console.log('Annual plan descriptions and media limits staged.');
