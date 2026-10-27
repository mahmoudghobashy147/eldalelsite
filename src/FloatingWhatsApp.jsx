export default function FloatingWhatsApp({phone}) {
 const number=String(phone||'').replace(/\D/g,'');
 if(!number)return null;
 return <><style>{`
 .floating-whatsapp{position:fixed;left:24px;bottom:26px;z-index:1600;display:flex;align-items:center;gap:9px;min-height:54px;padding:0 17px;border-radius:19px;color:white;text-decoration:none;font-family:Cairo,sans-serif;font-weight:800;font-size:13px;background:linear-gradient(145deg,#27d86f,#128c4b);border:1px solid #97edb5;box-shadow:0 5px 0 #0b6639,0 12px 24px #073c3233,inset 0 1px 0 #ffffff55;transition:transform .15s}
 .floating-whatsapp:hover{transform:translateY(-2px)}
 .floating-whatsapp:focus-visible{outline:3px solid #c5a458;outline-offset:5px}
 body:has([role="dialog"]) .floating-whatsapp{display:none}
 @media(max-width:767px){.floating-whatsapp{left:14px;bottom:calc(134px + env(safe-area-inset-bottom,0px));width:54px;height:54px;padding:0;justify-content:center;border-radius:18px}.floating-whatsapp span{display:none}}
 @media(prefers-reduced-motion:reduce){.floating-whatsapp{transition:none}}
 `}</style><a className="floating-whatsapp" aria-label="تواصل مع إدارة الدليل الشامل عبر واتساب" title="تواصل معنا عبر واتساب" href={`https://wa.me/${number}?text=${encodeURIComponent('مرحبًا، أريد الاستفسار عن الدليل الشامل')}`} target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 32 32" width="29" height="29" fill="currentColor"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.6c-2 0-3.9-.6-5.5-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-.9 1.2-.3.2-.6.1a8.7 8.7 0 0 1-4.3-3.8c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4a3.6 3.6 0 0 0-1.1 2.7c0 1.6 1.2 3.1 1.4 3.3.1.2 2.3 3.5 5.5 4.9 2.1.9 3 .9 4.1.7.7-.1 1.9-.8 2.1-1.5s.3-1.4.2-1.5-.3-.2-.6-.4Z"/></svg><span>تواصل واتساب</span></a></>;
}
