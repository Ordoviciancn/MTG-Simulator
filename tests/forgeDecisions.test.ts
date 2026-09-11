import test from 'node:test';
import assert from 'node:assert/strict';
import { validateForgeDecision } from '../src/server/forgeDecisions';
import type { ForgePrompt } from '../src/shared/forgeTypes';

const prompt: ForgePrompt = {seat:0,requestId:'r1',kind:'input',message:'Priority',okEnabled:true,cancelEnabled:false};
test('only current engine prompts accept enabled priority decisions',()=>{
  assert.equal(validateForgeDecision(prompt,{type:'ok',requestId:'r1'}),true);
  assert.equal(validateForgeDecision(prompt,{type:'ok',requestId:'old'}),false);
  assert.equal(validateForgeDecision(prompt,{type:'cancel',requestId:'r1'}),false);
  assert.equal(validateForgeDecision(undefined,{type:'ok',requestId:'r1'}),false);
  assert.equal(validateForgeDecision({...prompt,kind:'unsupported'},{type:'ok',requestId:'r1'}),false);
});
test('mandatory choices cannot be bypassed by priority confirmation',()=>{
  const choice: ForgePrompt={...prompt,kind:'choice',options:[{value:0,label:'A'},{value:1,label:'B'}],min:1,max:2};
  assert.equal(validateForgeDecision(choice,{type:'ok',requestId:'r1'}),false);
  assert.equal(validateForgeDecision(choice,{type:'choice',requestId:'r1',value:[]}),false);
  assert.equal(validateForgeDecision(choice,{type:'choice',requestId:'r1',value:[0,0]}),false);
  assert.equal(validateForgeDecision(choice,{type:'choice',requestId:'r1',value:[2]}),false);
  assert.equal(validateForgeDecision(choice,{type:'choice',requestId:'r1',value:[0,1]}),true);
});
