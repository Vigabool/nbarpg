import type { SeasonData } from '../data/types';
import type { SaveGame } from '../app/game';
import { encounterIds, encounterOf, monsterIcon, monsterName } from '../engine/encounter';
import { rules, type MonsterKind } from '../rules';
import type { TutorialTopic } from './Tutorial';
import { weekLabel } from './common';

const CHALLENGE = ['', 'Gentler', 'Standard', 'Tough'];

/** Twists by name, for the card chips (descriptions show on hover and in How to play). */
function twistInfo(twist: string): { name: string; description: string } {
  const c = (rules.combat as unknown as Record<string, { name?: string; description?: string }>)[twist];
  return { name: c?.name ?? twist, description: c?.description ?? '' };
}

/**
 * The first step of each week: where the party goes. Any encounter can be chosen for now; a
 * proper season structure (weekly offers, a finale) will replace this.
 */
export function ChooseEncounter({
  data,
  game,
  onChange,
  onHelp,
}: {
  data: SeasonData;
  game: SaveGame;
  onChange: (g: SaveGame) => void;
  onHelp: (topic: TutorialTopic) => void;
}) {
  const chosen = game.encounter ?? rules.encounters.default;
  const record = (id: string) => {
    const fought = game.history.filter((h) => (h.encounter ?? rules.encounters.default) === id);
    const won = fought.filter((h) => h.outcome === 'won').length;
    return fought.length ? `${won}–${fought.length - won} here` : null;
  };

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 4 }}>
        <h1>Choose your encounter</h1>
        <p className="muted small">
          Where does the party go in {weekLabel(data, game.weekIndex)}? Each encounter re-skins the horde with its own boss and rules. Your players' opponents
          still shape it: their box scores decide how strong each foe is.
        </p>
      </div>

      <div className="grid" role="radiogroup" aria-label="Encounter">
        {encounterIds().map((id) => {
          const enc = encounterOf(id);
          const selected = id === chosen;
          const foes = (Object.keys(enc.monsters) as MonsterKind[]).filter((k) => k !== enc.boss && k !== enc.bossCompanion);
          const rec = record(id);
          return (
            <div
              key={id}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              className="card stack encounter-card"
              style={{ cursor: 'pointer', borderColor: selected ? 'var(--gold)' : undefined, boxShadow: selected ? '0 0 0 1px var(--gold)' : undefined }}
              onClick={() => onChange({ ...game, encounter: id })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onChange({ ...game, encounter: id }))}
            >
              <div className="spread">
                <h2 style={{ margin: 0 }}>
                  {enc.boss ? monsterIcon(enc.boss, id) : '⚔️'} {enc.name}
                </h2>
                {selected && <span className="chip status-good">Chosen</span>}
              </div>
              <span className="small muted">{enc.tagline}</span>
              <div className="row small" style={{ gap: 6 }}>
                {enc.challenge && (
                  <span className={`chip${enc.challenge >= 3 ? ' warn' : ''}`} title="How hard it plays for a newcomer">
                    {'●'.repeat(enc.challenge)}
                    {'○'.repeat(3 - enc.challenge)} {CHALLENGE[enc.challenge]}
                  </span>
                )}
                {rec && <span className="chip">{rec}</span>}
              </div>
              {enc.boss && (
                <span className="small">
                  Boss: {monsterIcon(enc.boss, id)} <strong>{monsterName(enc.boss, id)}</strong>
                  {enc.bossCompanion && ` with ${monsterIcon(enc.bossCompanion, id)} ${monsterName(enc.bossCompanion, id)}`}
                  {enc.bossSleeps && ' · 💤 asleep from round 1'}
                </span>
              )}
              <span className="small" aria-label="Foes">
                {foes.map((k) => (
                  <span key={k} title={monsterName(k, id)} style={{ marginRight: 8, whiteSpace: 'nowrap', display: 'inline-block' }}>
                    {monsterIcon(k, id)} {monsterName(k, id)}
                  </span>
                ))}
              </span>
              {enc.twists.length > 0 && (
                <div className="row tiny" style={{ gap: 6 }}>
                  {enc.twists.map((t) => {
                    const info = twistInfo(t);
                    return (
                      <span key={t} className="chip" title={info.description}>
                        {info.name}
                      </span>
                    );
                  })}
                </div>
              )}
              <button
                className="btn ghost small"
                style={{ alignSelf: 'flex-start' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHelp({ tab: 'enemies', encounter: id });
                }}
              >
                Meet the enemies
              </button>
            </div>
          );
        })}
      </div>

      <div className="sticky-bottom">
        <div className="spread">
          <button className="btn ghost small" onClick={() => onChange({ ...game, phase: 'roster' })} disabled={game.history.length > 0}>
            ← Roster
          </button>
          <span className="small muted">{encounterOf(chosen).name}</span>
          <button className="btn primary" onClick={() => onChange({ ...game, encounter: chosen, phase: 'assign' })}>
            Assign heroes →
          </button>
        </div>
      </div>
    </div>
  );
}
