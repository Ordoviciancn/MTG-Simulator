import type { PlayerView } from '../shared/types';
import type { Translator } from './i18n';

export function ArenaHud({ player, active, opponent, t, onLifeChange }: { player?: PlayerView; active: boolean; opponent?: boolean; t: Translator; onLifeChange?: (delta: number) => void }) {
  return <div data-player-id={player?.id} className={`arenaHud ${opponent ? 'opponentHud' : 'yourHud'} ${active ? 'activeHud' : ''}`}>
    <div className="avatarSigil" aria-hidden="true"><svg viewBox="0 0 64 64"><path className="sigilCrown" d="M10 24 7 9l15 10L32 4l10 15L57 9l-3 15-22 8Z"/><path className="sigilFace" d="m19 25 13-9 13 9 5 17-18 17-18-17Z"/><path className="sigilEtching" d="m20 32 8 3m16-3-8 3m-4-11-4 20h8m-11 4 7 5 7-5"/></svg></div>
    <div className="duelistIdentity"><span>{opponent ? t('opponent') : t('you')}</span><strong>{player?.name ?? t('waitingOpponent')}</strong></div>
    {onLifeChange && <button className="lifeAdjust secondary" aria-label={t('decreaseLife')} onClick={() => onLifeChange(-1)}>−</button>}
    <div className="lifeOrb" aria-live="polite" aria-label={`${t('life')} ${player?.life ?? '—'}`}><span key={player?.life}>{player?.life ?? '—'}</span></div>
    {onLifeChange && <button className="lifeAdjust secondary" aria-label={t('increaseLife')} onClick={() => onLifeChange(1)}>+</button>}
    <div className="zoneCount"><span>{t('library')}</span><strong>{player?.libraryCount ?? 0}</strong></div>
    <div className="zoneCount"><span>{t('hand')}</span><strong>{player?.handCount ?? 0}</strong></div>
    {active && <span className="activeTurnPill">{t('activeTurn')}</span>}
  </div>;
}
