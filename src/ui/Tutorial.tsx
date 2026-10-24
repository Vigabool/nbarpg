import { useEffect, useRef, useState } from 'react';
import { energyGain, isAttack } from '../engine/combat';
import type { ActionDef } from '../rules';
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
                <strong>Fight.</strong> Three waves, {rules.combat.roundCap} rounds. Waves arrive on a clock (rounds {rules.combat.waveArrivalRounds.join(' and ')}) or as
                soon as you clear the field, so they can overlap. Each round your heroes act in any order, then summons, then the horde. Every hero gets <em>one attack</em> a round plus any number of <em>utility</em> powers (taunts, heals,
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

          {tab === 'classes' && <ClassesTab />}

          {tab === 'enemies' && (
            <div className="stack" style={{ gap: 10 }}>
              <p className="small muted">
                Goblins fill out every wave. Each hero's game brings one mirrored Champion, scaled by how that opposing player actually
                played. Every {rules.combat.specialEveryNRounds === 2 ? 'other' : `${rules.combat.specialEveryNRounds}th`} round on the field
                each Champion uses its special, flagged ⚠ on its card the round before.
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
                round. Below half HP it becomes enraged: +{rules.combat.warlordEnrage.damageBonus} damage. Opposing turnovers stagger Champions (one lost action per {rules.horde.turnoversPerStagger}).
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

// ---------- Classes tab ----------

function costLabel(a: ActionDef): { text: string; tone: 'gain' | 'cost' | 'sig' } {
  const gain = energyGain(a);
  if (a.unlock) return { text: a.unlock === 'signature' ? 'DD' : 'TD', tone: 'sig' };
  if (gain) return { text: `+${gain}`, tone: 'gain' };
  return { text: String(a.cost ?? 0), tone: 'cost' };
}

const TARGET_TEXT: Record<ActionDef['target']['type'], string> = {
  enemy: '1 enemy',
  enemies: 'chosen enemies',
  allEnemies: 'every enemy',
  ally: '1 ally',
  allAllies: 'every ally',
  self: 'self',
  fallenAlly: '1 fallen ally',
  allFallen: 'every fallen ally',
  none: 'the battlefield',
};

function targetText(a: ActionDef): string {
  const t = a.target;
  if (t.type === 'enemies') return `up to ${t.count} enemies`;
  if (t.type === 'enemy' && t.attackedSelfLastRound) return '1 enemy that attacked you last round';
  if (t.type === 'enemy' && t.nonBoss) return '1 non-Warlord enemy';
  return TARGET_TEXT[t.type];
}

function damageText(a: ActionDef): string | null {
  for (const e of a.effects) {
    if (e.type === 'damage') {
      const base = e.amount === 'gear' ? `gear damage${e.bonus ? ` + ${e.bonus}` : ''}` : `${e.amount + (e.bonus ?? 0)}`;
      return `${base}${e.pierce ? ', ignores armor' : ''}`;
    }
    if (e.type === 'gearAttack') return `${e.times} gear attacks`;
  }
  return null;
}

function AbilityDetail({ a, kind }: { a: ActionDef; kind: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      // older browsers without options support
    }
  }, [a.id]);
  const gain = energyGain(a);
  const attack = isAttack(a);
  const dmg = damageText(a);
  const cost = a.unlock
    ? `Free, once per battle. Needs a ${a.unlock === 'signature' ? 'double-double' : 'triple-double'}.`
    : gain
      ? `Free. Gains ${gain} energy.`
      : `Costs ${a.cost} energy.`;
  return (
    <div className="ability-detail" ref={ref} role="region" aria-label={`${a.name} details`}>
      <div className="spread">
        <strong>{a.name}</strong>
        <span className="row" style={{ gap: 4 }}>
          <span className={`chip ${attack ? 'kind-attack' : 'kind-utility'}`}>{attack ? '⚔ Attack' : 'Utility'}</span>
          <span className="chip">{kind}</span>
        </span>
      </div>
      <p className="small">{a.description.replace(/\bG\b/g, 'gear damage')}.</p>
      <dl className="detail-grid small">
        <dt>Energy</dt>
        <dd>{cost}</dd>
        {dmg && (
          <>
            <dt>Damage</dt>
            <dd>{dmg}</dd>
          </>
        )}
        <dt>Targets</dt>
        <dd>{targetText(a)}</dd>
        <dt>Use</dt>
        <dd>{attack ? 'Your one attack this round.' : 'Any number per round while energy lasts.'}</dd>
      </dl>
    </div>
  );
}

function ClassesTab() {
  const [c, setC] = useState<HeroClass>('warrior');
  const [open, setOpen] = useState<string | null>(null);
  const cls = rules.classes[c];
  const mods = cls.modifiers.map((m) => (m.type === 'percentage' ? `${m.label} bonus/penalty` : 'every turnover costs energy'));
  const groups: { label: string; items: { a: ActionDef; kind: string }[] }[] = [
    { label: 'Weapons', items: cls.gear.map((a) => ({ a, kind: a.cost === undefined ? 'Basic weapon' : 'Advanced weapon' })) },
    { label: 'Abilities', items: cls.abilities.filter((a) => !a.unlock).map((a) => ({ a, kind: 'Ability' })) },
    {
      label: 'Signature & Legendary',
      items: cls.abilities.filter((a) => a.unlock).map((a) => ({ a, kind: a.unlock === 'signature' ? 'Signature' : 'Legendary' })),
    },
  ];
  const openItem = groups.flatMap((g) => g.items).find((x) => x.a.id === open);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="class-picker" role="tablist" aria-label="Classes">
        {CLASSES.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === c}
            className={`class-pick${k === c ? ' active' : ''}`}
            onClick={() => {
              setC(k);
              setOpen(null);
            }}
          >
            <span className="class-pick-icon" aria-hidden>
              {CLASS_ICON[k]}
            </span>
            <span>{rules.classes[k].name}</span>
          </button>
        ))}
      </div>

      <section className="class-panel">
        <div className="class-head">
          <span className="class-big-icon" aria-hidden>
            {CLASS_ICON[c]}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 className="class-title">{cls.name}</h3>
            <div className="muted small">{cls.role}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">❤ {cls.hp} HP</span>
          <span className="chip">⚡ Energy from {cls.ratingLabel}</span>
          {mods.map((m) => (
            <span key={m} className="chip">
              {m}
            </span>
          ))}
        </div>
        <p className="small" style={{ margin: 0 }}>
          {PLAYSTYLE[c].play}
        </p>
        <p className="tiny muted" style={{ margin: 0 }}>
          Draft: {PLAYSTYLE[c].draft}.
          {cls.passives.map((p) => ` Passive: ${p.name}, ${p.description}.`).join('')}
        </p>

        {groups.map((g) => (
          <div key={g.label} className="ability-group">
            <div className="group-label">{g.label}</div>
            <div className="row" style={{ gap: 6 }}>
              {g.items.map(({ a }) => {
                const cost = costLabel(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`ability-chip${isAttack(a) ? ' attack' : ''}${a.unlock ? ' sig' : ''}${open === a.id ? ' open' : ''}`}
                    aria-expanded={open === a.id}
                    onClick={() => setOpen(open === a.id ? null : a.id)}
                  >
                    {isAttack(a) && <span className="atk" aria-label="Attack">⚔</span>}
                    <span>{a.name}</span>
                    <span className={`cost-badge ${cost.tone}`}>{cost.text}</span>
                  </button>
                );
              })}
            </div>
            {openItem && g.items.some((x) => x.a.id === openItem.a.id) && <AbilityDetail a={openItem.a} kind={openItem.kind} />}
          </div>
        ))}
      </section>

      <div className="legend tiny muted">
        <span>
          <span className="atk">⚔</span> attack, one per round
        </span>
        <span>
          <span className="cost-badge gain">+2</span> gains energy
        </span>
        <span>
          <span className="cost-badge cost">4</span> energy cost
        </span>
        <span>
          <span className="cost-badge sig">DD</span>/<span className="cost-badge sig">TD</span> needs a double-/triple-double
        </span>
        <span>Tap any ability for details.</span>
      </div>
    </div>
  );
}
