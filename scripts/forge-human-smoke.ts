import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareForgeLaunch } from '../src/server/forgeRuntime';
import { ForgeProcess } from '../src/server/forgeProcess';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.JAVA_HOME) throw new Error('JAVA_HOME must point to JDK 17.');
const runtime=await prepareForgeLaunch(root,process.env.JAVA_HOME);
const views=new Set<number>();
let finish!:()=>void, fail!:(error:Error)=>void;
const completed=new Promise<void>((resolve,reject)=>{finish=resolve;fail=reject;});
completed.catch(()=>undefined);
let inputReceived=false;
const timer=setTimeout(()=>fail(new Error('Human Match did not reach a choice within 120 seconds.')),120000);
const bridge=new ForgeProcess(runtime.launch,message=>{
  if(message.type==='error') fail(new Error(String(message.message)));
  if(message.type==='state' && (message.seat===0 || message.seat===1)) views.add(message.seat);
  if(message.type==='prompt' && (message.kind==='input' || message.kind==='choice')) inputReceived=true;
  if(inputReceived && views.size===2) finish();
},fail);
try {
  await bridge.ready;
  bridge.send({type:'init',players:[{name:'Human A',deck:[{name:'Mountain',count:60}]},{name:'Human B',deck:[{name:'Island',count:60}]}]});
  await completed;
  assert.equal(views.size,2);
  console.log(JSON.stringify({engine:'forge',humanInputReached:true,seatViews:2,fullGameVerified:false}));
} finally {
  clearTimeout(timer);
  await bridge.stop();
  await runtime.cleanup();
}
