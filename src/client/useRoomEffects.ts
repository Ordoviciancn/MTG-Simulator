import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ClientRoomView } from '../shared/types';
import type { ArenaEffect } from './ArenaEffects';
import { getVisualChanges } from './roomEffects';
type Point = { x: number; y: number };
function centers(): Map<string, Point> {
  const result = new Map<string, Point>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-card-id], [data-zone], [data-player-id]')) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const key = element.dataset.cardId ? 'card:' + element.dataset.cardId : element.dataset.playerId ? 'player:' + element.dataset.playerId : 'zone:' + element.dataset.zone;
    if (!result.has(key)) result.set(key, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  }
  return result;
}
export function useRoomEffects(room: ClientRoomView | null): ArenaEffect[] {
  const previous = useRef<ClientRoomView | null>(null);
  const positions = useRef(new Map<string, Point>());
  const sequence = useRef(0);
  const timers = useRef(new Set<number>());
  const [effects, setEffects] = useState<ArenaEffect[]>([]);
  useEffect(() => () => { for (const timer of timers.current) window.clearTimeout(timer); timers.current.clear(); }, []);
  useLayoutEffect(() => {
    const changedRoom = !room || previous.current?.roomCode !== room.roomCode || previous.current?.youId !== room.youId;
    if (changedRoom) {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
      setEffects([]);
    }
    const current = centers();
    const changes = room ? getVisualChanges(previous.current, room) : [];
    const nextEffects: ArenaEffect[] = [];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) for (const change of changes) {
      const owner = current.get('player:' + change.playerId);
      const from = change.kind === 'draw' && room && change.playerId !== room.youId ? owner : positions.current.get('card:' + change.cardId) ?? positions.current.get('zone:' + change.from) ?? owner;
      const to = current.get('card:' + change.cardId) ?? current.get('zone:' + change.to) ?? owner;
      if (from && to) nextEffects.push({ id: String(++sequence.current), kind: change.kind, from, to, ...(change.amount ? {label:'−' + change.amount} : {}) });
    }
    previous.current = room;
    positions.current = current;
    if (!nextEffects.length) return;
    setEffects(active => [...active, ...nextEffects].slice(-48));
    const ids = new Set(nextEffects.map(effect => effect.id));
    const timeout = window.setTimeout(() => {
      setEffects(active => active.filter(effect => !ids.has(effect.id)));
      timers.current.delete(timeout);
    }, 1000);
    timers.current.add(timeout);
  }, [room]);
  return effects;
}
