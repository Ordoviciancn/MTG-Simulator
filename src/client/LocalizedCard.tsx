import {useEffect,useState,useSyncExternalStore,type ImgHTMLAttributes} from 'react';
import {canLookup,chineseCard,type ChineseCard} from './chineseCards';
const cache=new Map<string,ChineseCard|undefined>(),pending=new Set<string>(),listeners=new Set<()=>void>();
let revision=0,queue=Promise.resolve();
const subscribe=(callback:()=>void)=>{listeners.add(callback);return()=>{listeners.delete(callback);};};
const snapshot=()=>revision;
// 通知失败不能中断串行队列，否则后续卡牌的汉化会全部停摆。
const notify=()=>{for(const callback of [...listeners]){try{callback();}catch{}}};
const chineseStorageKey='forge-chinese-cards';
let chineseOn=(()=>{try{return localStorage.getItem(chineseStorageKey)==='1';}catch{return false;}})();
const chineseListeners=new Set<()=>void>();
const maxAttempts=5;
const failures=new Map<string,number>();
export function setChineseCards(value:boolean){value=!!value;if(value===chineseOn)return;chineseOn=value;try{localStorage.setItem(chineseStorageKey,value?'1':'0');}catch{}
  if(value)failures.clear();
  chineseListeners.forEach(listener=>listener());}
const subscribeChinese=(listener:()=>void)=>{chineseListeners.add(listener);return()=>{chineseListeners.delete(listener);};};
export function useChineseCards(){return useSyncExternalStore(subscribeChinese,()=>chineseOn,()=>false);}
function request(name:string){
  if(cache.has(name)||pending.has(name)||pending.size>=256)return;
  const attempts=failures.get(name)??0;
  if(attempts>=maxAttempts)return;
  pending.add(name);
  const run=async()=>{
    let value:ChineseCard|undefined,resolved=false;
    try{
      const params=new URLSearchParams({q:`name=${JSON.stringify(name)}`,view:'0',page_size:'100',priority_chinese:'true',include_fav:'false'});
      const response=await fetch(`https://mtgch.com/api/v1/result?${params}`,{credentials:'omit',signal:AbortSignal.timeout(6000)});
      if(response.ok){const body=await response.json();if(Array.isArray(body.items)){value=chineseCard(name,body.items);resolved=true;}}
    }catch{}
    // 查询成功（含确认无翻译）才落缓存；超时、限流等失败进入退避重试，不再永久卡在英文。
    if(resolved){failures.delete(name);cache.set(name,value);if(cache.size>512)cache.delete(cache.keys().next().value!);}
    else{failures.set(name,attempts+1);if(attempts+1<maxAttempts)setTimeout(()=>{pending.delete(name);request(name);},Math.min(2500*2**attempts,30000));}
    pending.delete(name);
    revision++;notify();
    await new Promise(resolve=>setTimeout(resolve,200));
  };
  // 任一请求异常也不能断开队列。
  queue=queue.then(run,run);
}
export function useChineseCard(name?:string,hidden=false){
  const enabled=useChineseCards();
  useSyncExternalStore(subscribe,snapshot,snapshot);
  useEffect(()=>{if(enabled&&canLookup(name,hidden))request(name!);},[name,hidden,enabled]);
  return enabled&&canLookup(name,hidden)?cache.get(name!):undefined;
}
export function LocalizedName({name,hidden=false}:{name:string;hidden?:boolean}){
  const card=useChineseCard(name,hidden);return <>{hidden?'牌面朝下':card?.zhName||name}</>;
}
export function LocalizedCardImage({name,hidden=false,...props}:Omit<ImgHTMLAttributes<HTMLImageElement>,'src'> & {name?:string;hidden?:boolean}){
  const card=useChineseCard(name,hidden),[failed,setFailed]=useState<string[]>([]);
  const english=canLookup(name,hidden)?`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name!)}&format=image&version=normal`:'/mtg-card-back.png';
  const preferred=card?.image||english,src=!failed.includes(preferred)?preferred:!failed.includes(english)?english:'/mtg-card-back.png';
  return <img {...props} src={src} alt={props.alt??(hidden?'牌背':card?.zhName||name||'牌背')} draggable={false} referrerPolicy="no-referrer" onError={()=>setFailed(values=>values.includes(src)?values:[...values.slice(-3),src])}/>;
}
export function ChineseCardText({name,hidden=false}:{name:string;hidden?:boolean}){
  const card=useChineseCard(name,hidden);
  return card?.text?<div className="chinese-card-text"><strong>{card.zhName}</strong><p>{card.text}</p><small>{card.source} · 卡牌参考，实际结算以引擎为准</small></div>:null;
}
