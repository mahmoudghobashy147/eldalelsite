// Send one idempotent, personal alert per existing member, without a recipient cap.
async function broadcastServiceRequest({db, fieldPath, requestId, request, notify}) {
  const text=String(request.text||'').trim();
  if(!text)return 0;
  const place=[request.gov,request.city].map(x=>String(x||'').trim()).filter(Boolean).join(' - ');
  const phone=String(request.phone||'').trim();
  const body=[text.slice(0,330),place&&`المكان: ${place}`,phone&&`للتواصل: ${phone}`].filter(Boolean).join(' • ').slice(0,500);
  let last=null,total=0;
  for(;;){
    let query=db.collection('members').orderBy(fieldPath.documentId()).limit(100);
    if(last)query=query.startAfter(last);
    const snap=await query.get();
    if(snap.empty)break;
    await Promise.all(snap.docs.map(doc=>notify(doc.id,{
      title:'🛠️ طلب صنايعي جديد',body,icon:'🛠️',color:'#C9A84C',type:'serviceRequest',url:'/',
      meta:{serviceRequestId:requestId},
    },`service-request:${requestId}`)));
    total+=snap.size;last=snap.docs[snap.docs.length-1];
    if(snap.size<100)break;
  }
  return total;
}
module.exports={broadcastServiceRequest};
