import { useEffect, useRef, useState } from 'react';
import { energyGain, isAttack } from '../engine/combat';
import { CLASSES, rules, type ChampionKind, type HeroClass } from '../rules';
import { CLASS_ICON, MONSTER_ICON, money } from './common';

const SEEN_KEY = 'nbarpg.tutorialSeen';

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

const PLAYSTYLE: Record<HeroClass, { draft: string; play: string }> = {
  warrior: { draft: 'Rebounders and shot blockers', play: 'Taunts enemies onto itself and soaks hits behind a permanent shield.' },
  ranger: { draft: 'Scorers', play: 'Steady damage, armor-piercing shots, and summoned wolves and bears that fight and absorb hits.' },
  cleric: { draft: 'Playmakers (turnovers hurt twice)', play: 'Heals, revives fallen heroes, empowers allies and weakens dangerous enemies.' },
  rogue: { draft: 'Pesky defenders who draw fouls', play: 'Poison, crits, and double-damage Backstabs on enemies taunted by someone else.' },
  wizard: { draft: 'Volume three-point shooters', play: 'Burst damage: area spells for crowds, big bolts for Champions.' },
};

const CHAMPIONS: ChampionKind[] = ['warlock', 'hunter', 'ogre', 'assassin', 'shaman'];
type Tab = 'basics' | 'classes' | 'enemies';

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('basics');
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    markSeen();
    onClose();
  };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const s = rules.salary;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="tutorial-title">How to play</h2>
          <button ref={closeRef} className="btn ghost small" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="tabs" role="tablist">
          {(['basics', 'classes', 'enemies'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'basics' ? 'Basics' : t === 'classes' ? 'Classes' : 'Enemies'}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'basics' && (
            <ol className="steps">
              <li>
                <strong>Build a roster.</strong> Sign {s.rosterSize} NBA players under the {money(s.cap)} cap: one for each of your five heroes,
                plus three reserves. Salary follows how good a player is, and players who fit several classes cost more.
              </li>
              <li>
                <strong>Each week, pick a game.</strong> For each hero, choose one of their player's real games that week. That box score
                sets the hero's starting <em>energy</em>, which they spend on abilities. Each class draws energy from different stats. A big
                night means a big start.
              </li>
              <li>
                <strong>Watch who you bring.</strong> Every game you pick also sends the opposing player who mirrors your hero into the horde.
                The best opposing performance of the week becomes the <em>Warlord</em>, the final boss.
              </li>
              <li>
                <strong>Fight.</strong> Three waves, {rules.combat.roundCap} rounds. Each round your heroes act in any order, then summons,
                then the horde. Every hero gets <em>one attack</em> a round plus any number of <em>utility</em> powers (taunts, heals,
                armor, buffs, summons) they have energy for. Attacks come in three kinds: a <em>basic</em> weapon attack that gains 2
                energy, an <em>advanced</em> weapon attack that costs 1–2, and damage spells that cost more. There are no dice: each enemy
                shows what it will do.
              </li>
              <li>
                <strong>Highlights.</strong> A double-double unlocks the hero's Signature ability; a triple-double also unlocks their
                Legendary. Each is free and usable once.
              </li>
              <li>
                <strong>Win</strong> by clearing every wave before round {rules.combat.roundCap}. Victories and survivors earn progression
                points (PP) for your heroes.
              </li>
            </ol>
          )}

          {tab === 'classes' && (
            <div className="stack" style={{ gap: 10 }}>
              {CLASSES.map((c) => {
                const cls = rules.classes[c];
                const mods = cls.modifiers.map((m) => (m.type === 'percentage' ? `${m.label} bonus/penalty` : 'every turnover costs energy'));
                return (
                  <section key={c} className="class-blurb">
                    <div className="spread">
                      <h3>
                        {CLASS_ICON[c]} {cls.name} <span className="muted small">· {cls.role}</span>
                      </h3>
                      <span className="tiny muted">{cls.hp} HP</span>
                    </div>
                    <p className="small">{PLAYSTYLE[c].play}</p>
                    <p className="tiny muted">
                      Energy from <strong>{cls.ratingLabel}</strong>
                      {mods.length ? ` (${mods.join(', ')})` : ''}. Draft: {PLAYSTYLE[c].draft}.
                    </p>
                    <div className="row">
                      {[...cls.gear, ...cls.abilities].map((a) => {
                        const gain = energyGain(a);
                        return (
                          <span key={a.id} className={`chip${a.unlock ? ' status-taunt' : ''}`} title={a.description}>
                            {isAttack(a) ? '⚔ ' : ''}
                            {a.name}{' '}
                            {a.unlock ? (a.unlock === 'signature' ? '· DD' : '· TD') : gain ? `· +${gain}` : `· ${a.cost}`}
                          </span>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <p className="tiny muted">⚔ marks attacks (one per round); the rest are utilities. Numbers are energy costs; +2 means the attack gains energy. DD and TD abilities need a double- or triple-double.</p>
            </div>
          )}

          {tab === 'enemies' && (
            <div className="stack" style={{ gap: 10 }}>
              <p className="small muted">
                Goblins fill out every wave. Each hero's game brings one mirrored Champion, scaled by how that opposing player actually
                played.
              </p>
              <div className="enemy-blurb">
                <span>{MONSTER_ICON.goblin}</span>
                <div>
                  <strong>Goblin</strong> <span className="tiny muted">· from opposing team points</span>
                  <div className="small">{rules.monsters.goblin.description}.</div>
                </div>
              </div>
              {CHAMPIONS.map((k) => {
                const m = rules.monsters[k];
                return (
                  <div key={k} className="enemy-blurb">
                    <span>{MONSTER_ICON[k]}</span>
                    <div>
                      <strong>{m.name}</strong>{' '}
                      <span className="tiny muted">
                        · mirrors your {rules.classes[m.mirrors!].name} · {m.hpByTier![0]}–{m.hpByTier!.at(-1)} HP
                      </span>
                      <div className="small">{m.description}.</div>
                    </div>
                  </div>
                );
              })}
              <p className="small">
                <strong>Warlord:</strong> the week's best opposing line. Double HP, +{rules.horde.warlord.damageBonus} damage and two actions a
                round. Opposing turnovers stagger Champions (one lost action per {rules.horde.turnoversPerStagger}).
              </p>
            </div>
          )}
        </div>

        <div className="spread">
          <span className="tiny faint">Reopen anytime from "How to play".</span>
          {tab !== 'enemies' ? (
            <button className="btn primary small" onClick={() => setTab(tab === 'basics' ? 'classes' : 'enemies')}>
              Next →
            </button>
          ) : (
            <button className="btn primary small" onClick={close}>
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
