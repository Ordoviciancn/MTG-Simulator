import type { ClientRoomView, Card } from '../shared/types';
export type VisualChange = { kind: 'draw' | 'cast' | 'damage' | 'zone'; cardId?: string; playerId: string; from: string; to: string; amount?: number };
function visibleCards(room: ClientRoomView) {
  const cards = new Map<string, { card: Card; zone: string }>();
  for (const [zone, list] of Object.entries(room.publicZones)) for (const card of list) cards.set(card.id, { card, zone });
  const self = room.players.find(player => player.id === room.youId);
  for (const card of self?.hand ?? []) cards.set(card.id, { card, zone: 'hand' });
  return cards;
}
export function getVisualChanges(previous: ClientRoomView | null, next: ClientRoomView): VisualChange[] {
  if (!previous || previous.roomCode !== next.roomCode || previous.youId !== next.youId) return [];
  const before = visibleCards(previous), after = visibleCards(next), changes: VisualChange[] = [];
  for (const [id, entry] of after) {
    const old = before.get(id);
    if (!old && entry.zone === 'stack' && !entry.card.stackAbility) changes.push({ kind: 'cast', cardId: id, playerId: entry.card.ownerId, from: 'player', to: 'stack' });
    if (old && old.zone !== entry.zone) changes.push({ kind: entry.zone === 'stack' ? 'cast' : 'zone', cardId: id, playerId: entry.card.ownerId, from: old.zone, to: entry.zone });
  }
  for (const player of next.players) {
    const old = previous.players.find(p => p.id === player.id);
    if (!old) continue;
    if (old.life > player.life) changes.push({ kind: 'damage', playerId: player.id, from: 'player', to: 'player', amount: old.life - player.life });
    const count = Math.min(old.libraryCount - player.libraryCount, player.handCount - old.handCount, 7);
    if (count > 0 && player.id === next.youId) {
      const newHand = player.hand.filter(card => !before.has(card.id)).slice(0, count);
      for (const card of newHand) changes.push({kind:'draw',cardId:card.id,playerId:player.id,from:'library',to:'hand'});
    } else if (count > 0) {
      for (let i = 0; i < count; i++) changes.push({kind:'draw',playerId:player.id,from:'library',to:'player'});
    }
  }
  return changes.slice(0, 16);
}
