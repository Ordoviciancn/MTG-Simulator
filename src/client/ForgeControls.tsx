import { useState } from 'react';
import type { ForgeDecision, ForgePrompt } from '../shared/forgeTypes';

export function ForgeControls({prompt,fullControl,onControl,onDecision,english=false}:{prompt?:ForgePrompt;fullControl:boolean;onControl:(value:boolean)=>void;onDecision:(decision:ForgeDecision)=>void;english?:boolean}) {
  const text = (zh:string,en:string) => english ? en : zh;
  return <section className="forgeControls" aria-label={text('时点确认','Priority control')}>
    <label><input type="checkbox" checked={fullControl} onChange={event=>onControl(event.target.checked)}/>{text('完全操控','Full control')}</label>
    <span>{fullControl ? text('每个优先权窗口都等待确认','Confirm every priority window') : text('无可用动作时自动让过','Automatically pass when no actions are available')}</span>
    {!prompt && <strong>{text('等待规则引擎或对手','Waiting for engine or opponent')}</strong>}
    {prompt && <div>
      <p>{prompt.message}</p>
      {prompt.kind === 'input' && <div className="forgeDecisionButtons">
        <button disabled={!prompt.okEnabled} onClick={()=>onDecision({type:'ok',requestId:prompt.requestId})}>{prompt.okLabel || text('确认','Confirm')}</button>
        <button className="secondary" disabled={!prompt.cancelEnabled} onClick={()=>onDecision({type:'cancel',requestId:prompt.requestId})}>{prompt.cancelLabel || text('取消','Cancel')}</button>
      </div>}
      {prompt.kind === 'choice' && <ForgeChoice key={prompt.requestId} prompt={prompt} onDecision={onDecision} english={english}/>}
      {prompt.kind === 'unsupported' && <strong role="alert">{text('此决策尚未支持，游戏已暂停','This decision is not supported; the game is paused')}</strong>}
    </div>}
  </section>;
}

function ForgeChoice({prompt,onDecision,english}:{prompt:ForgePrompt;onDecision:(decision:ForgeDecision)=>void;english:boolean}) {
  const [selected,setSelected]=useState<number[]>([]);
  const min=prompt.min??1,max=prompt.max??1;
  return <div role="group" aria-label={prompt.message}>
    <div className="forgeChoices">{prompt.options?.map(option=><button key={option.value} aria-pressed={selected.includes(option.value)} onClick={()=>setSelected(values=>values.includes(option.value)?values.filter(value=>value!==option.value):max===1?[option.value]:values.length<max?[...values,option.value]:values)}>{option.label}</button>)}</div>
    <button disabled={selected.length<min || selected.length>max} onClick={()=>onDecision({type:'choice',requestId:prompt.requestId,value:max===1&&selected.length===1?selected[0]:selected})}>{english?'Confirm selection':'确认选择'} ({selected.length}/{max})</button>
  </div>;
}
