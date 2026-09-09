import type { PlayerView } from '../shared/types';
import type { Translator } from './i18n';

export function ArenaHud({ player, active, opponent, t, onLifeChange }: { player?: PlayerView; active: boolean; opponent?: boolean; t: Translator; onLifeChange?: (delta: number) => void }) {
  return <div className={`arenaHud ${opponent ? 'opponentHud' : 'yourHud'} ${active ? 'activeHud' : ''}`}>
    <div className="avatarSigil" aria-hidden="true">{opponent ? '◇' : '✦'}</div>
    <div className="duelistIdentity"><span>{opponent ? t('opponent') : t('you')}</span><strong>{player?.name ?? t('waitingOpponent')}</strong></div>
    {onLifeChange && <button className="lifeAdjust secondary" aria-label={t('decreaseLife')} onClick={() => onLifeChange(-1)}>−</button>}
    <div className="lifeOrb" aria-label={`${t('life')} ${player?.life ?? '—'}`}>{player?.life ?? '—'}</div>
    {onLifeChange && <button className="lifeAdjust secondary" aria-label={t('increaseLife')} onClick={() => onLifeChange(1)}>+</button>}
    <div className="zoneCount"><span>{t('library')}</span><strong>{player?.libraryCount ?? 0}</strong></div>
    <div className="zoneCount"><span>{t('hand')}</span><strong>{player?.handCount ?? 0}</strong></div>
    {active && <span className="activeTurnPill">{t('activeTurn')}</span>}
  </div>;
}
