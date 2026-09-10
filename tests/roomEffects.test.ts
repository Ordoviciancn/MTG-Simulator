import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisualChanges } from '../src/client/roomEffects';
import type { ClientRoomView } from '../src/shared/types';
function room(): ClientRoomView {
  return {roomCode:'A',youId:'a',players:['a','b'].map(id=>({id,name:id,life:20,libraryCount:20,handCount:0,mulligans:0,hand:[],library:[],peek:[],sideboard:[],hasDeck:true,tableCounters:0,privateLog:[]})),publicZones:{battlefield:[],graveyard:[],exile:[],stack:[]},turn:{activePlayerId:'a',activePlayerName:'a',phase:'main',canUndoPhase:false,mode:'manual'},log:[]};
}
test('initial and new room snapshots do not replay animations',()=>{
  const next=room(); assert.deepEqual(getVisualChanges(null,next),[]);
  const previous=room(); next.roomCode='B'; next.players[0].life=5; assert.deepEqual(getVisualChanges(previous,next),[]);
});
test('public zone transitions and actual life loss produce one event each',()=>{
  const previous=room(); previous.publicZones.stack.push({id:'bolt',name:'Lightning Bolt',ownerId:'a',kind:'spell'});
  const next=structuredClone(previous); next.publicZones.graveyard.push(next.publicZones.stack.pop()!); next.players[1].life=17;
  const events=getVisualChanges(previous,next); assert.equal(events.length,2);
  assert.deepEqual(events[0],{kind:'zone',cardId:'bolt',playerId:'a',from:'stack',to:'graveyard'});
  assert.equal(events[1].amount,3);
});
test('opponent draw effects never include private card identity or text',()=>{
  const previous=room(), next=room(); next.players[1].libraryCount=19; next.players[1].handCount=1;
  next.players[1].hand=[{id:'secret-id',name:'Secret card',ownerId:'b',kind:'spell'}];
  const events=getVisualChanges(previous,next); assert.equal(events.length,1); assert.equal(events[0].cardId,undefined);
  assert.ok(!JSON.stringify(events).includes('secret'));
});
test('reorder and unchanged snapshots do not animate casts or damage',()=>{
  const before=room(); before.players[0].hand=[{id:'x',name:'X',ownerId:'a',kind:'spell'},{id:'y',name:'Y',ownerId:'a',kind:'spell'}];
  const after=structuredClone(before); after.players[0].hand.reverse(); assert.deepEqual(getVisualChanges(before,after),[]);
});

test('newly public opponent spells animate from their player without treating abilities as casts',()=>{
  const before=room(), after=room();
  after.publicZones.stack.push({id:'spell',name:'Spell',ownerId:'b',kind:'spell'});
  after.publicZones.stack.push({id:'ability',name:'Ability',ownerId:'b',kind:'spell',stackAbility:true});
  assert.deepEqual(getVisualChanges(before,after),[{kind:'cast',cardId:'spell',playerId:'b',from:'player',to:'stack'}]);
});
