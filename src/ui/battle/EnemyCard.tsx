import { useEffect, useState } from 'react';
import {
  enemyArmor,
  justArrived,
  commandSources,
  actionsThisRound,
  canFumble,
  phylactery,
  enemyDamage,
  packBonus,
  specialDue,
  activeSpecial,
  ignoresTaunt,
  isGuarded,
  type BattleState,
  type EnemyState,
} from '../../engine/combat';
import { rules, type TraitId } from '../../rules';
import { behaviorOf, encounterOf, hasTwist, monsterIcon } from '../../engine/encounter';
import { Meter, TierDot, type Intent, dmgMark, foeShort, foeIcon } from './parts';
import { ToppleBar, sleepText } from './EncounterTags';

/** Compact, non-interactive status icons for enemy cards. Details live in the detail sheet. */
export function EnemyIcons({ e, state }: { e: EnemyState; state: BattleState }) {
  const special = activeSpecial(state, e);
  const rage = rules.combat.warlordEnrage;
  const icons: { icon: string; tone: string; label: string }[] = [];
  // A Wraith that is already intangible has nothing to fade from.
  if (special && !e.asleep && specialDue(e, state.round + 1) && !(special.key === 'fade' && e.intangible))
    icons.push({ icon: `⏳ ${special.short} next round`, tone: 'soon', label: `${special.name} next round` });
  if (e.enraged) icons.push({ icon: `🔥+${rage.damageBonus}`, tone: 'warn', label: 'Enraged' });
  if (e.drum && e.drum.round >= state.round) icons.push({ icon: `🥁+${e.drum.amount}`, tone: 'warn', label: 'War Drum' });
  for (const c of commandSources(state, e)) icons.push({ icon: `${c.icon}+${c.bonus}`, tone: 'warn', label: c.name });
  if (behaviorOf(e.kind, state.encounter) === 'lich' && phylactery(state))
    icons.push({ icon: '⚱️ ½', tone: 'shield', label: 'Takes half damage while its Phylactery stands' });
  if (isGuarded(state, e)) icons.push({ icon: '🔒', tone: 'shield', label: 'Guarded by the pack' });
  if (e.intangible) icons.push({ icon: '👻 Intangible', tone: 'ghost', label: 'Intangible: only spells and Cleric attacks can touch it' });
  const ovr = encounterOf(state.encounter).monsters[e.kind];
  if (ovr?.regenerate) icons.push({ icon: `♻️+${ovr.regenerate.amount}`, tone: 'good', label: `${ovr.regenerate.name}: ${ovr.regenerate.description}` });
  if (ovr?.rallyingSaga)
    icons.push({ icon: `🎶 +${ovr.rallyingSaga.bonus}⛰️`, tone: 'warn', label: `${ovr.rallyingSaga.name}: ${ovr.rallyingSaga.description}` });
  if (e.groggy) icons.push({ icon: '😵 Groggy', tone: '', label: 'Groggy: one action a round until the final wave arrives' });
  const ov = encounterOf(state.encounter).monsters[e.kind];
  if (ov?.dragonkin && hasTwist('dragonscale', state.encounter)) icons.push({ icon: '🔥½', tone: 'shield', label: 'Dragonscale: half damage from fire' });
  if (ov?.moltenHide)
    icons.push({ icon: `🌋${ov.moltenHide.damage}`, tone: 'warn', label: `${ov.moltenHide.name}: weapon hits burn the attacker for ${ov.moltenHide.damage}` });
  if (behaviorOf(e.kind, state.encounter) === 'assassin')
    icons.push({ icon: `🔋${rules.combat.assassinDrain}`, tone: 'curse', label: `Energy drain: each hit drains ${rules.combat.assassinDrain} energy` });
  if (ignoresTaunt(e)) icons.push({ icon: '⊘⚑', tone: '', label: 'Ignores taunts' });
  if (e.tauntedBy) icons.push({ icon: '⚑', tone: 'taunt', label: 'Taunted' });
  if (e.poison) icons.push({ icon: `☣${e.poison.perRound}`, tone: 'poison', label: 'Poisoned' });
  if (e.weaken) icons.push({ icon: `↓${e.weaken.amount}`, tone: 'curse', label: 'Cursed' });
  if (enemyArmor(e) > 0) icons.push({ icon: `⛨${enemyArmor(e)}`, tone: 'shield', label: 'Shielded' });
  return (
    <>
      {icons.map((i) => (
        <span key={i.label} className={`tag static ${i.tone}`} aria-label={i.label} data-coach={i.tone === 'soon' ? 'special-soon' : undefined}>
          {i.icon}
        </span>
      ))}
    </>
  );
}

