import { useEffect, useRef, useState } from 'react';
import { energyGain, isAttack } from '../engine/combat';
import type { ActionDef } from '../rules';
import { CLASSES, rules, type ChampionKind, type HeroClass, type MonsterKind, type TraitId } from '../rules';
import type { JSX, ReactNode } from 'react';
import { SampleTurn } from './SampleTurn';
import { behaviorOf, encounterIds, encounterOf, hasTwist, monsterDescription, monsterIcon, monsterName, monsterShort, specialFor } from '../engine/encounter';
import { CLASS_ICON, money } from './common';

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

type Tab = 'basics' | 'sample' | 'classes' | 'enemies';
const TABS: { id: Tab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'sample', label: 'Sample turn' },
  { id: 'classes', label: 'Classes' },
  { id: 'enemies', label: 'Enemies' },
];
export type EnemyPage = 'goblin' | ChampionKind | 'warlord' | 'traits';

/** Where to open How to play, e.g. from a "?" in battle. */
export type TutorialTopic =
  | { tab: 'basics' }
  | { tab: 'sample' }
  | { tab: 'classes'; heroClass?: HeroClass; abilityId?: string }
  | { tab: 'enemies'; enemy?: EnemyPage; encounter?: string };

export function Tutorial({ onClose, topic }: { onClose: () => void; topic?: TutorialTopic }) {
  const [tab, setTab] = useState<Tab>(topic?.tab ?? 'basics');
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
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
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
                <strong>Watch who you bring.</strong> Every game you pick also sets how strong the opposing player who mirrors your hero is in
                the horde, and a big night gives that monster a <em>trait</em>. The best opposing line by anyone else becomes the boss.
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

          {tab === 'sample' && <SampleTurn />}
          {tab === 'classes' && (
            <ClassesTab
              initialClass={topic?.tab === 'classes' ? topic.heroClass : undefined}
              initialOpen={topic?.tab === 'classes' ? topic.abilityId : undefined}
            />
          )}

          {tab === 'enemies' && (
            <EnemiesTab
              initial={topic?.tab === 'enemies' ? topic.enemy : undefined}
              initialEncounter={topic?.tab === 'enemies' ? topic.encounter : undefined}
            />
          )}
        </div>

        <div className="spread">
          <span className="tiny faint">Reopen anytime from "How to play".</span>
          {tab !== 'enemies' ? (
            <button className="btn primary small" onClick={() => setTab(TABS[TABS.findIndex((t) => t.id === tab) + 1].id)}>
              {TABS[TABS.findIndex((t) => t.id === tab) + 1].label} →
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

function ClassesTab({ initialClass, initialOpen }: { initialClass?: HeroClass; initialOpen?: string }) {
  const [c, setC] = useState<HeroClass>(initialClass ?? 'warrior');
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);
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

// ---------- Enemies tab ----------

const ENEMY_PAGES: EnemyPage[] = ['goblin', 'ogre', 'warlock', 'hunter', 'assassin', 'shaman', 'warlord', 'traits'];

function range(arr?: number[]): string {
  if (!arr?.length) return '';
  return arr[0] === arr.at(-1) ? `${arr[0]}` : `${arr[0]}–${arr.at(-1)}`;
}

function EnemiesTab({ initial, initialEncounter }: { initial?: EnemyPage; initialEncounter?: string }) {
  const [page, setPage] = useState<EnemyPage>(initial ?? 'goblin');
  const [encId, setEncId] = useState<string>(initialEncounter ?? rules.encounters.default);
  const c = rules.combat;
  const w = rules.horde.warlord;
  const every = c.specialEveryNRounds === 2 ? 'every other round' : `every ${c.specialEveryNRounds} rounds`;
  const enc = encounterOf(encId);
  // The boss page shows the encounter's own boss, or the classic Warlord.
  const label = (p: EnemyPage) =>
    p === 'traits' ? 'Traits' : p === 'warlord' ? (enc.boss ? monsterShort(enc.boss, encId) : 'Warlord') : monsterShort(p, encId);
  const icon = (p: EnemyPage) => (p === 'traits' ? '✨' : p === 'warlord' ? (enc.boss ? monsterIcon(enc.boss, encId) : '👑') : monsterIcon(p, encId));

  let body: JSX.Element;
  if (page === 'traits') {
    body = (
      <>
        <EnemyHead icon="✨" name="Traits" sub="Big nights make monsters dangerous in new ways" />
        <p className="small">
          A standout stat on the opposing player's night gives their monster one trait (the boss can have two). Cold and average nights bring
          a plain monster. You can see every trait while picking games.
        </p>
        {(Object.keys(rules.traits) as TraitId[]).map((id) => {
          const t = rules.traits[id];
          const g = t.trigger;
          const when = 'stat' in g ? `${g.atLeast}+ ${g.label}` : `${Math.round(g.pctAtLeast * 100)}%+ ${g.label} on ${g.minAttempts}+ shots`;
          return <Feature key={id} title={`${t.icon} ${t.name} · ${when}`} text={`${t.description}. Counter: ${t.counter}.`} />;
        })}
      </>
    );
  } else if (page === 'goblin') {
    const bands = rules.horde.minions.damageByTeamFgPct.map((b) => b.damage);
    body = (
      <>
        <EnemyHead icon={icon(page)} name={monsterName('goblin', encId)} sub="Minion · from opposing team points" />
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">❤ {rules.monsters.goblin.hp} HP</span>
          <span className="chip">⚔ {range(bands)} by team FG%</span>
          <span className="chip">1 per {rules.horde.minions.teamPointsPerGoblin} opposing points</span>
        </div>
        <p className="small">{monsterBehavior('goblin', encId)}.</p>
        {monsterPassives('goblin', encId).map((p) => (
          <Feature key={p.title} title={`Passive · ${p.title}`} text={p.text} />
        ))}
      </>
    );
  } else if (page === 'warlord' && enc.boss) {
    const boss = rules.monsters[enc.boss];
    const sp = specialFor(enc.boss, encId);
    body = (
      <>
        <EnemyHead icon={icon(page)} name={monsterName(enc.boss, encId)} sub="The boss · the week's best opposing performance" />
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">❤ {range(boss.hpByTier)} HP</span>
          <span className="chip">⚔ {range(boss.damageByTier)}</span>
          <span className="chip">{w.extraActions + 1} actions a round</span>
        </div>
        <p className="small">
          The single best opposing line (points + rebounds + assists) across your chosen games leads the horde. Its best tier as any
          Champion type sets its strength, and its two biggest standout stats can each give it a trait. The boss is never a player who already
          mirrors one of your heroes. {enc.bossSleeps ? 'It lies asleep on the field from the first round (see Asleep below).' : 'It arrives in the last wave.'}
        </p>
        {sp && <Feature title={`⚠ Special · ${sp.name}`} text={`${sp.description}. Fires ${every} on the field, starting its 2nd round. Its card shows ⏳ the round before, then a red ⚠ NOW banner when it's about to fire.`} warn />}
        {monsterPassives(enc.boss, encId).map((p) => (
          <Feature key={p.title} title={`Passive · ${p.title}`} text={p.text} />
        ))}
        <Feature
          title={`Enrage · below ${Math.round(c.warlordEnrage.atHpFraction * 100)}% HP`}
          text={`+${c.warlordEnrage.damageBonus} damage for the rest of the battle. Save burst for the finish.`}
        />
        <Feature title="Picking games" text="Your hero's best night against a team whose star also went off can build your own final boss." />
      </>
    );
  } else if (page === 'warlord') {
    body = (
      <>
        <EnemyHead icon={icon(page)} name="Warlord" sub="The week's best opposing performance" />
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">❤ {w.hpMultiplier}× its Champion's HP</span>
          <span className="chip">⚔ Champion +{w.damageBonus}</span>
          <span className="chip">{w.extraActions + 1} actions a round</span>
        </div>
        <p className="small">
          The single best opposing line (points + rebounds + assists) across your chosen games becomes the Warlord: a boosted version of that
          player's Champion, with its behavior and special. It arrives in the last wave.
        </p>
        <Feature
          title={`Enrage · below ${Math.round(c.warlordEnrage.atHpFraction * 100)}% HP`}
          text={`+${c.warlordEnrage.damageBonus} damage for the rest of the battle. Save burst for the finish.`}
        />
        <Feature title="Picking games" text="Your hero's best night against a team whose star also went off can build your own final boss." />
      </>
    );
  } else {
    const m = rules.monsters[page];
    const sp = specialFor(page, encId);
    const behavior = monsterBehavior(page, encId);
    const passives = monsterPassives(page, encId);
    body = (
      <>
        <EnemyHead
          icon={icon(page)}
          name={monsterName(page, encId)}
          sub={`Mirrors your ${rules.classes[m.mirrors!].name}${enc.monsters[page]?.flavor ? ` · ${enc.monsters[page]!.flavor}` : ''}`}
        />
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">❤ {range(m.hpByTier)} HP</span>
          {behaviorOf(page, encId) === 'wraith' ? (
            <span className="chip">💧 {range(Object.values(c.wraith.drainByTier))} to every hero</span>
          ) : (
            <span className="chip">⚔ {range(m.damageByTier)}</span>
          )}
          <span className="chip">Scaled by the opposing player's night</span>
        </div>
        <p className="small">{behavior}.</p>
        {sp && <Feature title={`⚠ Special · ${sp.name}`} text={`${sp.description}. Fires ${every} on the field, starting its 2nd round. Its card shows ⏳ the round before, then a red ⚠ NOW banner when it's about to fire.`} warn />}
        {passives.map((p) => (
          <Feature key={p.title} title={`Passive · ${p.title}`} text={p.text} />
        ))}
      </>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 2 }}>
        <span className="section-label">Encounter</span>
        <div className="row" style={{ gap: 6 }}>
          {encounterIds().map((id) => (
            <button key={id} className={`chip enc-chip${id === encId ? ' on' : ''}`} onClick={() => setEncId(id)}>
              {encounterOf(id).name}
            </button>
          ))}
        </div>
        <span className="small muted">{enc.tagline}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Waves arrive on a clock (rounds {c.waveArrivalRounds.join(' and ')}) or as soon as the field is clear. Each hero's game brings one
        mirrored Champion. Every {rules.horde.turnoversPerFumble} turnovers by a Champion's player give you a 💫 Fumble: tap it in battle to cancel that Champion's next action, specials included.
      </p>
      <div className="class-picker enemy-picker" role="tablist" aria-label="Enemies">
        {ENEMY_PAGES.map((p) => (
          <button key={p} role="tab" aria-selected={p === page} className={`class-pick${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>
            <span className="class-pick-icon" aria-hidden>
              {icon(p)}
            </span>
            <span>{label(p)}</span>
          </button>
        ))}
      </div>
      <section className="class-panel">{body}</section>
    </div>
  );
}

/** What a monster does, without its special or passives (shown separately). */
export function monsterBehavior(kind: MonsterKind, encounter?: string): string {
  return monsterDescription(kind, encounter)
    .split('. Special:')[0]
    .split('. Passive:')[0]
    .replace(/\s*Arrives with wave \d+\./, '')
    .replace(/\s*Guarded by the Pack:[^)]*\)/, '')
    .replace(/\.$/, '');
}

/** A monster's standing rules, as titled cards. */
export function monsterPassives(kind: MonsterKind, encounter?: string): { title: string; text: string }[] {
  const c = rules.combat;
  const m = rules.monsters[kind];
  const behavior = behaviorOf(kind, encounter);
  const out: { title: string; text: string }[] = [];
  if (kind === 'goblin' && hasTwist('packTactics', encounter))
    out.push({ title: c.packTactics.name, text: `${c.packTactics.description}. Thin the pack and every goblin hits softer.` });
  if (kind === 'goblin' && hasTwist('restlessDead', encounter)) out.push({ title: c.restlessDead.name, text: `${c.restlessDead.description}.` });
  if (behavior === 'wraith') {
    out.push({ title: 'Intangible', text: 'Weapon attacks pass through it. Spells and Cleric attacks can hit it, and the first such hit makes it solid.' });
    out.push({
      title: 'Life drain',
      text: `Instead of attacking, it drains every hero for ${range(Object.values(c.wraith.drainByTier))} (by tier), ignoring armor, and heals itself.`,
    });
  }
  if (behavior === 'lich' || behavior === 'phylactery')
    out.push({
      title: `${c.phylactery.name} · ${range(rules.monsters.phylactery.hpByTier)} HP`,
      text: `${c.phylactery.description}. When the Lich falls, the Phylactery shatters.`,
    });
  const ov = encounterOf(encounter).monsters[kind];
  for (const p of [ov?.aura, ov?.poisonOnHit, ov?.boneHarvest, ov?.restless, ov?.moltenHide, ov?.shinyThief, ov?.regenerate, ov?.rallyingSaga]) if (p) out.push({ title: p.name, text: `${p.description}.` });
  if (kind === 'goblin' && hasTwist('hoardTithe', encounter)) out.push({ title: c.hoardTithe.name, text: `${c.hoardTithe.description}.` });
  if (kind !== 'goblin' && hasTwist('topple', encounter)) {
    const boss = !!encounterOf(encounter).boss && encounterOf(encounter).boss === kind;
    const pct = Math.round((boss ? c.topple.bossThreshold : c.topple.threshold) * 100);
    out.push({
      title: boss ? 'Unshakable' : c.topple.name,
      text: boss
        ? `Takes ${pct}% of its max HP in one round to topple, but a toppled Lord loses both actions.`
        : `${pct}% of its max HP in one round topples it: it loses its next action, special included. The count resets each round.`,
    });
  }
  if (behavior === 'dragon') {
    out.push({ title: c.dragonSleep.name, text: `${c.dragonSleep.description}.` });
    out.push({ title: 'Hoard', text: `+1 damage per ${c.hoardTithe.coinsPerDamage} coins in its hoard (up to +${c.hoardTithe.maxBonus}).` });
  }
  if (ov?.dragonkin && hasTwist('dragonscale', encounter)) out.push({ title: c.dragonscale.name, text: `${c.dragonscale.description}. Lightning hits it at full strength.` });
  if (behavior === 'chieftain') out.push({ title: c.chieftainCommand.name, text: `${c.chieftainCommand.description}: minions and the goblin Champions, not the Ogre. Kill the Chieftain and the buff ends.` });
  if (m.ignoresTaunt) out.push({ title: 'Ignores taunts', text: "Provoke, Bulwark and the Bear don't work on it." });
  if (hasTwist('packGuard', encounter) && c.packGuard.guarded.includes(behavior)) out.push({ title: c.packGuard.name, text: `${c.packGuard.description}.` });
  if (behavior === 'assassin') out.push({ title: 'Energy drain', text: `Each hit drains ${c.assassinDrain} energy from its target.` });
  return out;
}

export function EnemyHead({ icon, name, sub }: { icon: string; name: string; sub: ReactNode }) {
  return (
    <div className="class-head">
      <span className="class-big-icon" aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <h3 className="class-title">{name}</h3>
        <div className="muted small">{sub}</div>
      </div>
    </div>
  );
}

export function Feature({ title, text, warn }: { title: ReactNode; text: ReactNode; warn?: boolean }) {
  return (
    <div className={`ability-detail${warn ? ' warn' : ''}`}>
      <strong className="small">{title}</strong>
      <p className="small">{text}</p>
    </div>
  );
}
