import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {ArenaCard,ArenaEvent,ArenaRoomView,ArenaServerMessage} from '../shared/arenaProtocol';
import type {Command} from '../shared/matchProtocol';
import {ForgeControls} from './ForgeControls';
import {SemanticCanvas} from './SemanticCanvas';
import {CombatLines} from './CombatLines';
import './forgeArena.css';

const defaultDeck='20 Mountain\n20 Forest\n4 Lightning Bolt\n4 Shock\n4 Llanowar Elves\n4 Grizzly Bears\n4 Giant Growth';
const label=(value:string)=>({Play:'先手',Draw:'后手',Keep:'保留',Mulligan:'调度',Auto:'自动支付',OK:'确认','End Turn':'让过本回合',Cancel:'取消'}[value]??value);
const phaseLabel=(value:string)=>({null:'准备对局',UNTAP:'重置',UPKEEP:'维持',DRAW:'抓牌',MAIN1:'战斗前主阶段',COMBAT_BEGIN:'战斗开始',COMBAT_DECLARE_ATTACKERS:'宣告攻击者',COMBAT_DECLARE_BLOCKERS:'宣告阻挡者',COMBAT_FIRST_STRIKE_DAMAGE:'先攻伤害',COMBAT_DAMAGE:'战斗伤害',COMBAT_END:'战斗结束',MAIN2:'战斗后主阶段',END_OF_TURN:'结束步骤',CLEANUP:'清除步骤'}[value]??value);
const imageUrl=(card:ArenaCard)=>card.hidden?'/mtg-card-back.png':`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=normal`;

