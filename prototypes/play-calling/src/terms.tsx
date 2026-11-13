import { useEffect, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

/** Game terms a player can tap anywhere they appear in the text. */
export const TERMS: Record<string, { name: string; def: string }> = {
  split: { name: 'Split', def: 'A buff for the finisher: it hits one more enemy. On Smite it also heals one more hero.' },
  sure: { name: 'Sure', def: 'Can’t be evaded by Quick or cancelled by Block. As a buff, the finisher’s hits are Sure.' },
  crit: { name: 'Crit', def: 'A buff for the finisher: +50% damage on its hits.' },
  pierce: { name: 'Pierce', def: 'Ignores Armor. As a buff, the finisher’s hits Pierce.' },
  guided: { name: 'Guided', def: 'A buff from the Cleric’s Guiding Light: the finisher ignores Taunt and hits whoever you aim at.' },
  armor: {
    name: 'Armor',
    def: 'Each hit on this target deals that much less. Pierce ignores it. As a buff, Armor protects the finisher through the enemy turn.',
  },
  taunt: {
    name: 'Taunt',
    def: 'A big (the Ogre) forces single-target hits onto itself while it stands; hits that reach several enemies must include it. Get past it with Guided, by Disabling it, or by taking it down.',
  },
  taunted: { name: 'Taunted', def: 'This enemy attacks the Warrior on the horde’s turn.' },
  quick: { name: 'Quick', def: 'The first hit on this enemy each possession misses. A cheap hit first, a Slow, or a Sure hit gets past it.' },
  barrier: {
    name: 'Barrier',
    def: 'The Shaman’s wall in front of the whole horde for your next possession. Nothing behind it can be targeted; the first damaging move breaks it (a finisher spent on it scores no bucket).',
  },
  block: {
    name: 'Block',
    def: 'The Chieftain cancels the first hit on any enemy each possession. A cheap hit first uses it up; Sure hits get through.',
  },
  exposed: { name: 'Exposed', def: 'Takes +3 from every hit this possession.' },
  marked: { name: 'Marked', def: 'Exposed through the next possession too.' },
  disabled: { name: 'Disabled', def: 'Out of the horde’s next play, and loses its Taunt or Quick. A Disabled Shaman casts nothing and drums nothing.' },
  slowed: { name: 'Slowed', def: 'Loses Quick, and its next hit deals half.' },
  stripped: { name: 'Stripped', def: 'Knocked off the ram by Strip the Ball: it doesn’t push this turn, but still counts as crew.' },
  warDrum: { name: 'War Drum', def: 'While the Shaman stands (and isn’t Disabled), the ram hits +2.' },
  callPack: {
    name: 'Call the Pack',
    def: 'The Shaman summons 2 goblins (3 if Great or better) when fewer than 4 are on the ram. The Chieftain calls 2 every other turn.',
  },
  bucket: { name: 'Bucket', def: '2 points for a finisher that damages a Champion or the boss. One per finisher, however many it hits.' },
  takedown: { name: 'Takedown', def: 'Each enemy taken down scores its 🏀 value: goblins 1, Champions 4 or more, the boss most.' },
  finisher: { name: 'Finisher', def: 'The last move of a possession and the only one that scores a bucket. Every helper’s buff goes to it.' },
  protect: { name: 'Protect', def: 'The Warrior’s defense when not in the play: Armor on one hero through the horde’s turn.' },
  closeOut: { name: 'Close Out', def: 'The Ranger’s defense when not in the play: Slows one enemy, so its next hit deals half.' },
  ward: { name: 'Ward', def: 'The Wizard’s defense when not in the play: Armor on one ally through the horde’s turn.' },
  triage: { name: 'Triage', def: 'The Cleric’s defense when not in the play: heals the most injured hero after the horde’s turn.' },
  stripBall: { name: 'Strip the Ball', def: 'The Rogue’s defense when not in the play: knocks goblins off the ram so they don’t push this turn.' },
};

/** How each term is written in the text (longest first, so "Strip the Ball" wins over shorter words). */
const FORMS: [string, string][] = [
  ['Strip the Ball', 'stripBall'],
  ['Call the Pack', 'callPack'],
  ['calls the pack', 'callPack'],
  ['War Drum', 'warDrum'],
  ['Close Out', 'closeOut'],
  ['Closes Out', 'closeOut'],
  ['Split', 'split'],
  ['Sure', 'sure'],
  ['Crit', 'crit'],
  ['Pierces', 'pierce'],
  ['Pierce', 'pierce'],
  ['Guided', 'guided'],
  ['Armored', 'armor'],
  ['Armor', 'armor'],
  ['Taunted', 'taunted'],
  ['Taunting', 'taunt'],
  ['Taunts', 'taunt'],
  ['Taunt', 'taunt'],
  ['Quick', 'quick'],
  ['Barrier', 'barrier'],
  ['Blocked', 'block'],
  ['Block', 'block'],
  ['Exposed', 'exposed'],
  ['Exposes', 'exposed'],
  ['Marked', 'marked'],
  ['Disabled', 'disabled'],
  ['Disables', 'disabled'],
  ['Slowed', 'slowed'],
  ['Slows', 'slowed'],
  ['Stripped', 'stripped'],
  ['bucket', 'bucket'],
  ['takedowns', 'takedown'],
  ['takedown', 'takedown'],
  ['finishers', 'finisher'],
  ['Finishers', 'finisher'],
  ['finisher', 'finisher'],
  ['Finisher', 'finisher'],
  ['Protects', 'protect'],
  ['Protect', 'protect'],
  ['Wards', 'ward'],
  ['Ward', 'ward'],
  ['Triage', 'triage'],
];
const FORM_KEY = new Map(FORMS);
const PATTERN = new RegExp(
  `\\b(${[...FORMS]
    .sort((a, b) => b[0].length - a[0].length)
    .map((f) => f[0])
    .join('|')})\\b`,
  'g',
);

// A tiny store for the open term, so any component can open it without passing props down.
let open: string | null = null;
const listeners = new Set<() => void>();
export function showTerm(key: string | null) {
  open = key;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** One tappable term. It's a span, not a button, so it can sit inside cards that are buttons themselves. */
export function Term(props: { k: string; children: ReactNode }) {
  const tap = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    showTerm(props.k);
  };
  return (
    <span
      className="term"
      role="button"
      tabIndex={0}
      aria-label={`${TERMS[props.k].name}: what it means`}
      onClick={tap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') tap(e);
      }}
    >
      {props.children}
    </span>
  );
}

/** Text with its game terms highlighted and tappable. */
export function Rich(props: { children: string | undefined | null }) {
  const text = props.children ?? '';
  const out: ReactNode[] = [];
  let last = 0;
  // Only a term's first mention in a passage is highlighted, so dense text stays readable.
  const seen = new Set<string>();
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    const key = FORM_KEY.get(m[0])!;
    if (seen.has(key)) continue;
    seen.add(key);
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <Term key={at} k={key}>
        {m[0]}
      </Term>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** The pop-up definition, mounted once at the top of the app. */
export function TermLayer() {
  const key = useSyncExternalStore(subscribe, () => open);
  useEffect(() => {
    if (!key) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') showTerm(null);
    };
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
    };
  }, [key]);
  if (!key) return null;
  const t = TERMS[key];
  return (
    <div className="termback" onClick={() => showTerm(null)}>
      <div className="termpop" role="dialog" aria-label={t.name} onClick={(e) => e.stopPropagation()}>
        <div className="termhead">
          <strong>{t.name}</strong>
          <button className="btn" onClick={() => showTerm(null)}>
            Got it
          </button>
        </div>
        <p className="small">
          <Rich>{t.def}</Rich>
        </p>
      </div>
    </div>
  );
}