/** What a trait is doing right now, if anything changes it (used up, built up). */
export function traitStatus(e: EnemyState, id: TraitId, state: BattleState): { text: string; spent?: boolean } {
  const t = rules.traits[id];
  if (id === 'swat' && e.swatRound === state.round) return { text: `${t.icon} ${t.name} used`, spent: true };
  if (id === 'secondChance' && e.secondChanceUsed) return { text: `${t.icon} ${t.name} used`, spent: true };
  if (id === 'hotHand' && (e.hotStacks ?? 0) > 0) return { text: `${t.icon} ${t.name} +${e.hotStacks}` };
  if (id === 'takeover' && e.hp <= e.maxHp / 2) return { text: `${t.icon} ${t.name}: 2 actions` };
  return { text: `${t.icon} ${t.name}` };
}

/** Box-score traits: abilities from the mirrored player's standout stats. */
export function TraitChips({ e, state }: { e: EnemyState; state: BattleState }) {
  return (
    <>
      {(e.traits ?? []).map((id) => {
        const s = traitStatus(e, id, state);
        return (
          <span key={id} className={`tag static trait${s.spent ? ' spent' : ''}`} aria-label={`${rules.traits[id].name}: ${rules.traits[id].description}`}>
            {s.text}
          </span>
        );
      })}
    </>
  );
}

/** The stat behind a trait on this line, e.g. "4 blocks" or "11-of-16 shooting". */
export function traitSource(id: TraitId, e: EnemyState): string {
  const line = e.spec.source?.line;
  const t = rules.traits[id].trigger;
  if (!line) return '';
  return 'stat' in t ? `${line[t.stat]} ${t.label}` : `${line[t.made]}-of-${line[t.attempts]} ${t.label}`;
}

/** Fumbles from the opposing player's turnovers: tap to cancel this enemy's next action. */
export function FumbleChip({ e, state, passive, onFumble }: { e: EnemyState; state: BattleState; passive: boolean; onFumble: () => void }) {
  // Two taps to spend: the first arms it, the second confirms. It disarms after a few seconds.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  if (e.fumbled) return <span className="tag static fumbled">💫 Fumbling</span>;
  if (!canFumble(state, e)) return null;
  const tov = e.spec.source?.line.tov;
  const label = (
    <>
      💫 {e.fumbles}
      {tov !== undefined && <span className="fumble-tov"> · {tov} TOV</span>}
    </>
  );
  // While aiming an attack, it's just a label so taps land on the card as a target.
  if (passive) return <span className="tag static fumble-idle">{label}</span>;
  return (
    <button
      type="button"
      data-coach="fumble"
      className={`tag fumble${armed ? ' armed' : ''}`}
      aria-label={
        armed
          ? `Confirm: spend a Fumble so ${e.name} loses its next action`
          : `Spend a Fumble on ${e.name} (${e.fumbles} left${tov !== undefined ? `, from ${tov} turnovers` : ''}); tap twice`
      }
      onClick={(ev) => {
        ev.stopPropagation();
        if (!armed) return setArmed(true);
        setArmed(false);
        onFumble();
      }}
    >
      {armed ? '💫 Spend? Tap again' : label}
    </button>
  );
}

/** A special fires this round when the preview of the enemy turn includes it (specials log with ⚠). */
export const specialNow = (intent?: Intent) => !!intent?.short.some((s) => s.startsWith('⚠'));

export function IntentLine({ e, state, intent }: { e: EnemyState; state: BattleState; intent?: Intent }) {
  if (e.asleep) return <div className="u-intent sleep">{sleepText(e)}</div>;
  if (e.toppled) return null; // the topple bar already says so
  if (justArrived(state, e)) return <div className="u-intent muted">Arrived · acts next round</div>;
  if (!intent?.short.length) return null;
  const special = intent.short.filter((s) => s.startsWith('⚠'));
  const rest = intent.short.filter((s) => !s.startsWith('⚠'));
  return (
    <>
      {special.map((s) => (
        <div key={s} className="special-now-pill">
          ⚠ NOW · {s.replace(/^⚠\s*/, '')}
        </div>
      ))}
      {rest.length > 0 && <div className="u-intent">{rest.join(' · ')}</div>}
    </>
  );
}

