import { actionDamage, energyGain, type ActionOption, type HeroState } from '../../engine/combat';

export function ActionTile({
  o,
  hero,
  details,
  onPick,
}: {
  o: ActionOption;
  hero: HeroState;
  details: boolean;
  onPick: (o: ActionOption) => void;
}) {
  const dmg = actionDamage(o.def, hero);
  const gain = energyGain(o.def);
  const description = o.def.description.replace(/\bG\b/g, String(hero.gear));
  return (
    <button
      className={`btn action${o.def.unlock ? ' sig' : ''}`}
      disabled={!o.available}
      onClick={() => onPick(o)}
      title={`${description}${o.reason ? ` (${o.reason})` : ''}`}
    >
      <span className="action-top">
        <span className="action-name">{o.def.name}</span>
        {dmg && (
          <span className="action-dmg num" title="Damage">
            ⚔{dmg}
          </span>
        )}
        {gain ? (
          <span className="cost gain" title={`Gains ${gain} energy`}>
            +{gain}
          </span>
        ) : (
          <span className={`cost${o.cost !== undefined && o.def.cost !== undefined && o.cost < o.def.cost ? ' discounted' : ''}`}>{o.def.unlock ? (o.def.unlock === 'signature' ? 'DD' : 'TD') : o.cost}</span>
        )}
      </span>
      {details && <span className="tiny muted">{description}</span>}
      {details && !o.available && o.reason && <span className="tiny faint">{o.reason}</span>}
    </button>
  );
}
