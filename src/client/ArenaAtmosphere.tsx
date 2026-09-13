import {useId,type CSSProperties} from 'react';

export function ArenaAtmosphere(){
  return <div className="forge-atmosphere" aria-hidden="true">
    <div className="forge-light-wash"/>
    <div className="forge-table-edge"/>
    {Array.from({length:12},(_,index)=><i key={index} className="forge-mote" style={{left:`${8+(index*37)%86}%`,top:`${15+(index*23)%65}%`,'--drift':`${index%2?24:-24}px`,animationDelay:`${-index*1.7}s`,animationDuration:`${12+index%5*2}s`} as CSSProperties}/>)}
  </div>;
}

export function AvatarCrest(){
  const id=useId().replace(/:/g,'');
  return <svg className="forge-avatar-crest" viewBox="0 0 160 160" fill="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-metal`} x1="22" y1="20" x2="124" y2="147" gradientUnits="userSpaceOnUse"><stop stopColor="#fff0b4"/><stop offset=".24" stopColor="#ad874a"/><stop offset=".43" stopColor="#efd3a0"/><stop offset=".51" stopColor="#675037"/><stop offset=".77" stopColor="#ad8957"/><stop offset="1" stopColor="#302923"/></linearGradient><linearGradient id={`${id}-steel`} x1="20" y1="30" x2="130" y2="125" gradientUnits="userSpaceOnUse"><stop stopColor="#bbd1d1"/><stop offset=".35" stopColor="#3e5862"/><stop offset=".65" stopColor="#162935"/><stop offset="1" stopColor="#6e8385"/></linearGradient></defs>
    <path className="crest-depth" transform="translate(0 5)" d="M38 105 13 85l14-4L9 59l28 9L24 34l30 18L52 18l28 23 28-23-2 34 30-18-13 34 28-9-18 22 14 4-25 20"/>
    <path className="crest-wings" style={{fill:`url(#${id}-metal)`}} d="M38 105 13 85l14-4L9 59l28 9L24 34l30 18L52 18l28 23 28-23-2 34 30-18-13 34 28-9-18 22 14 4-25 20"/>
    <path style={{fill:`url(#${id}-steel)`}} stroke="#f8dfaa88" strokeWidth=".7" d="m29 44 24 17-9 16-25-12 17 20-10 3 21 17 16-49-8-25 25 20 25-20-8 25 16 49 21-17-10-3 17-20-25 12-9-16 24-17-29 13-22-12-22 12Z"/>
    <circle cx="80" cy="88" r="59" stroke="#161a20" strokeWidth="10"/>
    <circle className="crest-ring" style={{stroke:`url(#${id}-metal)`}} cx="80" cy="85" r="58" strokeWidth="8"/>
    <path d="M25 83a55 55 0 0 1 110 0" stroke="#fff0c0" strokeWidth="1.5"/>
    <path d="M26 91a55 55 0 0 0 108 0" stroke="#302019" strokeWidth="2"/>
    <circle className="crest-inner" cx="80" cy="85" r="49"/>
    <path className="crest-gem" d="m80 17 8 15-8 15-8-15Z"/>
    <path className="crest-engraving" d="M41 49 35 62m84-13 6 13M27 85h10m86 0h10M40 122l8-8m72 8-8-8M62 137l5-10m31 10-5-10"/>
  </svg>;
}
