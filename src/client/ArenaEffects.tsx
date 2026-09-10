import type { CSSProperties } from 'react';

export type ArenaEffect = {
  id: string;
  kind: 'draw' | 'cast' | 'damage' | 'zone';
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
  color?: string;
};

// Positions are viewport coordinates captured from the last authoritative room update.
export function ArenaEffects({ effects }: { effects: readonly ArenaEffect[] }) {
  return <div className="arenaEffects" aria-hidden="true">{effects.map(effect => {
    const style = {
      '--effect-x': `${effect.from.x}px`, '--effect-y': `${effect.from.y}px`,
      '--effect-dx': `${effect.to.x - effect.from.x}px`, '--effect-dy': `${effect.to.y - effect.from.y}px`,
      '--effect-color': effect.color ?? (effect.kind === 'damage' ? '#f17853' : effect.kind === 'zone' ? '#c5b1f0' : '#f5d78d'),
    } as CSSProperties;
    return <div key={effect.id} style={style} className={`arenaEffect effect-${effect.kind}`}>
      <i className="effectTraveler"/><i className="effectImpact"/>
      {effect.label && <span className="effectLabel">{effect.label}</span>}
    </div>;
  })}</div>;
}
