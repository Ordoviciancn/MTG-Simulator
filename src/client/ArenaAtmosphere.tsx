import type {CSSProperties} from 'react';

export function ArenaAtmosphere(){
  return <div className="forge-atmosphere" aria-hidden="true">
    <div className="forge-light-wash"/>
    <div className="forge-table-edge"/>
    {Array.from({length:12},(_,index)=><i key={index} className="forge-mote" style={{left:`${8+(index*37)%86}%`,top:`${15+(index*23)%65}%`,'--drift':`${index%2?24:-24}px`,animationDelay:`${-index*1.7}s`,animationDuration:`${12+index%5*2}s`} as CSSProperties}/>)}
  </div>;
}

export function AvatarCrest(){
  return <svg className="forge-avatar-crest" viewBox="0 0 160 160" fill="none" aria-hidden="true" focusable="false">
    <path className="crest-wings" d="M38 105 13 85l14-4L9 59l28 9L24 34l30 18L52 18l28 23 28-23-2 34 30-18-13 34 28-9-18 22 14 4-25 20"/>
    <circle className="crest-ring" cx="80" cy="85" r="55"/>
    <circle className="crest-inner" cx="80" cy="85" r="49"/>
    <path className="crest-gem" d="m80 17 8 15-8 15-8-15Z"/>
    <path className="crest-engraving" d="M41 49 35 62m84-13 6 13M27 85h10m86 0h10M40 122l8-8m72 8-8-8M62 137l5-10m31 10-5-10"/>
  </svg>;
}