export function ArenaClient(){
  const [room,setRoom]=useState<ArenaRoomView|null>(null),[connected,setConnected]=useState(false),[error,setError]=useState('');
  const [name,setName]=useState('玩家'),[deck,setDeck]=useState(defaultDeck),[code,setCode]=useState('');
  const [pending,setPending]=useState(false),[events,setEvents]=useState<ArenaEvent[]>([]),[preview,setPreview]=useState<ArenaCard|null>(null);
  const [zone,setZone]=useState<{title:string;cards:ArenaCard[]}|null>(null);
  const socket=useRef<WebSocket|null>(null),roomRef=useRef(room),lastSequence=useRef(0),pendingCommand=useRef<{command:Command;sent:boolean}|null>(null);
  roomRef.current=room;
  useEffect(()=>{
    let closed=false,retry:ReturnType<typeof setTimeout>,attempt=0;
    const connect=()=>{
      const host=location.port==='5180'?`${location.hostname}:8787`:location.host;
      const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${host}/forge`);socket.current=ws;
      ws.onopen=()=>{
        if(closed){ws.close();return;}attempt=0;setConnected(true);
        const saved=sessionStorage.getItem('forge-seat');
        if(saved){try{ws.send(JSON.stringify({type:'resume',credential:JSON.parse(saved)}));}catch{sessionStorage.removeItem('forge-seat');}}
      };
      ws.onmessage=e=>{
        const message=JSON.parse(e.data) as ArenaServerMessage;
        if(message.type==='credential'){sessionStorage.setItem('forge-seat',JSON.stringify(message.credential));}
        if(message.type==='view'){
          const first=roomRef.current?.matchId!==message.room.matchId;
          roomRef.current=message.room;setRoom(message.room);
          if(first){lastSequence.current=message.room.snapshot?.lastEventSequence??0;setEvents([]);}
          if(message.room.status==='failed')setPending(false);
          // A reconnect reuses the command ID; the server ledger decides whether it already ran.
          if(pendingCommand.current && !pendingCommand.current.sent){pendingCommand.current.sent=true;ws.send(JSON.stringify({type:'command',command:pendingCommand.current.command}));}
        }
        if(message.type==='event' && message.matchId===roomRef.current?.matchId && message.event.sequence>lastSequence.current){
          lastSequence.current=message.event.sequence;setEvents(old=>[...old.slice(-31),message.event]);
        }
        if(message.type==='receipt'){
          if(message.receipt.commandId===pendingCommand.current?.command.commandId){pendingCommand.current=null;setPending(false);}
          if(message.receipt.status!=='accepted')setError(message.receipt.status==='resync'?'对局状态已更新，请重新选择。':'该操作已失效或不适用于当前窗口。');
        }
        if(message.type==='error'){setError(message.message);setPending(false);if(message.message.includes('无法恢复座位')){sessionStorage.removeItem('forge-seat');setRoom(null);pendingCommand.current=null;}}
      };
      ws.onclose=e=>{
        setConnected(false);if(pendingCommand.current)pendingCommand.current.sent=false;
        if(!closed && e.code!==4001)retry=setTimeout(connect,Math.min(1000*2**attempt++,10000));
        if(e.code===4001)setError('此座位已在另一个连接恢复。');
      };
    };
    connect();return()=>{closed=true;clearTimeout(retry);socket.current?.close();};
  },[]);
  function send(value:unknown){if(socket.current?.readyState===WebSocket.OPEN){setError('');socket.current.send(JSON.stringify(value));}}
  function command(operation:string,parameters:Record<string,unknown>={}){
    if(!room||pending||!connected||room.status!=='playing')return;
    const command:Command={protocolVersion:1,matchId:room.matchId,playerId:room.playerId,commandId:crypto.randomUUID(),expectedRevision:room.revision,operation,parameters};
    pendingCommand.current={command,sent:true};setPending(true);send({type:'command',command});
  }
  function selectCard(card:ArenaCard){if(room?.prompt?.kind==='input')command('selectCard',{requestId:room.prompt.requestId,cardId:card.id});}
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.repeat)return;
      if(e.code==='Space'&&room?.prompt?.okEnabled){e.preventDefault();command('ok',{requestId:room.prompt.requestId});}
      if(e.key==='Escape'){setPreview(null);setZone(null);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[room,pending,connected]);
  const state=room?.snapshot,you=state?.players.find(p=>p.id===room?.playerId),opponent=state?.players.find(p=>p.id!==room?.playerId);
  const canSelect=connected&&!pending&&room?.prompt?.kind==='input';
  function cardNode(card:ArenaCard,style?:CSSProperties){return <button key={card.stackId??card.id} className={`forge-card ${card.tapped?'is-tapped':''} ${card.actionable&&canSelect?'is-actionable':''} ${state?.combat?.some(a=>a.attackerId===card.id)?'is-attacking':''} ${state?.combat?.some(a=>a.blockerIds.includes(card.id))?'is-blocking':''}`} style={style} data-card-id={card.id} title={card.name} draggable={!!canSelect} onDragStart={e=>{e.dataTransfer.setData('text/plain',card.id);setPreview(null);}} onMouseEnter={()=>setPreview(card)} onMouseLeave={()=>setPreview(null)} onFocus={()=>setPreview(card)} onBlur={()=>setPreview(null)} onClick={()=>selectCard(card)}>
    <img src={imageUrl(card)} alt={card.name} draggable={false}/><span className="forge-card-name">{card.name}</span>{card.power!==undefined&&<strong className="forge-pt">{card.power}/{card.toughness}</strong>}
  </button>;}
  const prompt=room?.prompt?{...room.prompt,okLabel:label(room.prompt.okLabel??''),cancelLabel:label(room.prompt.cancelLabel??'')}:undefined;
  return <main className="forge-app">
    {!room?<section className="forge-lobby"><span className="forge-eyebrow">TABLETOP · ARENA</span><h1>进入对局</h1><p>双方就座后开始。无可用动作时自动让过，有选择时等待你的决定。</p><label>玩家名称<input value={name} onChange={e=>setName(e.target.value)} maxLength={64}/></label><label>牌表<textarea value={deck} onChange={e=>setDeck(e.target.value)} rows={9}/></label><button disabled={!connected} onClick={()=>send({type:'create',name,deckText:deck})}>创建对局</button><div className="forge-join"><input placeholder="房间码" value={code} onChange={e=>setCode(e.target.value)}/><button disabled={!connected||!code} onClick={()=>send({type:'join',code,name,deckText:deck})}>加入</button></div><small>{connected?'已连接':'正在连接…'}</small></section>:<>
      <header className="forge-top"><span>对局 {room.code}</span><span>{connected?'已连接':'正在重新连接…'}</span><button onClick={()=>{sessionStorage.removeItem('forge-seat');location.reload();}}>离开</button></header>
      {!state?<section className="forge-wait"><h1>{room.status==='waiting'?'等待对手':'正在准备对局'}</h1><p>房间码：{room.code}</p></section>:<>
        <section className="forge-board" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');const card=you?.hand.find(c=>c.id===id);if(card)selectCard(card);}}>
          <div className="forge-enemy-hand">{Array.from({length:opponent?.handCount??0},(_,i)=><img key={i} src="/mtg-card-back.png" alt="对手手牌" style={{transform:`rotate(${(i-((opponent?.handCount??1)-1)/2)*4}deg)`}}/>)}</div>
          {[opponent,you].map((p,index)=>p&&<section className={`forge-side ${index===0?'enemy':'self'}`} key={p.id}>
            <button data-player-id={p.id} className={`forge-avatar ${state.activePlayerId===p.id?'active':''}`} onClick={()=>room.prompt&&command('selectPlayer',{requestId:room.prompt.requestId,playerId:p.id})}><span>{p.name}</span><strong>{p.life}</strong></button>
            <div className="forge-permanents">{p.battlefield.filter(c=>c.kind!=='land').map(c=>cardNode(c))}</div><div className="forge-lands">{p.battlefield.filter(c=>c.kind==='land').map(c=>cardNode(c))}</div>
            <aside className="forge-zones"><div className="forge-library"><img src="/mtg-card-back.png" alt="牌库"/><span>{p.libraryCount}</span></div>{(['graveyard','exile'] as const).map(z=><button key={z} onClick={()=>setZone({title:z==='graveyard'?'坟场':'放逐区',cards:p[z]})}>{z==='graveyard'?'坟场':'放逐'} <b>{p[z].length}</b></button>)}</aside>
          </section>)}
          <div className="forge-phase">{state.gameOver?'对局结束':phaseLabel(state.phase)}</div>
          <aside className="forge-stack" aria-label="堆叠">{state.stack.map(c=>cardNode(c))}</aside>
          <CombatLines combat={state.combat??[]}/>
        </section>
        <div className="forge-hand" aria-label="手牌">{you?.hand.map((c,i)=>{const offset=i-(you.hand.length-1)/2;return cardNode(c,{'--fan-angle':`${Math.max(-13,Math.min(13,offset*3))}deg`,'--fan-y':`${Math.abs(offset)**1.6*2}px`,zIndex:i} as CSSProperties);})}</div>
        <fieldset className="forge-input" disabled={!connected||pending||room.status==='failed'||state.gameOver}><ForgeControls prompt={prompt} fullControl={room.fullControl} onControl={fullControl=>command('control',{fullControl})} onDecision={decision=>command(decision.type,{...decision})}/></fieldset>
        <SemanticCanvas events={events} ownPlayerId={room.playerId}/>
        {preview&&!zone&&<div className="forge-preview"><img src={imageUrl(preview)} alt={preview.name}/></div>}
        {zone&&<div className="forge-modal" onClick={()=>setZone(null)}><section onClick={e=>e.stopPropagation()}><header><h2>{zone.title}</h2><button onClick={()=>setZone(null)}>关闭</button></header><div>{zone.cards.map(c=>cardNode(c))}</div></section></div>}
      </>}
    </>}
    {(error||room?.error)&&<div className="forge-error" role="alert">{room?.error||error}<button onClick={()=>setError('')}>×</button></div>}
  </main>;
}
