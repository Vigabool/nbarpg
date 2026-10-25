import { useEffect, useRef, useState } from 'react';
import { useScrollToTop } from './scroll';
import { buy, priceOf, type Purchase } from '../app/armory';
import { progressOf, type SaveGame } from '../app/game';
import { CLASSES, rules, type HeroClass } from '../rules';
import { CLASS_ICON, ConfirmButton } from './common';

/** Spend each hero's progression points: weapon and shield levels, gear, feats. */
export function Armory({ game, onChange, onClose, initial }: { game: SaveGame; onChange: (g: SaveGame) => void; onClose: () => void; initial?: HeroClass }) {
  const [c, setC] = useState<HeroClass>(initial ?? 'warrior');
  const bodyRef = useScrollToTop<HTMLDivElement>(c);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = rules.progression;
  const prog = progressOf(game, c);
  const pp = game.pp[c];
  const purchase = (x: Purchase) => onChange(buy(game, c, x));
  const gear = Object.entries(p.gear).filter(([, g]) => g.heroClass === c);
  const feats = Object.entries(p.feats).filter(([, f]) => f.heroClass === c);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="armory-title" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="armory-title">🛠️ Armory</h2>
          <button ref={closeRef} className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="class-picker" role="tablist" aria-label="Heroes">
          {CLASSES.map((k) => (
            <button key={k} role="tab" aria-selected={k === c} className={`class-pick${k === c ? ' active' : ''}`} onClick={() => setC(k)}>
              <span className="class-pick-icon" aria-hidden>
                {CLASS_ICON[k]}
              </span>
              <span>{rules.classes[k].name}</span>
              <span className="tiny num pp-chip">{game.pp[k]} PP</span>
            </button>
          ))}
        </div>

        <div ref={bodyRef} className="modal-body class-panel stack" style={{ gap: 10 }}>
          <div className="spread">
            <strong>
              {CLASS_ICON[c]} {rules.classes[c].name}
            </strong>
            <span className="num pp-balance">{pp} PP to spend</span>
          </div>

          <span className="section-label">Upgrades</span>
          <Item
            icon="⚔️"
            name={`Weapon · level ${prog.weapon}/${p.weapon.costs.length}`}
            text={`+${p.weapon.damagePerLevel} damage to weapon attacks per level${prog.weapon ? ` (now +${prog.weapon * p.weapon.damagePerLevel})` : ''}.`}
            price={priceOf(game, c, { kind: 'weapon' })}
            pp={pp}
            done={prog.weapon >= p.weapon.costs.length ? 'Maxed' : undefined}
            onBuy={() => purchase({ kind: 'weapon' })}
          />
          {c === 'warrior' && (
            <Item
              icon="⛨"
              name={`Shield · level ${prog.shield}/${p.shield.costs.length}`}
              text={`+${p.shield.armorPerLevel} armor every round per level${prog.shield ? ` (now +${prog.shield * p.shield.armorPerLevel})` : ''}.`}
              price={priceOf(game, c, { kind: 'shield' })}
              pp={pp}
              done={prog.shield >= p.shield.costs.length ? 'Maxed' : undefined}
              onBuy={() => purchase({ kind: 'shield' })}
            />
          )}

          <span className="section-label">Gear</span>
          {gear.map(([id, g]) => (
            <Item
              key={id}
              icon={g.icon}
              name={g.name}
              text={`${g.description}.`}
              price={priceOf(game, c, { kind: 'gear', id })}
              pp={pp}
              done={prog.gear.includes(id) ? 'Owned' : undefined}
              onBuy={() => purchase({ kind: 'gear', id })}
            />
          ))}

          <span className="section-label">Feats</span>
          {feats.map(([id, f]) => (
            <Item
              key={id}
              icon={f.icon}
              name={f.name}
              text={`${f.description}.`}
              price={priceOf(game, c, { kind: 'feat', id })}
              pp={pp}
              done={prog.feats.includes(id) ? 'Learned' : undefined}
              onBuy={() => purchase({ kind: 'feat', id })}
            />
          ))}
          <p className="tiny muted" style={{ margin: 0 }}>
            Purchases are permanent and belong to the hero, whichever player powers them.
          </p>
        </div>
      </div>
    </div>
  );
}

function Item({
  icon,
  name,
  text,
  price,
  pp,
  done,
  onBuy,
}: {
  icon: string;
  name: string;
  text: string;
  price: number | null;
  pp: number;
  done?: string;
  onBuy: () => void;
}) {
  return (
    <div className={`armory-item${done ? ' owned' : ''}`}>
      <span className="armory-icon" aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <strong className="small">{name}</strong>
        <p className="tiny muted" style={{ margin: 0 }}>
          {text}
        </p>
      </div>
      {done ? (
        <span className="tag static good">✓ {done}</span>
      ) : price !== null ? (
        <ConfirmButton className="btn small" disabled={pp < price} confirmLabel={`Spend ${price}?`} onConfirm={onBuy}>
          {pp < price ? `${price} PP` : `Buy · ${price}`}
        </ConfirmButton>
      ) : null}
    </div>
  );
}
