import { useMemo, useState } from 'react';
import { enemyDamage, livingEnemies, previewEnemyPhase, specialDue, specialOf } from '../engine/combat';
import { rules } from '../rules';
import { monsterIcon } from '../engine/encounter';
import { CLASS_ICON } from './common';
import { buildSteps } from './sampleTurnScript';

export function SampleTurn() {
  const steps = useMemo(buildSteps, []);
  const [i, setI] = useState(0);
  const step = steps[i];
  const s = step.state;
  const actors = new Set(step.events.map((e) => e.actorId).filter(Boolean));
  const targets = new Set(step.events.flatMap((e) => e.targetIds ?? []));
  const intents = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of previewEnemyPhase(s)) if (l.actorId) (map[l.actorId] ??= []).push(l.short ?? l.text);
    return map;
  }, [s]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="spread">
        <strong>
          {i + 1}. {step.title}
        </strong>
        <span className="tiny muted num">
          Round {s.round} · step {i + 1} of {steps.length}
        </span>
      </div>
      <p className="small" style={{ margin: 0 }}>
        {step.text}
      </p>

      <div className="sample-board">
        <div className="section-label">Horde</div>
        {livingEnemies(s).length === 0 && <div className="tiny muted">No goblins left.</div>}
        {livingEnemies(s).map((e) => {
          const hit = targets.has(e.id);
          const sp = specialOf(e, s.encounter);
          return (
            <div key={e.id} className={`sample-row${hit ? ' hit' : ''}${actors.has(e.id) ? ' acted' : ''}`}>
              <span className="sample-name">
                {monsterIcon(e.kind)} {e.name}
              </span>
              <SampleMeter value={e.hp} max={e.maxHp} kind="hp" />
              <span className="sample-note">
                <span className="u-dmg">⚔{enemyDamage(s, e)}</span>
                {e.tauntedBy && <span className="tag static taunt">⚑</span>}
                {e.weaken && <span className="tag static curse">↓{e.weaken.amount}</span>}
                {sp && specialDue(e, s.round + 1) && <span className="tag static warn">⚠ {sp.short}</span>}
                <span className="sample-intent">{(intents[e.id] ?? []).join(' · ')}</span>
              </span>
            </div>
          );
        })}
        <div className="section-label">Party</div>
        {s.heroes.map((h) => (
          <div key={h.id} className={`sample-row${actors.has(h.id) ? ' acted' : ''}${targets.has(h.id) ? ' hit' : ''}`}>
            <span className="sample-name">
              {CLASS_ICON[h.heroClass]} {rules.classes[h.heroClass].name}
              {h.acted && <span className="h-state"> ✓</span>}
            </span>
            <SampleMeter value={h.hp} max={h.maxHp} kind="hp" />
            <span className="sample-note">
              <SampleMeter value={h.pool} max={24} kind="pool" />
              {h.armor > 0 && <span className="tag static shield">⛨{h.armor}</span>}
            </span>
          </div>
        ))}
      </div>

      {step.events.length > 0 && (
        <div className="sample-events">
          {step.events.map((e, k) => (
            <div key={k} className={e.side}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      <div className="spread">
        <button className="btn small" disabled={i === 0} onClick={() => setI(i - 1)}>
          ‹ Back
        </button>
        <span className="sample-dots" aria-hidden>
          {steps.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </span>
        <button className="btn small" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>
          Next step ›
        </button>
      </div>
    </div>
  );
}

function SampleMeter({ value, max, kind }: { value: number; max: number; kind: 'hp' | 'pool' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter ${kind}${kind === 'hp' && pct > 50 ? ' ok' : ''}`}>
      <span style={{ width: `${pct}%` }} />
      <b className="num">{kind === 'hp' ? `${value}/${max}` : `${value} energy`}</b>
    </div>
  );
}
