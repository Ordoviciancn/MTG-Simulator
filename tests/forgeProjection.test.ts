import test from 'node:test';
import assert from 'node:assert/strict';
import { ForgeProjection } from '../src/server/forgeProjection';

test('observer projections strip opposing hands and expire handles after concealment',()=>{
  const projector=new ForgeProjection(0,()=>['A','B']);
  const c={id:17,ownerId:0,name:'Mountain',kind:'land'};
  const p=(id:number)=>({id,name:'Player',life:20,hand:[{...c,id:17+id,ownerId:id}],handCount:1,libraryCount:59,battlefield:[],graveyard:[],exile:[]});
  const raw={type:'state',players:[p(0),p(1)],stack:[],phase:'MAIN1',activePlayerId:0};
  const first=projector.snapshot(raw),id=first.players[0].hand[0].id;
  assert.equal(first.players[1].hand.length,0);
  assert.equal(projector.resolveCard(id),17);
  assert.equal(first.players[0].id,'A');
  assert.equal(projector.snapshot(raw).players[0].hand[0].id,id);
  projector.snapshot({...raw,players:[{...p(0),hand:[]},p(1)]});
  assert.equal(projector.resolveCard(id),undefined);
  assert.notEqual(projector.snapshot(raw).players[0].hand[0].id,id);
  const other=new ForgeProjection(1,()=>['A','B']);
  assert.notEqual(other.snapshot({...raw,players:[{...p(0),battlefield:[c]},p(1)]}).players[0].battlefield[0].id,id);
});

test('semantic projection allowlists public fields instead of serializing engine objects',()=>{
  const projector=new ForgeProjection(0,()=>['A','B']);
  const event=projector.event({type:'semantic',sequence:7,kind:'zone',data:{from:'Library',to:'Hand',secret:'Counterspell',internalId:42}});
  assert.deepEqual(event,{sequence:7,kind:'zone',data:{from:'Library',to:'Hand'}});
});