export function EnemyCard({
  e,
  state,
  intent,
  threat,
  targetable,
  targeted,
  onClick,
  onFumble,
  aiming,
}: {
  e: EnemyState;
  state: BattleState;
  intent?: Intent;
  onFumble: () => void;
  /** An attack is being aimed: card taps pick targets, so the Fumble chip goes quiet. */
  aiming: boolean;
  /** Damage this enemy deals to the hero whose fall is being inspected. */
  threat?: number;
  targetable: boolean;
  targeted: boolean;
  onClick: () => void;
}) {
  const dmg = enemyDamage(state, e);
  const inert = behaviorOf(e.kind, state.encounter) === 'phylactery';
  return (
    <div
      className={`unit-c${e.isWarlord ? ' warlord' : ' champion'}${e.asleep ? ' asleep' : ''}${specialNow(intent) ? ' special-now' : ''}${e.intangible ? ' intangible' : ''}${threat ? ' threat' : ''}${targetable ? ' target' : ''}${targeted ? ' targeted' : ''}`}
      onClick={onClick}
      role="button"
      aria-label={targetable ? `Target ${e.name}` : `${e.name}: details`}
    >
      {!!threat && <span className="threat-badge num">☠ {threat}</span>}
      <div className="u-top">
        <span className="u-name">
          {foeIcon(e, state.encounter)} {foeShort(e, state.encounter)}
          {e.tier && <TierDot tier={e.tier} />}
        </span>
        {!inert && (
          <span className="u-dmg num">
            {dmgMark(e, state.encounter)}
            {dmg}
            {actionsThisRound(e) > 1 ? `×${actionsThisRound(e)}` : ''}
          </span>
        )}
      </div>
      <Meter kind="hp" value={e.hp} max={e.maxHp} />
      <ToppleBar e={e} state={state} />
      <IntentLine e={e} state={state} intent={intent} />
      <div className="u-foot">
        <TraitChips e={e} state={state} />
        <FumbleChip e={e} state={state} passive={aiming} onFumble={onFumble} />
        <EnemyIcons e={e} state={state} />
      </div>
    </div>
  );
}

export function GoblinStack({
  goblins,
  state,
  intents,
  threat,
  isTarget,
  targeted,
  onPick,
  onDetail,
}: {
  goblins: EnemyState[];
  state: BattleState;
  intents: Record<string, Intent>;
  threat: number;
  isTarget: (id: string) => boolean;
  targeted: string[];
  onPick: (id: string) => void;
  onDetail: () => void;
}) {
  const first = goblins[0];
  const valid = goblins.filter((g) => isTarget(g.id));
  const targetable = valid.length > 0;
  // Tapping the card picks the weakest goblin not already chosen.
  const pickWeakest = () => {
    const pick = [...valid].filter((g) => !targeted.includes(g.id)).sort((a, b) => a.hp - b.hp)[0] ?? valid[0];
    if (pick) onPick(pick.id);
  };
  const counts = new Map<string, number>();
  for (const g of goblins) for (const i of intents[g.id]?.short ?? []) counts.set(i, (counts.get(i) ?? 0) + 1);
  const dmg = enemyDamage(state, first);
  const pack = packBonus(state, first);
  return (
    <div
      className={`unit-c minion${threat ? ' threat' : ''}${targetable ? ' target' : ''}${goblins.some((g) => targeted.includes(g.id)) ? ' targeted' : ''}`}
      onClick={targetable ? pickWeakest : onDetail}
      role="button"
    >
      {threat > 0 && <span className="threat-badge num">☠ {threat}</span>}
      <div className="u-top">
        <span className="u-name">
          {monsterIcon('goblin', state.encounter)} {first.name}
          {goblins.length > 1 && <span className="count">×{goblins.length}</span>}
        </span>
        <span className="u-dmg num">⚔{dmg}</span>
      </div>
      <div className="pips">
        {goblins.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`pip${targeted.includes(g.id) ? ' on' : ''}${g.tauntedBy ? ' taunted' : ''}${g.poison ? ' poisoned' : ''}`}
            aria-label={`Goblin ${g.hp}/${g.maxHp} HP`}
            disabled={!isTarget(g.id)}
            onClick={(ev) => {
              ev.stopPropagation();
              onPick(g.id);
            }}
          >
            <span style={{ width: `${(g.hp / g.maxHp) * 100}%` }} />
            <b className="num">{g.hp}</b>
          </button>
        ))}
      </div>
      {(pack > 0 || commandSources(state, first).length > 0) && (
        <div className="u-foot">
          {pack > 0 && (
            <span className="tag static" aria-label={`Pack Tactics +${pack}`}>
              🐺+{pack}
            </span>
          )}
          {commandSources(state, first).map((c) => (
            <span key={c.name} className="tag static warn" aria-label={`${c.name} +${c.bonus}`}>
              {c.icon}+{c.bonus}
            </span>
          ))}
        </div>
      )}
      {justArrived(state, first) ? (
        <div className="u-intent muted">Arrived · acts next round</div>
      ) : (
        counts.size > 0 && <div className="u-intent">{[...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(' · ')}</div>
      )}
    </div>
  );
}
