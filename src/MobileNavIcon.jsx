import React, { useId } from 'react';
import './mobile-nav-modern.css';

const drawings = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
  saved: <path d="M20.8 5.9a5.2 5.2 0 0 0-7.4 0L12 7.3l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 22l8.8-8.7a5.2 5.2 0 0 0 0-7.4Z"/>,
  catalog: <><rect x="3.5" y="4" width="17" height="16.5" rx="2"/><path d="M3.5 9.5h17M9 4v5.5M15 9.5v5.5M3.5 15h17M9 15v5.5"/></>,
  messages: <><path d="M20.5 11a8 8 0 0 1-8.5 8 9 9 0 0 1-3.3-.6L4 20l1.4-4A7.5 7.5 0 0 1 3.5 11c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8Z"/><path d="M8 11h.1m3.9 0h.1m3.9 0h.1" strokeWidth="3"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  admin: <><path d="m3 7 4.5 3.5L12 4l4.5 6.5L21 7l-1.5 10.5h-15L3 7Z"/><path d="M5 21h14"/></>,
};
export default function MobileNavIcon({id}) {
  const gradient = 'nav-gold-' + useId().replace(/:/g, '');
  return <span className="mobile-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke={'url(#'+gradient+')'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff9d1"/><stop offset=".5" stopColor="#f2d07a"/><stop offset="1" stopColor="#b78d38"/></linearGradient></defs>{drawings[id] || drawings.profile}</svg></span>;
}
