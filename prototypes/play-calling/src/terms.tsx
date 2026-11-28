import { useEffect, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

/** Game terms a player can tap anywhere they appear in the text. */
export const TERMS: Record<string, { name: string; def: string }> = {
  split: { name: 'Split', def: 'A buff for the finisher: it hits one more enemy. On Smite it also heals one more hero.' },
  sure: { name: 'Sure', def: 'Can’t be evaded by Quick or cancelled by Block. As a buff, the finisher’s hits are Sure.' },
  crit: { name: 'Crit', def: 'A buff for the finisher: +50% damage on its hits.' },
  pierce: { name: 'Pierce', def: 'Ignores Armor. As a buff, the finisher’s hits Pierce.' },
  guided: {
    name: 'Guided',
    def: 'A buff from the Cleric’s Guiding Light: the finisher ignores Taunt and hits whoever you aim at. In the Crypt it is Blessed too: its damage is holy.',
  },
  armor: {
    name: 'Armor',
    def: 'Each hit on this target deals that much less. Pierce ignores it. As a buff, Armor protects the finisher through the enemy turn.',
  },
  taunt: {
    name: 'Taunt',
    def: 'A big (the Ogre) forces single-target hits onto itself while it stands; hits that reach several enemies must include it. Get past it with Guided, by Disabling it, or by taking it down.',
  },
  taunted: { name: 'Taunted', def: 'This enemy attacks the Warrior on the horde’s turn.' },
  quick: {
    name: 'Quick',
    def: 'The first hit on this enemy each possession misses. A cheap hit first, a Slow, or a Sure hit gets past it. A hero made Quick (Spacing’s pass) dodges the first horde hit that turn: a stop. The horde’s Hex (Enervate in the Crypt) takes a hero’s Quick away.',
  },
  barrier: {
    name: 'Barrier',
    def: 'The Shaman’s wall in front of the whole horde for your next possession. Aim at any enemy and the Barrier takes the hit instead; the first damaging move breaks it (a finisher spent on it scores no bucket).',
  },
  block: {
    name: 'Block',
    def: 'The Chieftain cancels the first hit on any enemy each possession. A cheap hit first uses it up; Sure hits get through.',
  },
  exposed: { name: 'Exposed', def: 'Takes +3 from every hit this possession.' },
  marked: { name: 'Marked', def: 'Exposed through the next possession too.' },
  disabled: {
    name: 'Disabled',
    def: 'Out of the horde’s next play, and loses its Taunt or Quick. A Disabled Shaman or Wight casts nothing and gives no War Drum or Unholy Vigor.',
  },
  slowed: { name: 'Slowed', def: 'Loses Quick, and its next hit deals half.' },
  stripped: {
    name: 'Stripped',
    def: 'Knocked off the ram by Strip the Ball: it doesn’t push this turn (the ram hits a quarter softer for each), but still counts as crew. In the Crypt, a stripped skeleton is pinned away from the Ritual and doesn’t feed it.',
  },
  warDrum: { name: 'War Drum', def: 'While the Shaman stands (and isn’t Disabled), the ram hits +2.' },
  callPack: {
    name: 'Call the Pack',
    def: 'The Shaman summons 2 goblins (3 if Great or better) when fewer than 4 are on the ram. The Chieftain calls 2 every other turn.',
  },
  ritual: {
    name: 'The Ritual',
    def: 'The Crypt’s objective. It grows each enemy turn by 1 per skeleton and bone pile (up to 6: the circle holds six, and the rest wait their turn), and 2 more while the Wight stands; the horde scores 1 per 2 Ritual points, and 1 more each turn it grows. When it completes (at 22), the horde scores 8 and it starts over; the first time, the Lich rises early. Destroying the dead for good sets it back 1; the Necromancer, 3.',
  },
  restless: {
    name: 'Restless Dead',
    def: 'In the Crypt, a skeleton killed by a weapon hit crumbles into a bone pile and rises next possession with half its HP. Fire or a Blessed finisher destroys it for good, and only then does it score. The Bone Knight rises once.',
  },
  pile: {
    name: 'Bone pile',
    def: 'A crumbled skeleton. It still feeds the Ritual, can’t be hit, and rises next possession with half its HP (or at once, at full strength, if the Wight casts Raise Dead).',
  },
  blessed: {
    name: 'Blessed',
    def: 'In the Crypt, a finisher the Cleric’s Guiding Light passed to deals holy damage (as well as being Guided): it destroys the dead for good, touches the Wraith, and consecrates graves. The Cleric’s own hits are holy too.',
  },
  holy: {
    name: 'Holy damage',
    def: 'A Cleric hit, or a Blessed finisher. It destroys the dead for good, touches the Wraith, and is the only thing that consecrates a grave.',
  },
  fire: { name: 'Fire', def: 'Fireball and Meteor. In the Crypt, fire destroys the dead for good.' },
  intangible: {
    name: 'Intangible',
    def: 'The Wraith: only Wizard spells and holy (Blessed) hits touch it, and the first one makes it solid for the rest of the possession. Other hits pass through it, and a finisher that only passes through is a turnover.',
  },
  raiseDead: { name: 'Raise Dead', def: 'The Wight’s cast when bone piles are on the floor: every pile rises at once, at the HP it had before it crumbled.' },
  unholyVigor: {
    name: 'Unholy Vigor',
    def: 'The Wight’s passive: the Ritual grows 2 more each turn while it stands (and isn’t Disabled), on top of the six dead the circle holds.',
  },
  enervate: { name: 'Enervate', def: 'The Necromancer’s setup: the targeted hero loses a touch and any Quick, and the next hit +2.' },
  deathBolt: { name: 'Death Bolt', def: 'The Lich, every other enemy turn: 1.5× its damage to the lowest-HP hero, ignoring Armor.' },
  consecrate: { name: 'Consecrate', def: 'Close an open grave for good with holy damage (+3). An open grave raises a skeleton at the start of every quarter.' },
  turnover: {
    name: 'Turnover',
    def: 'Your finisher is Blocked, evaded, swallowed by the Barrier, or (in the Crypt) passes through the Wraith or hits a grave without holy damage: the horde scores 2 on the fast break. A cheap hit first, or a Sure finisher, avoids it.',
  },
  bucket: { name: 'Bucket', def: '2 points for a finisher that damages a Champion or the boss. One per finisher, however many it hits.' },
  takedown: {
    name: 'Takedown',
    def: 'Each enemy taken down scores its 🏀 value: goblins and skeletons 1 (a skeleton only when destroyed for good), Champions 4 or more, the boss most.',
  },
  finisher: { name: 'Finisher', def: 'The last move of a possession and the only one that scores a bucket. Every helper’s buff goes to it.' },
  stop: {
    name: 'Stop',
    def: 'A horde hit held to nothing: Armor at least as big as the hit, a Quick dodge, or a Steal. No defender stops a full hit alone: pair Protect with Close Out, or Steal from an enemy that’s Slowed or Exposed. Each stop starts a fast break.',
  },
  fastBreak: {
    name: 'Fast break',
    def: 'After a stop, your next finisher gets Crit (and Sure, if the play already gives it Crit). After your turnover, the horde gets the fast break.',
  },
  steal: {
    name: 'Steal',
    def: 'The Rogue’s other defense: instead of Strip the Ball, pick the pocket of a Champion that’s Slowed (Close Out, Slam) or Exposed (Mark, Double Strike, Read). It drops out of the horde’s play: a stop. On anyone else it misses.',
  },
  protect: {
    name: 'Protect',
    def: 'The Warrior’s defense when not in the play: Armor (8, more with a better defensive night) on one hero through the horde’s turn, or guard the objective (brace the gate, halving the ram; in the Crypt, guard the circle, halving the Ritual).',
  },
  closeOut: {
    name: 'Close Out',
    def: 'The Ranger’s defense when not in the play: Slows one enemy, so its next hit deals half. A halved hit into Protect’s Armor is usually a stop, and a Slowed Champion can be stolen from.',
  },
  ward: {
    name: 'Ward',
    def: 'The Wizard’s defense when not in the play: Armor (8, more with a better defensive night) on one ally through the horde’s turn. On the hero the Warrior protects, or against a Slowed hit, it can make a stop.',
  },
  triage: { name: 'Triage', def: 'The Cleric’s defense when not in the play: heals the most injured hero after the horde’s turn.' },
  stripBall: {
    name: 'Strip the Ball',
    def: 'The Rogue’s defense when not in the play: knocks goblins off the ram so they don’t push this turn. In the Crypt it pins skeletons away from the Ritual.',
  },
};

/** How each term is written in the text (longest first, so "Strip the Ball" wins over shorter words). */
const FORMS: [string, string][] = [
  ['Strip the Ball', 'stripBall'],
  ['Fast break', 'fastBreak'],
  ['fast break', 'fastBreak'],
  ['Steal', 'steal'],
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
  ['Restless Dead', 'restless'],
  ['Restless', 'restless'],
  ['bone piles', 'pile'],
  ['bone pile', 'pile'],
  ['Bone piles', 'pile'],
  ['Raise Dead', 'raiseDead'],
  ['Unholy Vigor', 'unholyVigor'],
  ['Enervate', 'enervate'],
  ['Death Bolt', 'deathBolt'],
  ['Ritual', 'ritual'],
  ['Blessed', 'blessed'],
  ['holy', 'holy'],
  ['Holy', 'holy'],
  ['fire', 'fire'],
  ['Intangible', 'intangible'],
  ['consecrates', 'consecrate'],
  ['consecrated', 'consecrate'],
  ['Consecrate', 'consecrate'],
  ['a stop', 'stop'],
  ['Turnover', 'turnover'],
  ['turnover', 'turnover'],
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
