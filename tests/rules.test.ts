import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRulesAction, createRulesState, type RulesRoom } from '../src/server/rules';
import type { Card } from '../src/shared/types';

const card = (id: string, name: string, ownerId = 'a'): Card => ({ id, name, ownerId, kind: 'spell' });
function setup(): RulesRoom {
  return { players: ['a', 'b'].map(id => ({ id, name: id, life: 20, hand: [], library: [], peek: [] })), publicZones: { battlefield: [], stack: [], graveyard: [], exile: [] }, activePlayerId: 'a', phase: '战斗前主要阶段', rules: createRulesState() };
}
function enabled() { const room = setup(); applyRulesAction(room, 'a', { action: 'setMode', mode: 'assisted' }); return room; }
test('land play checks owner, turn and one land; rejected actions are atomic', () => {
  const r = enabled(); r.players[0].hand.push(card('l1','Forest'),card('l2','Forest'));
  applyRulesAction(r,'a',{action:'playLand',cardId:'l1'});
  const before = structuredClone(r);
  assert.throws(() => applyRulesAction(r,'a',{action:'playLand',cardId:'l2'}));
  assert.deepEqual(r,before);
  assert.throws(() => applyRulesAction(r,'b',{action:'playLand',cardId:'l2'}));
});

test('public cast record identifies the locked player target without private hand contents', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('m','Mountain'));
  r.players[0].hand.push(card('bolt','Lightning Bolt'),card('secret','Private Uncast Card'));
  const log=applyRulesAction(r,'a',{action:'cast',cardId:'bolt',target:{kind:'player',id:'b'}});
  assert.match(log,/target \/ 目标: b \[b\]/);
  assert.ok(!log.includes('Private Uncast Card'));
});
test('cast pays colored and generic mana, then resolves a vanilla creature', () => {
  const r = enabled(); r.publicZones.battlefield.push(card('f','Forest'),card('i','Island')); r.players[0].hand.push(card('bear','Grizzly Bears'));
  applyRulesAction(r,'a',{action:'cast',cardId:'bear'});
  assert.equal(r.publicZones.battlefield.filter(c=>c.tapped).length,2);
  assert.equal(r.publicZones.stack[0].id,'bear');
  applyRulesAction(r,'b',{action:'resolveTop'});
  assert.equal(r.publicZones.battlefield.at(-1)?.power,'2');
});
test('wrong color, unsupported card and invalid targets leave state untouched', () => {
  const r = enabled(); r.publicZones.battlefield.push(card('i','Island')); r.players[0].hand.push(card('bolt','Lightning Bolt'),card('unknown','Secret Card'));
  for (const cardId of ['bolt','unknown']) { const before=structuredClone(r); assert.throws(()=>applyRulesAction(r,'a',{action:'cast',cardId,target:{kind:'player',id:'b'}})); assert.deepEqual(r,before); }
});
test('counterspell resolves LIFO, counters the lower spell, pays both players costs', () => {
  const r = enabled(); r.publicZones.battlefield.push(card('m','Mountain'),card('u1','Island','b'),card('u2','Island','b')); r.players[0].hand.push(card('bolt','Lightning Bolt')); r.players[1].hand.push(card('counter','Counterspell','b'));
  applyRulesAction(r,'a',{action:'cast',cardId:'bolt',target:{kind:'player',id:'b'}});
  applyRulesAction(r,'b',{action:'cast',cardId:'counter',target:{kind:'stack',id:'bolt'}});
  applyRulesAction(r,'a',{action:'resolveTop'});
  assert.equal(r.players[1].life,20); assert.equal(r.publicZones.stack.length,0); assert.equal(r.publicZones.graveyard.length,2);
});
test('draw and life change on resolution; draw shortage is atomic', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('u','Island'),card('f','Forest'),card('m','Mountain')); r.players[0].hand.push(card('d','Divination')); r.players[0].library.push(card('hidden','Private Draw'));
  applyRulesAction(r,'a',{action:'cast',cardId:'d'}); const before=structuredClone(r);
  assert.throws(()=>applyRulesAction(r,'a',{action:'resolveTop'})); assert.deepEqual(r,before);
  r.players[0].library.push(card('hidden2','Another Private Draw')); const log=applyRulesAction(r,'a',{action:'resolveTop'});
  assert.equal(r.players[0].hand.length,2); assert.ok(!log.includes('Private Draw'));
});
test('turn advance untaps and resets land limit, refuses non-active player', () => {
  const r=enabled(); r.players[1].library.push(card('draw','Secret','b')); r.publicZones.battlefield.push({...card('u','Island','b'),tapped:true});
  assert.throws(()=>applyRulesAction(r,'b',{action:'endTurn'}));
  const log=applyRulesAction(r,'a',{action:'endTurn'}); assert.equal(r.activePlayerId,'b'); assert.equal(r.rules.turnNumber,2); assert.equal(r.publicZones.battlefield[0].tapped,false); assert.equal(r.players[1].hand[0].id,'draw'); assert.ok(!log.includes('Secret'));
});
test('end turn draw shortage or pending peek refuses atomically',()=>{
  for(const peek of [false,true]) { const r=enabled(); if(peek) {r.players[1].library.push(card('d','Forest','b')); r.players[1].peek.push(card('p','Island','b'));} const before=structuredClone(r); assert.throws(()=>applyRulesAction(r,'a',{action:'endTurn'})); assert.deepEqual(r,before); }
});
test('damage and life gain are applied only when their spells resolve', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('m','Mountain'),card('p','Plains'),card('f','Forest')); r.players[0].hand.push(card('bolt','Lightning Bolt'),card('life','Sacred Nectar'));
  applyRulesAction(r,'a',{action:'cast',cardId:'bolt',target:{kind:'player',id:'b'}});
  assert.equal(r.players[1].life,20); applyRulesAction(r,'b',{action:'resolveTop'}); assert.equal(r.players[1].life,17);
  applyRulesAction(r,'a',{action:'cast',cardId:'life'}); assert.equal(r.players[0].life,20); applyRulesAction(r,'a',{action:'resolveTop'}); assert.equal(r.players[0].life,24);
});
test('invalid target fails before paying; no-target spells reject extraneous targets', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('m','Mountain')); r.players[0].hand.push(card('bolt','Lightning Bolt'),card('d','Divination'));
  for(const action of [{action:'cast',cardId:'bolt',target:{kind:'player',id:'missing'}},{action:'cast',cardId:'d',target:{kind:'player',id:'a'}}] as const) {
    const before=structuredClone(r); assert.throws(()=>applyRulesAction(r,'a',action)); assert.deepEqual(r,before);
  }
});
test('unknown battlefield and modifiers prevent mode entry without mutation', () => {
  for(const permanent of [card('x','Unknown permanent'),{...card('f','Forest'),plusOneCounters:1},{...card('b','Grizzly Bears'),power:'9'},{...card('f','Forest'),token:true}]) {
    const r=setup(); r.publicZones.battlefield.push(permanent); const before=structuredClone(r);
    assert.throws(()=>applyRulesAction(r,'a',{action:'setMode',mode:'assisted'})); assert.deepEqual(r,before);
  }
});
test('manual escape retains stack while assisted reentry refuses unmanaged stack', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('m','Mountain')); r.players[0].hand.push(card('bolt','Lightning Bolt'));
  applyRulesAction(r,'a',{action:'cast',cardId:'bolt',target:{kind:'player',id:'b'}});
  assert.throws(()=>applyRulesAction(r,'a',{action:'endTurn'}));
  applyRulesAction(r,'a',{action:'setMode',mode:'manual'}); assert.equal(r.publicZones.stack.length,1); assert.deepEqual(r.rules.pending,{});
  const before=structuredClone(r); assert.throws(()=>applyRulesAction(r,'a',{action:'setMode',mode:'assisted'})); assert.deepEqual(r,before);
});
test('mode toggling cannot reset land allowance, non-active sorceries reject', () => {
  const r=enabled(); r.players[0].hand.push(card('l','Forest'),card('l2','Forest')); r.players[1].hand.push(card('b','Grizzly Bears','b'));
  applyRulesAction(r,'a',{action:'playLand',cardId:'l'}); applyRulesAction(r,'a',{action:'setMode',mode:'manual'}); applyRulesAction(r,'a',{action:'setMode',mode:'assisted'});
  assert.throws(()=>applyRulesAction(r,'a',{action:'playLand',cardId:'l2'})); assert.throws(()=>applyRulesAction(r,'b',{action:'cast',cardId:'b'}));
});
test('counter target removed in response causes spell to resolve without effect', () => {
  const r=enabled(); r.publicZones.battlefield.push(card('m','Mountain'),card('u1','Island','b'),card('u2','Island','b'),card('u3','Island'),card('u4','Island')); r.players[0].hand.push(card('bolt','Lightning Bolt'),card('c2','Counterspell')); r.players[1].hand.push(card('c1','Counterspell','b'));
  applyRulesAction(r,'a',{action:'cast',cardId:'bolt',target:{kind:'player',id:'b'}}); applyRulesAction(r,'b',{action:'cast',cardId:'c1',target:{kind:'stack',id:'bolt'}}); applyRulesAction(r,'a',{action:'cast',cardId:'c2',target:{kind:'stack',id:'bolt'}});
  applyRulesAction(r,'b',{action:'resolveTop'}); applyRulesAction(r,'a',{action:'resolveTop'}); assert.equal(r.players[1].life,20); assert.equal(r.publicZones.graveyard.length,3);
});
