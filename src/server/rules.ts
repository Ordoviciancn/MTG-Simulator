import type { Card, PublicZones, RulesAction, RulesTarget, RulesView, SupportedCard } from '../shared/types';

type Definition = SupportedCard & { color?: string; power?: string; toughness?: string; effect?: 'draw' | 'life' | 'damage' | 'counter' };
// These are hand-authored, bounded definitions, not an Oracle parser. Bolt targets players only.
const definitions: Definition[] = [
  ...(['Plains','Island','Swamp','Mountain','Forest'] as const).map((name,i) => ({ name, kind:'land' as const, cost:'', description:'Basic land / 基本地', color:'WUBRG'[i] })),
  {name:'Grizzly Bears',kind:'creature',cost:'1G',description:'2/2 vanilla / 无异能',power:'2',toughness:'2'},
  {name:'Hill Giant',kind:'creature',cost:'3R',description:'3/3 vanilla / 无异能',power:'3',toughness:'3'},
  {name:'Divination',kind:'sorcery',cost:'2U',description:'Draw two / 抓两张牌',effect:'draw'},
  {name:'Sacred Nectar',kind:'sorcery',cost:'1W',description:'Gain 4 life / 获得4点生命',effect:'life'},
  {name:'Lightning Bolt',kind:'instant',cost:'R',description:'3 damage to a player only / 仅支持对玩家造成3点伤害',target:'player',effect:'damage'},
  {name:'Counterspell',kind:'instant',cost:'UU',description:'Counter supported spell / 反击已支持的咒语',target:'stack',effect:'counter'}
];
const definition = (card: Card) => definitions.find(d=>d.name.toLowerCase()===card.name.trim().toLowerCase());
export type RulesState = RulesView & { pending: Record<string,{ target?: RulesTarget; name: string }> };
export type RulesRoom = { players: {id:string; name:string; life:number; hand:Card[]; library:Card[]; peek:Card[]}[]; publicZones:PublicZones; activePlayerId:string|null; phase:string; rules:RulesState };
export function createRulesState(): RulesState { return {mode:'manual',turnNumber:1,landsPlayed:{},supportedCards:definitions.map(({name,kind,cost,description,target})=>({name,kind,cost,description,target})),pending:{}}; }
export function rulesView(state:RulesState):RulesView { const {pending,...view}=state; return view; }
function requireRule(condition: unknown, message:string): asserts condition { if(!condition) throw new Error(message); }
function mainPhase(room:RulesRoom) { return ['战斗前主要阶段','第二个主要阶段','战斗前行动阶段','战斗后行动阶段'].includes(room.phase); }
function ownMain(room:RulesRoom,actorId:string) { requireRule(room.activePlayerId===actorId && mainPhase(room) && room.publicZones.stack.length===0,'需要自己的主要阶段且堆叠为空。 / Own main phase and empty stack required.'); }
function supportedBattlefield(room:RulesRoom) {
  requireRule(room.publicZones.battlefield.every(c=>{
    const d=definition(c);
    return d && (d.kind==='land'||d.kind==='creature') && !c.token && !c.faceDown && !c.backFaceUp && !c.attachedTo && !c.plusOneCounters && !c.counters && !c.stackAbility && (d.kind!=='creature'||((!c.power||c.power===d.power)&&(!c.toughness||c.toughness===d.toughness)));
  }),'战场含未知永久物、附件或修正，请使用手动模式。 / Unsupported battlefield or modifiers; use manual mode.');
}
function validateTarget(room:RulesRoom,d:Definition,target:RulesTarget|undefined) {
  if(!d.target) { requireRule(!target,'此咒语没有目标。 / This spell has no target.'); return; }
  requireRule(target?.kind===d.target,'目标类别不受支持。 / Unsupported target kind.');
  if(d.target==='player') requireRule(room.players.some(p=>p.id===target.id),'目标玩家不存在。 / Player not found.');
  else requireRule(room.publicZones.stack.some(c=>c.id===target.id && !c.stackAbility && room.rules.pending[c.id]),'只能指定辅助模式堆叠中的咒语。 / Target a supported spell on the stack.');
}
function payment(room:RulesRoom,actorId:string,cost:string):Card[] {
  const available=room.publicZones.battlefield.filter(c=>c.ownerId===actorId && !c.tapped && !c.faceDown && !c.backFaceUp && !c.token && !c.attachedTo && definition(c)?.kind==='land');
  const chosen:Card[]=[];
  for(const color of cost.replace(/\d/g,'')) { const land=available.find(c=>!chosen.includes(c)&&definition(c)?.color===color); requireRule(land,'没有足够的对应颜色基本地。 / Insufficient colored basic lands.'); chosen.push(land); }
  const generic=Number(cost.match(/^\d+/)?.[0]??0);
  const rest=available.filter(c=>!chosen.includes(c)).slice(0,generic);
  requireRule(rest.length===generic,'没有足够的未横置基本地。 / Insufficient untapped basic lands.'); return [...chosen,...rest];
}
export function applyRulesAction(room:RulesRoom,actorId:string,action:RulesAction):string {
  const actor=room.players.find(p=>p.id===actorId); requireRule(actor,'玩家不存在。 / Player not found.');
  if(action.action==='setMode') {
    requireRule(action.mode==='manual'||action.mode==='assisted','无效模式。 / Invalid mode.');
    if(action.mode==='assisted') { requireRule(room.publicZones.stack.length===0,'开启辅助前请清空堆叠。 / Empty the stack before enabling assistance.'); supportedBattlefield(room); }
    requireRule(room.activePlayerId===actorId,'仅当前回合玩家可切换模式。 / Active player only.');
    room.rules.mode=action.mode;
    if(action.mode==='manual') room.rules.pending={};
    if(action.mode==='assisted'&&!mainPhase(room)) room.phase='战斗前主要阶段';
    return `${actor.name}: ${action.mode}`;
  }
  requireRule(room.rules.mode==='assisted','请先开启规则辅助。 / Enable assisted rules first.');
  supportedBattlefield(room);
  if(action.action==='playLand'||action.action==='cast') {
    const card=actor.hand.find(c=>c.id===action.cardId); requireRule(card && card.ownerId===actorId,'只能使用自己的手牌。 / Use your own hand.');
    const d=definition(card); requireRule(d && !card.token && !card.faceDown && !card.backFaceUp && !card.plusOneCounters && !card.counters && !card.attachedTo && !card.stackAbility,'此牌或形态尚未支持，请切换手动模式。 / Unsupported card or face; use manual mode.');
    if(action.action==='playLand') {
      ownMain(room,actorId); requireRule(d.kind==='land','此牌不是支持的基本地。 / Supported basic land required.'); requireRule(!room.rules.landsPlayed[actorId],'本回合已经出过地。 / Land already played this turn.');
      actor.hand.splice(actor.hand.indexOf(card),1); card.kind='land'; card.tapped=false; room.publicZones.battlefield.push(card); room.rules.landsPlayed[actorId]=1;
      return `${actor.name}: ${card.name} → battlefield`;
    }
    requireRule(d.kind!=='land','地牌使用出地操作。 / Use play land.');
    if(d.kind!=='instant') ownMain(room,actorId);
    validateTarget(room,d,action.target); const lands=payment(room,actorId,d.cost);
    lands.forEach(c=>{c.tapped=true;}); actor.hand.splice(actor.hand.indexOf(card),1); card.kind=d.kind==='creature'?'creature':'spell'; card.power=d.power; card.toughness=d.toughness;
    room.publicZones.stack.push(card); room.rules.pending[card.id]={name:d.name,target:action.target?{...action.target}:undefined};
    const targetLabel = action.target?.kind === 'player'
      ? room.players.find(p => p.id === action.target!.id)?.name
      : action.target ? room.publicZones.stack.find(c => c.id === action.target!.id)?.name : undefined;
    return `${actor.name}: ${card.name} (${d.cost}) → stack${action.target ? ` · target / 目标: ${targetLabel} [${action.target.id}]` : ''}`;
  }
  if(action.action==='resolveTop') {
    const card=room.publicZones.stack.at(-1); requireRule(card,'堆叠为空。 / Stack is empty.');
    const pending=room.rules.pending[card.id]; const d=definition(card);
    requireRule(pending&&d&&pending.name===d.name&&!card.faceDown,'堆叠项目不受支持。 / Unsupported stack item.');
    const owner=room.players.find(p=>p.id===card.ownerId); requireRule(owner,'咒语拥有者不存在。 / Spell owner not found.');
    let legal=true; try { validateTarget(room,d,pending.target); } catch { legal=false; }
    if(legal&&d.effect==='draw') requireRule(owner.library.length>=2 && owner.peek.length===0,'牌库不足或看顶尚未归还，请手动处理。 / Insufficient library or pending peek; resolve manually.');
    room.publicZones.stack.pop(); delete room.rules.pending[card.id];
    if(legal) {
      if(d.effect==='draw') owner.hand.push(...owner.library.splice(0,2));
      if(d.effect==='life') owner.life+=4;
      if(d.effect==='damage') room.players.find(p=>p.id===pending.target!.id)!.life-=3;
      if(d.effect==='counter') { const index=room.publicZones.stack.findIndex(c=>c.id===pending.target!.id); const [target]=room.publicZones.stack.splice(index,1); delete room.rules.pending[target.id]; room.publicZones.graveyard.push(target); }
    }
    if(legal&&d.kind==='creature') { card.tapped=false; room.publicZones.battlefield.push(card); } else room.publicZones.graveyard.push(card);
    return `${card.name}: ${legal?'resolved / 已结算':'illegal target / 目标非法，未生效'}`;
  }
  if(action.action==='endTurn') {
    requireRule(room.activePlayerId===actorId,'仅当前回合玩家可结束回合。 / Active player only.'); requireRule(room.publicZones.stack.length===0,'请先结算堆叠。 / Resolve the stack first.');
    const next=room.players.find(p=>p.id!==actorId)??actor;
    requireRule(next.library.length>=1 && next.peek.length===0,'牌库为空或看顶尚未归还，请切换手动模式；不自动裁定抽空败北。 / Empty library or pending peek; switch to manual mode. Deck-out is not automated.');
    room.activePlayerId=next.id; room.phase='战斗前主要阶段'; room.rules.turnNumber++; room.rules.landsPlayed={};
    room.publicZones.battlefield.filter(c=>c.ownerId===next.id).forEach(c=>{c.tapped=false;});
    next.hand.push(next.library.shift()!);
    return `${next.name}: turn ${room.rules.turnNumber}; untap and draw 1 / 重置并抓一张牌`;
  }
  throw new Error('未知规则操作。 / Unknown rules action.');
}
