import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../src/shared/types';

test('manual tabletop permits multiple lands and unpaid spells while preserving hidden cards', { timeout: 20000 }, async t => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], { env: { ...process.env, PORT: '18787' }, stdio: ['ignore','pipe','pipe'] });
  t.after(() => child.kill());
  await Promise.race([once(child.stdout!, 'data'), once(child, 'exit').then(() => { throw new Error('Test server stopped'); })]);
  async function client() {
    const ws = new WebSocket('ws://127.0.0.1:18787'); t.after(() => ws.terminate());
    await once(ws,'open');
    const queue: ServerMessage[] = []; const waiting: ((m: ServerMessage) => void)[] = [];
    ws.on('message', raw => { const m=JSON.parse(raw.toString()); const resolve=waiting.shift(); if(resolve) resolve(m); else queue.push(m); });
    return { ws, next: () => queue.length ? Promise.resolve(queue.shift()!) : new Promise<ServerMessage>(resolve => waiting.push(resolve)), send: (m: ClientMessage) => ws.send(JSON.stringify(m)) };
  }
  const a=await client(), b=await client();
  a.send({type:'createRoom',playerId:'test-a',playerName:'Alpha',deckText:'8 Mountain\n4 Lightning Bolt'});
  const created=await a.next(); assert.equal(created.type,'room'); if(created.type!=='room') return;
  b.send({type:'joinRoom',roomCode:created.room.roomCode,playerId:'test-b',playerName:'Beta',deckText:'12 Island'});
  await a.next(); await b.next();
  a.send({type:'draw',count:12}); const draw=await a.next(); const hidden=await b.next();
  assert.equal(draw.type,'room'); assert.equal(hidden.type,'room'); if(draw.type!=='room'||hidden.type!=='room') return;
  assert.deepEqual(hidden.room.players.find(p=>p.id==='test-a')?.hand,[]);
  assert.deepEqual(hidden.room.players.find(p=>p.id==='test-a')?.library,[]);
  const ownHand=draw.room.players.find(p=>p.id==='test-a')!.hand;
  const land=ownHand.find(c=>c.name==='Mountain')!, bolt=ownHand.find(c=>c.name==='Lightning Bolt')!;
  const secondLand=ownHand.filter(c=>c.name==='Mountain')[1];
  for (const card of [land,secondLand]) {
    a.send({type:'moveCard',cardId:card.id,toZone:'battlefield',kind:'land'});
    const state=await a.next(); await b.next(); assert.equal(state.type,'room');
  }
  a.send({type:'moveCard',cardId:bolt.id,toZone:'stack'}); await a.next(); const cast=await b.next();
  assert.equal(cast.type,'room'); if(cast.type!=='room') return;
  assert.equal(cast.room.publicZones.battlefield.length,2);
  assert.ok(cast.room.publicZones.battlefield.every(c=>!c.tapped));
  assert.equal(cast.room.publicZones.stack[0].id,bolt.id);
  assert.ok(!('rules' in cast.room));
  a.send({type:'moveCard',cardId:bolt.id,toZone:'graveyard'}); const result=await a.next(); await b.next();
  assert.equal(result.type,'room'); if(result.type!=='room') return;
  assert.equal(result.room.players.find(p=>p.id==='test-b')!.life,20);
  assert.equal(result.room.publicZones.stack.length,0);
  assert.equal(result.room.publicZones.graveyard[0].id,bolt.id);
  a.send({type:'moveCard',cardId:bolt.id,toZone:'exile'}); const exiled=await a.next(); await b.next();
  assert.equal(exiled.type,'room'); if(exiled.type==='room') {
    assert.equal(exiled.room.publicZones.exile[0].id,bolt.id);
    assert.equal(exiled.room.publicZones.graveyard.length,0);
  }
  a.send({type:'setLife',life:19}); const life=await a.next(); await b.next();
  assert.equal(life.type,'room'); if(life.type==='room') assert.equal(life.room.players.find(p=>p.id==='test-a')!.life,19);
});
