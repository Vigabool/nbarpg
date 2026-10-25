import { useEffect, useState } from 'react';
import {
  enemyArmor,
  justArrived,
  commandSources,
  canFumble,
  phylactery,
  enemyDamage,
  packBonus,
  specialDue,
  activeSpecial,
  isGuarded,
  type BattleState,
  type EnemyState,
} from '../../engine/combat';
import { rules } from '../../rules';
import { EnemyHead, Feature, monsterBehavior, monsterPassives, type EnemyPage } from '../Tutorial';
import { behaviorOf } from '../../engine/encounter';
import { TierChip, statLine } from '../common';
import { type Intent, isClassicWarlord, foeShort, foeName, foeIcon } from './parts';
import { sleepText } from './EncounterTags';
import { traitStatus, traitSource } from './EnemyCard';

/** Full details for the horde, opened by tapping a card. Tabs flip between every foe on the field. */
export function EnemyDetail({
  groups,
  initialId,
  state,
  intents,
  onFumble,
  onClose,
  onHelp,
}: {
  groups: EnemyState[][];
  initialId: string;
  state: BattleState;
  intents: Record<string, Intent>;
  onFumble: (enemyId: string) => void;
  onClose: () => void;
  onHelp: (enemy: EnemyPage) => void;
}) {
  const [idx, setIdx] = useState(() =>
    Math.max(
      0,
      groups.findIndex((g) => g.some((e) => e.id === initialId)),
    ),
  );
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (groups.length === 0) return null;
  const enemies = groups[Math.min(idx, groups.length - 1)];
  const e = enemies[0];
  const special = activeSpecial(state, e);
  const [, player] = e.name.split(' · ');
  const rage = rules.combat.warlordEnrage;
  const n = rules.combat.specialEveryNRounds;
  let nextSpecial: number | null = null;
  if (special)
    for (let r = state.round; r < state.round + n + 1; r++)
      if (specialDue(e, r)) {
        nextSpecial = r;
        break;
      }
  const when = nextSpecial === state.round ? 'this round' : nextSpecial === state.round + 1 ? 'next round' : `round ${nextSpecial}`;

  const now: { text: string; tone: string }[] = [];
  if (e.enraged) now.push({ text: `🔥 Enraged +${rage.damageBonus}`, tone: 'warn' });
  if (e.drum && e.drum.round >= state.round)
    now.push({ text: `🥁 War Drum +${e.drum.amount} ${e.drum.round === state.round ? 'this round' : 'next round'}`, tone: 'warn' });
  if (isGuarded(state, e)) now.push({ text: '🔒 Guarded now', tone: 'shield' });
  if (packBonus(state, e) > 0) now.push({ text: `🐺 Pack +${packBonus(state, e)}`, tone: '' });
  for (const c of commandSources(state, e)) now.push({ text: `${c.icon} ${c.name} +${c.bonus}`, tone: 'warn' });
  if (behaviorOf(e.kind, state.encounter) === 'lich' && phylactery(state))
    now.push({ text: '⚱️ Takes half damage while its Phylactery stands', tone: 'shield' });
  if (e.tauntedBy) {
    const h = state.heroes.find((x) => x.id === e.tauntedBy);
    now.push({
      text: `⚑ Taunted by ${h ? rules.classes[h.heroClass].name : (state.summons.find((x) => x.id === e.tauntedBy)?.name ?? 'an ally')}`,
      tone: 'taunt',
    });
  }
  if (e.poison) now.push({ text: `☣ Poison ${e.poison.perRound} × ${e.poison.rounds} rounds`, tone: 'poison' });
  if (e.weaken) now.push({ text: `↓ Cursed −${e.weaken.amount} for ${e.weaken.rounds} rounds`, tone: 'curse' });
  if (enemyArmor(e) > 0) now.push({ text: `⛨ Shielded +${enemyArmor(e)}`, tone: 'shield' });
  if (e.intangible) now.push({ text: '👻 Intangible: only spells and Cleric attacks can touch it', tone: 'curse' });

  const short = enemies.flatMap((x) => intents[x.id]?.short ?? []);
  const full = enemies.flatMap((x) => intents[x.id]?.full ?? []);
  const label = (g: EnemyState[]) => foeShort(g[0], state.encounter);
  return (
    <div className="modal-backdrop drawer" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="The horde" onClick={(ev) => ev.stopPropagation()}>
        <div className="spread">
          <h2>The horde</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="foe-picker" role="tablist" aria-label="Foes on the field">
          {groups.map((g, i) => (
            <button key={g[0].id} role="tab" aria-selected={i === idx} className={`class-pick${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)}>
              <span className="class-pick-icon" aria-hidden>
                {foeIcon(g[0], state.encounter)}
              </span>
              <span>
                {label(g)}
                {g.length > 1 ? ` ×${g.length}` : ''}
              </span>
              <span className="foe-hp" style={{ width: `${(g.reduce((t, x) => t + x.hp, 0) / g.reduce((t, x) => t + x.maxHp, 0)) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="modal-body class-panel">
          <EnemyHead
            icon={foeIcon(e, state.encounter)}
            name={`${foeName(e, state.encounter)}${enemies.length > 1 ? ` ×${enemies.length}` : ''}`}
            sub={
              <span className="row" style={{ gap: 6 }}>
                {player ? <span>{player}</span> : <span>{e.name}</span>}
                {e.tier && <TierChip tier={e.tier} />}
              </span>
            }
          />
          <div className="row" style={{ gap: 6 }}>
            <span className="chip">❤ {enemies.length > 1 ? enemies.map((x) => x.hp).join(' / ') : `${e.hp}/${e.maxHp}`} HP</span>
            <span className="chip">
              {behaviorOf(e.kind, state.encounter) === 'wraith' ? `💧 ${enemyDamage(state, e)} to every hero` : `⚔ ${enemyDamage(state, e)}`}
            </span>
            {e.isWarlord && <span className="chip">{e.extraActions + 1} actions a round</span>}
          </div>
          {e.spec.source && <div className="tiny muted">{statLine(e.spec.source.line)}</div>}
          <p className="small" style={{ margin: 0 }}>
            {monsterBehavior(e.kind, state.encounter)}.
          </p>
          {now.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {now.map((x) => (
                <span key={x.text} className={`chip now-chip ${x.tone}`}>
                  {x.text}
                </span>
              ))}
            </div>
          )}
          <Feature
            title="This round"
            text={
              e.asleep ? (
                `${sleepText(e)}. ${rules.combat.dragonSleep.description}.`
              ) : justArrived(state, e) ? (
                'Just arrived: acts next round.'
              ) : short.length ? (
                <>
                  <span className="u-intent">{short.join(' · ')}</span>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    {full.join(' ')}
                  </span>
                </>
              ) : (
                'Nothing planned.'
              )
            }
          />
          {(e.traits ?? []).map((id) => {
            const t = rules.traits[id];
            const src = traitSource(id, e);
            return (
              <Feature
                key={id}
                title={`${traitStatus(e, id, state).text} · trait`}
                text={
                  <>
                    {t.description}.{src && ` From ${player ?? 'its player'}'s ${src}.`}
                    <span className="tiny muted" style={{ display: 'block' }}>
                      Counter: {t.counter}.
                    </span>
                  </>
                }
              />
            );
          })}
          {(e.fumbles > 0 || e.fumbled) && (
            <Feature
              title={`💫 Fumbles · ${e.fumbles} left`}
              text={
                <>
                  {player ?? 'Its player'} turned it over {e.spec.source?.line.tov ?? 0} times that night: one Fumble per {rules.horde.turnoversPerFumble}.
                  Spend one to cancel its next action, a special included. Free for your party, and lost when it dies.
                  {e.fumbled ? (
                    <span className="u-intent" style={{ display: 'block' }}>
                      Fumbling: it loses its next action.
                    </span>
                  ) : (
                    canFumble(state, e) && (
                      <button className="btn small" style={{ display: 'block', marginTop: 6 }} onClick={() => onFumble(e.id)}>
                        💫 Spend a Fumble
                      </button>
                    )
                  )}
                </>
              }
            />
          )}
          {special && <Feature title={`⚠ Special · ${special.name} (${when})`} text={`${special.description}.`} warn />}
          {e.isWarlord && (
            <Feature
              title={`🔥 Boss · enrages below ${Math.round(rage.atHpFraction * 100)}% HP`}
              text={
                isClassicWarlord(e)
                  ? `Double HP, +${rules.horde.warlord.damageBonus} damage and two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
                  : `The week's best opposing performance. Two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
              }
            />
          )}
          {monsterPassives(e.kind, state.encounter).map((p) => (
            <Feature key={p.title} title={`${p.icon ? `${p.icon} ` : ''}Passive · ${p.title}`} text={p.text} />
          ))}
          <button
            className="btn small"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => onHelp((e.isWarlord || e.kind === 'phylactery' ? 'warlord' : e.kind) as EnemyPage)}
          >
            More in How to play →
          </button>
        </div>
      </div>
    </div>
  );
}
