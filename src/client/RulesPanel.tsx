import { useEffect, useState } from 'react';
import type { ClientMessage, ClientRoomView } from '../shared/types';
import type { Translator } from './i18n';

export function RulesPanel({ room, selectedCardId, send, t }: { room: ClientRoomView; selectedCardId: string | null; send: (message: ClientMessage) => void; t: Translator }) {
  const [cardId, setCardId] = useState('');
  const [targetId, setTargetId] = useState('');
  const hand = room.players.find(p => p.id === room.youId)?.hand ?? [];
  const rules = room.rules;
  useEffect(() => {
    if (hand.some(card => card.id === selectedCardId)) { setCardId(selectedCardId!); setTargetId(''); }
  }, [selectedCardId]);
  const card = hand.find(c => c.id === cardId);
  const definition = rules?.supportedCards.find(c => c.name.toLowerCase() === card?.name.trim().toLowerCase());
  const assisted = rules?.mode === 'assisted';
  const ownTurn = room.turn.activePlayerId === room.youId;
  const targets = definition?.target === 'player' ? room.players : definition?.target === 'stack' ? room.publicZones.stack : [];
  const target = targets.find(item => item.id === targetId);
  if (!rules) return null;
  return <section className="rulesPanel">
    <h2>{t('rulesTitle')}</h2>
    <label><span>{t('rulesTitle')}</span><select value={rules.mode} onChange={event => send({ type: 'rulesAction', action: 'setMode', mode: event.target.value as 'manual' | 'assisted' })}>
      <option value="manual">{t('rulesManual')}</option><option value="assisted">{t('rulesAssisted')}</option>
    </select></label>
    <p className="ruleStatus">{assisted ? `${t('rulesTurn')} ${rules.turnNumber} · ${t('rulesLandUsed')}: ${rules.landsPlayed[room.youId] ?? 0}` : t('rulesScope')}</p>
    {assisted && <>
      <label>{t('rulesChooseCard')}<select value={card ? cardId : ''} onChange={event => { setCardId(event.target.value); setTargetId(''); }}><option value="">{t('rulesSelectPrompt')}</option>{hand.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {definition && <p className="hint">{definition.cost || '—'} · {definition.description}</p>}
      {definition?.target && <label>{t('rulesChooseTarget')}<select value={target?.id ?? ''} onChange={event => setTargetId(event.target.value)}><option value="">{t('rulesSelectPrompt')}</option>{targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="ruleButtons">
        {definition?.kind === 'land' ? <button disabled={!ownTurn || (rules.landsPlayed[room.youId] ?? 0) >= 1 || !!room.publicZones.stack.length} onClick={() => send({ type: 'rulesAction', action: 'playLand', cardId })}>{t('rulesPlayLand')}</button> : <button disabled={!definition || (!!definition.target && !target) || (definition.kind !== 'instant' && (!ownTurn || !!room.publicZones.stack.length))} onClick={() => send({ type: 'rulesAction', action: 'cast', cardId, ...(definition?.target && target ? { target: { kind: definition.target, id: target.id } } : {}) })}>{t('rulesCast')}</button>}
        <button className="secondary" disabled={!room.publicZones.stack.length} onClick={() => send({ type: 'rulesAction', action: 'resolveTop' })}>{t('rulesResolve')} ({room.publicZones.stack.length})</button>
        <button className="secondary" disabled={!ownTurn || !!room.publicZones.stack.length} onClick={() => send({ type: 'rulesAction', action: 'endTurn' })}>{t('rulesEndTurn')}</button>
      </div>
    </>}
    <details><summary>{t('rulesSupport')}</summary><p>{t('rulesLimit')}</p><strong>{t('rulesSupportedCards')}</strong><p>{rules.supportedCards.map(c => c.name).join(' · ')}</p></details>
  </section>;
}
