import {type CSSProperties} from 'react';

export function ArenaAtmosphere(){
  return <div className="forge-atmosphere" aria-hidden="true">
    <div className="forge-light-wash"/>
    <div className="forge-table-edge"/>
    {Array.from({length:12},(_,index)=><i key={index} className="forge-mote" style={{left:`${8+(index*37)%86}%`,top:`${15+(index*23)%65}%`,'--drift':`${index%2?24:-24}px`,animationDelay:`${-index*1.7}s`,animationDuration:`${12+index%5*2}s`} as CSSProperties}/>)}
  </div>;
}

export function AvatarCrest(){
  return <svg className="forge-avatar-crest" viewBox="0 0 110 110" fill="none" aria-hidden="true" focusable="false">
    <circle cx="55" cy="55" r="52" stroke="#bca478" strokeWidth="2"/>
    <path d="M5 55a50 50 0 0 1 100 0" stroke="#f4dfb6" strokeOpacity=".6"/>
  </svg>;
}
