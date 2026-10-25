import { useMemo, useRef, useState } from 'react';
import { livingEnemies } from '../engine/combat';
import { CLASS_ICON } from './common';
import { EnemyCard, GoblinStack } from './battle/EnemyCard';
import { HeroRow } from './battle/HeroRow';
import { groupGoblins } from './battle/parts';
import { roundPreview } from './battle/preview';

const noop = () => {};
import { buildSteps } from './sampleTurnScript';

export function SampleTurn() {
  const steps = useMemo(buildSteps, []);
  const [i, setI] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  // A new step starts reading from its title: scroll the How to play body back to the top.
  const go = (k: number) => {
    setI(k);
    navRef.current?.closest('.modal-body')?.scrollTo({ top: 0 });
  };
  const step = steps[i];
  const s = step.state;
  const actors = new Set(step.events.map((e) => e.actorId).filter(Boolean));
  const targets = new Set(step.events.flatMap((e) => e.targetIds ?? []));
  const picked = (id: string) => !!step.aiming?.picked.includes(id);
  const aimable = (id: string) => !!step.aiming?.valid.includes(id);
  const preview = useMemo(() => roundPreview(s), [s]);
  const living = livingEnemies(s);
  const champions = living.filter((e) => e.kind !== 'goblin');
  const goblinGroups = groupGoblins(living.filter((e) => e.kind === 'goblin'));
  // Enemies this step's actions hit get a red ring.
  const hitClass = (id: string) => (targets.has(id) && !actors.has(id) ? 'sample-hit' : undefined);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {/* Pinned to the top of the scrolling body so the controls are always in reach. */}
      <div className="sample-nav" ref={navRef}>
        <button className="btn small" disabled={i === 0} onClick={() => go(i - 1)}>
          ‹ Back
        </button>
        <span className="stack" style={{ gap: 2, alignItems: 'center' }}>
          <span className="sample-dots" aria-hidden>
            {steps.map((_, k) => (
              <span key={k} className={k === i ? 'on' : ''} />
            ))}
          </span>
          <span className="tiny muted num">
            Round {s.round} · step {i + 1} of {steps.length}
          </span>
        </span>
        <button className="btn small" disabled={i === steps.length - 1} onClick={() => go(i + 1)}>
          Next step ›
        </button>
      </div>
      <strong>
        {i + 1}. {step.title}
      </strong>
      <p className="small" style={{ margin: 0 }}>
        {step.text}
      </p>

      {step.aiming && (
        <div className="sample-aim">
          <span className="small" style={{ color: 'var(--info)' }}>
            {CLASS_ICON[step.aiming.heroId]} {step.aiming.actionName}: pick up to {step.aiming.max} targets
          </span>
          <span className="btn primary small" aria-hidden>
            Cast on {step.aiming.picked.length}
          </span>
        </div>
      )}
      {/* The real battle components, so this always looks like the game. Taps do nothing here. */}
      <div className="sample-board" inert>
        <div className="section-label">Horde</div>
        <div className="enemy-grid">
          {champions.map((e) => (
            <div key={e.id} className={hitClass(e.id)}>
              <EnemyCard
                e={e}
                state={s}
                intent={preview.intents[e.id]}
                targetable={aimable(e.id) && !picked(e.id)}
                targeted={picked(e.id)}
                aiming={!!step.aiming}
                onClick={noop}
                onFumble={noop}
              />
            </div>
          ))}
          {goblinGroups.map((g) => (
            <div key={g[0].id} className={g.some((x) => targets.has(x.id)) ? 'sample-hit' : undefined}>
              <GoblinStack
                goblins={g}
                state={s}
                intents={preview.intents}
                threat={0}
                isTarget={aimable}
                targeted={step.aiming?.picked ?? []}
                onPick={noop}
                onDetail={noop}
              />
            </div>
          ))}
          {living.length === 0 && <div className="tiny muted">The horde is beaten.</div>}
        </div>
        <div className="section-label">Party</div>
        <div className="party">
          {s.heroes.map((h) => (
            <div key={h.id} className={hitClass(h.id)}>
              <HeroRow
                h={h}
                netted={false}
                landing={false}
                doomed={preview.doomed.has(h.id)}
                threatOn={false}
                onThreat={noop}
                selected={actors.has(h.id) || step.aiming?.heroId === h.id}
                targetable={false}
                onClick={noop}
              />
            </div>
          ))}
        </div>
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
    </div>
  );
}
