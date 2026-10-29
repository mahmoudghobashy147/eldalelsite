import React,{useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {App as NativeApp} from '@capacitor/app';
const Billing=registerPlugin('PlayBilling');
export const isPlayApp=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
const productId=plan=>`eldalel_${plan}_annual`;
const priceCache=new Map();
async function priceFor(plan){const id=productId(plan);if(!priceCache.has(id))priceCache.set(id,Billing.product({productId:id}).catch(error=>{priceCache.delete(id);throw error}));return priceCache.get(id)}
export function PlayPrice({plan}){const [price,setPrice]=useState('السعر في Google Play');useEffect(()=>{let live=true;priceFor(plan).then(r=>{if(live)setPrice(r.price+' / سنة')}).catch(()=>{if(live)setPrice('غير متاح حاليًا')});return()=>{live=false}},[plan]);return <span>{price}</span>}
export function PlayCheckout({plan,uid,invoke,onSuccess}){
  const [price,setPrice]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{let live=true;setPrice('');setMessage('');priceFor(plan).then(r=>{if(live)setPrice(r.price)}).catch(()=>{if(live)setMessage('الباقة غير متاحة للشراء حاليًا. حاول لاحقًا.')});return()=>{live=false}},[plan]);
  async function verify(result){
    let activated;
    for(const purchase of result.purchases||[]){
      if(purchase.state===2){setMessage('الدفع معلّق لدى Google Play؛ لن تتفعّل الباقة قبل تأكيده.');continue;}
      if(purchase.state!==1)continue;
      const verified=await invoke('verifyPlayPurchase',{purchaseToken:purchase.purchaseToken});
      if(verified.active)activated=verified.plan;
    }
    if(activated){setMessage('تم تأكيد الدفع وتفعيل الباقة.');onSuccess?.(activated);}
    return !!activated;
  }
  async function restore(){if(!uid||busy)return;setBusy(true);setMessage('');try{if(!await verify(await Billing.restore()))setMessage('لا توجد مشتريات مكتملة متاحة للاستعادة لهذا الحساب.');}catch{setMessage('تعذر تأكيد المشتريات. تأكد من الحساب والاتصال وحاول مجددًا.');}finally{setBusy(false)}}
  async function buy(){if(!uid||busy)return;setBusy(true);setMessage('');try{const prepared=await invoke('preparePlayPurchase',{productId:productId(plan)});await verify(await Billing.buy(prepared));}catch(e){setMessage(e.code==='CANCELED'?'تم إلغاء الشراء.':e.message||'تعذر الشراء. حاول مجددًا.');}finally{setBusy(false)}}
  return <section dir="rtl" style={{padding:16,borderRadius:16,background:'#f4f4eb',color:'#163e30'}}>
    <h3>الدفع عبر Google Play</h3>
    <p>اشتراك لمدة سنة، بدون تجديد تلقائي.</p>
    <p>{price||'جارٍ التحقق من السعر…'}</p>
    {!uid&&<p>سجّل دخولك بحساب مشترك لإتمام الشراء.</p>}
    <button className="btn btn-primary" disabled={busy||!price||!uid} onClick={buy}>{busy?'جارٍ المعالجة…':`اشترك لمدة سنة ${price}`}</button>
    <button className="btn btn-outline" disabled={busy||!uid} onClick={restore}>استعادة المشتريات</button>
    <p role="status" aria-live="polite">{message}</p>
    <p style={{fontSize:12}}>السعر النهائي وشروط الدفع تظهر في شاشة Google Play. التفعيل بعد تأكيد عملية الشراء.</p>
  </section>;
}
// Reconcile purchases completed while the application was closed, on login and foreground.
export function PlayPurchaseSync({uid,invoke}){
 useEffect(()=>{
  if(!uid||!isPlayApp())return;
  let live=true,working=false,handle;
  const sync=async()=>{if(!live||working)return;working=true;try{const r=await Billing.restore();for(const p of r.purchases||[])if(p.state===1&&live)await invoke('verifyPlayPurchase',{purchaseToken:p.purchaseToken});}catch{}finally{working=false}};
  sync();NativeApp.addListener('appStateChange',s=>{if(s.isActive)sync()}).then(h=>{if(live)handle=h;else h.remove()});
  return()=>{live=false;handle?.remove()};
 },[uid,invoke]);return null;
}
