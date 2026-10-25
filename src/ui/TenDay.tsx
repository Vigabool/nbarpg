import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeasonData } from '../data/types';
import { currentWeek, type SaveGame } from '../app/game';
import { signTenDay, tenDayBlocked, tenDayCandidates, tenDayFee } from '../app/gold';
import { gearDamage, seasonTier } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { teamName } from '../data/teams';
import { CLASSES, rules, tierIndex, type HeroClass } from '../rules';
import { CLASS_ICON, TierChip, gamesCount } from './common';

/**
 * Ten-day contracts: rent a free agent for this week only, so a hero whose player has no
 * game doesn't sit out. Opened for a hero, signing also puts the player on that hero.
 */
export function TenDayPicker({
  data,
  game,
  heroClass,
  onChange,
  onClose,
}: {
  data: SeasonData;
  game: SaveGame;
  heroClass?: HeroClass;
  onChange: (g: SaveGame) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState<HeroClass>(heroClass ?? 'warrior');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const week = currentWeek(game, data);
  const blocked = tenDayBlocked(game);
  const list = useMemo(
    () =>
      tenDayCandidates(game, data)
        .map((id) => ({ id, p: data.players[id], fee: tenDayFee(data, id), tier: seasonTier(c, data.players[id].avg) }))
        .sort((a, b) => tierIndex(b.tier) - tierIndex(a.tier) || a.fee - b.fee || a.p.name.localeCompare(b.p.name))
        .slice(0, 40),
    [game, data, c],
  );
  const sign = (id: number) => {
    let g = signTenDay(game, data, id);
    if (heroClass) {
      const assignments = { ...g.assignments, [heroClass]: id };
      const gamePicks = { ...g.gamePicks };
      delete gamePicks[heroClass];
      g = { ...g, assignments, gamePicks };
    }
    onChange(g);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tenday-title" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="tenday-title">📝 Ten-day contract{heroClass && ` · ${rules.classes[heroClass].name}`}</h2>
          <button ref={closeRef} className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small">
          Sign a free agent for this week only: no cap space or roster move, just the fee. You have 💰 {game.gold} gold.
          {blocked && ` ${blocked}.`}
        </p>
        {!heroClass && (
          <div className="class-picker" role="tablist" aria-label="Rank for">
            {CLASSES.map((k) => (
              <button key={k} role="tab" aria-selected={k === c} className={`class-pick${k === c ? ' active' : ''}`} onClick={() => setC(k)}>
                <span className="class-pick-icon" aria-hidden>
                  {CLASS_ICON[k]}
                </span>
                <span>{rules.classes[k].name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="modal-body stack" style={{ gap: 6 }}>
          {list.length === 0 && <p className="muted small">No free agents play this week.</p>}
          {list.map(({ id, p, fee, tier }) => (
            <div key={id} className="spread card flat" style={{ padding: '8px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div className="slot-name">{p.name}</div>
                <div className="row tiny muted" style={{ gap: 6 }}>
                  <TierChip tier={tier} />
                  <span>Gear {gearDamage(c, p.avg)}</span>
                  <span>{teamName(p.team)}</span>
                  <span>{gamesCount(week ? playerGamesInWeek(data, week, id).length : 0)}</span>
                </div>
              </div>
              <button
                className="btn small primary"
                disabled={!!blocked || game.gold < fee}
                onClick={() => sign(id)}
                title={game.gold < fee ? `Needs ${fee} gold` : undefined}
              >
                Sign · {fee} gold
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
