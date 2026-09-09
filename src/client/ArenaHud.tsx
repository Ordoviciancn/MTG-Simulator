import type { PlayerView } from '../shared/types';
import type { Translator } from './i18n';

export function ArenaHud({ player, active, opponent, t }: { player?: PlayerView; active: boolean; opponent?: boolean; t: Translator }) {
  return <div className={`arenaHud ${opponent ? 'opponentHud' : 'yourHud'} ${active ? 'activeHud' : ''}`}>
    <div className="avatarSigil" aria-hidden="true">{opponent ? '◇' : '✦'}</div>
    <div className="duelistIdentity"><span>{opponent ? t('opponent') : t('you')}</span><strong>{player?.name ?? t('waitingOpponent')}</strong></div>
    <div className="lifeOrb" aria-label={`${t('life')} ${player?.life ?? 20}`}>{player?.life ?? '—'}</div>
    <div className="zoneCount"><span>{t('library')}</span><strong>{player?.libraryCount ?? 0}</strong></div>
    <div className="zoneCount"><span>{t('hand')}</span><strong>{player?.handCount ?? 0}</strong></div>
    {active && <span className="activeTurnPill">{t('activeTurn')}</span>}
  </div>;
}
