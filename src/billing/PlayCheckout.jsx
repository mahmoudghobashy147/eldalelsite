import React,{useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {App as NativeApp} from '@capacitor/app';
import accountPolicy from '../account-role';
import catalog from './catalog.generated.json';

const Billing=registerPlugin('PlayBilling');
export const isPlayApp=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
const productFor = (plan, member) => catalog.products.find(product =>
  product.plan === plan && product.role === accountPolicy.accountRole(member)
);

function usePlayPrice(product) {
  const [quote, setQuote] = useState(null);
  const id = product?.id;
  useEffect(() => {
    if (!id) return;
    let live = true;
    Billing.product({productId:id})
      .then(result => { if (live) setQuote({id, price:result.price}); })
      .catch(() => { if (live) setQuote({id, price:null}); });
    return () => { live = false; };
  }, [id]);
  return quote?.id === id ? quote : null;
}

export function PlayPrice({plan, member}) {
  const product = productFor(plan, member);
  const quote = usePlayPrice(product);
  if (!product) return null;
  return <span>{quote?.price
    ? quote.price + ' / سنة'
    : <>{product.price} جنيه / سنة <small>(السعر المعلن)</small></>}</span>;
}

export function PlayCheckout({plan, member, uid, invoke, onSuccess, supportPhone}) {
  const product = productFor(plan, member);
  const quote = usePlayPrice(product);
  const price = quote?.price;
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [product?.id, uid]);

  async function verify(result) {
    let activated, pending = false, failed = false;
    for (const purchase of result.purchases || []) {
      if (![1, 2].includes(purchase.state)) continue;
      try {
        const verified = await invoke('verifyPlayPurchase', {purchaseToken:purchase.purchaseToken});
        if (verified.active) activated = verified.plan;
        if (verified.state === 'SUBSCRIPTION_STATE_PENDING') pending = true;
      } catch (error) {
        if (purchase.state === 2) pending = true;
        else if (error.code !== 'functions/permission-denied') failed = true;
      }
    }
    if (activated) {
      setMessage('تم تأكيد الدفع وتفعيل الباقة.');
      onSuccess?.(activated);
    } else if (pending) setMessage('الدفع معلّق لدى Google Play. التفعيل بعد تأكيده.');
    else if (failed) setMessage('تعذر تأكيد المشتريات. حاول الاستعادة مرة أخرى.');
    else setMessage('لا توجد مشتريات مكتملة لهذا الحساب.');
  }

  async function restore() {
    if (!uid || busy) return;
    setBusy(true); setMessage('');
    try { await verify(await Billing.restore()); }
    catch { setMessage('تعذر الاتصال بـ Google Play. حاول مجددًا.'); }
    finally { setBusy(false); }
  }

  async function buy() {
    if (!uid || busy || !price || !product) return;
    setBusy(true); setMessage('');
    try {
      const prepared = await invoke('preparePlayPurchase', {productId:product.id});
      await verify(await Billing.buy(prepared));
    } catch (error) {
      setMessage(error.code === 'CANCELED' ? 'تم إلغاء الشراء.' : error.message || 'تعذر الشراء. حاول مجددًا.');
    } finally { setBusy(false); }
  }
  const phone = String(supportPhone ?? '').replace(/[+ ()-]/g, '').replace(/^00/, '').replace(/^01/, '201');
  const supportUrl = /^[1-9][0-9]{7,14}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent('مرحبًا، عندي مشكلة في الدفع أو التفعيل عبر Google Play في الدليل الشامل ومحتاج مساعدة.')}`
    : null;
  return <section dir="rtl" style={{padding:16,borderRadius:16,background:'#f4f4eb',color:'#163e30'}}>
    <h3>الدفع عبر Google Play</h3>
    <p>اشتراك لمدة سنة يتجدد تلقائيًا كل سنة. يمكنك إلغاء التجديد من اشتراكات Google Play.</p>
    <p>{price ? price + ' / سنة' : quote ? 'الشراء غير متاح لهذه الباقة حاليًا.' : 'جارٍ التحقق من السعر…'}</p>
    {!uid&&<p>سجّل دخولك بحساب مشترك لإتمام الشراء.</p>}
    <button className="btn btn-primary" disabled={busy||!price||!uid} onClick={buy}>{busy?'جارٍ المعالجة…':`اشترك لمدة سنة ${price}`}</button>
    <button className="btn btn-outline" disabled={busy||!uid} onClick={restore}>استعادة المشتريات</button>
    {supportUrl && <a className="btn btn-outline" href={supportUrl} target="_blank" rel="noopener noreferrer">مشكلة في الدفع؟ تواصل مع الدعم</a>}
    <p role="status" aria-live="polite">{message}</p>
    <p style={{fontSize:12}}>السعر النهائي وشروط الدفع تظهر في شاشة Google Play. التفعيل بعد تأكيد عملية الشراء.</p>
  </section>;
}
// Reconcile purchases completed while the application was closed, on login and foreground.
export function PlayPurchaseSync({uid,invoke}){
 useEffect(()=>{
  if(!uid||!isPlayApp())return;
  let live=true,working=false,handle;
  const sync=async()=>{if(!live||working)return;working=true;try{const r=await Billing.restore();for(const p of r.purchases||[])if([1,2].includes(p.state)&&live)await invoke('verifyPlayPurchase',{purchaseToken:p.purchaseToken}).catch(()=>{});}catch{}finally{working=false}};
  sync();NativeApp.addListener('appStateChange',s=>{if(s.isActive)sync()}).then(h=>{if(live)handle=h;else h.remove()});
  return()=>{live=false;handle?.remove()};
 },[uid,invoke]);return null;
}
