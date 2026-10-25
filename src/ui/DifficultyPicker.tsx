import { DIFFICULTIES, rules, type Difficulty } from '../rules';

/** Normal or Hard, with what each means. Used at New game and between chapters. */
export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }} role="radiogroup" aria-label="Difficulty">
      <span className="muted small">Difficulty</span>
      <div className="row" style={{ gap: 8 }}>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === value}
            className={`btn small${d === value ? ' primary' : ''}`}
            onClick={() => onChange(d)}
          >
            {rules.difficulty.levels[d].name}
          </button>
        ))}
      </div>
      <span className="tiny muted">{rules.difficulty.levels[value].description}</span>
    </div>
  );
}

/** A small label for the run's difficulty. */
export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`chip${difficulty === 'hard' ? ' warn' : ''}`} title={rules.difficulty.levels[difficulty].description}>
      {difficulty === 'hard' ? '🔥' : '🛡️'} {rules.difficulty.levels[difficulty].name}
    </span>
  );
}
