import { activeSpecial, canFumble, nextWaveRound, specialDue, type BattleState } from '../engine/combat';

/** What the battle screen is showing, for deciding which tip fits the moment. */
export interface CoachContext {
  state: BattleState;
  /** The action sheet is open for a hero. */
  sheetOpen: boolean;
  /** An action is waiting for its target. */
  targeting: boolean;
  /** Heroes who fall if the round ends now. */
  doomed: Set<string>;
}

/** A first-time tip: shown once, when its moment comes, pointing at one element. */
export interface CoachTip<C = CoachContext> {
  id: string;
  /** CSS selector of the element to highlight; the tip waits until it's on screen. */
  target: string;
  title: string;
  text: string;
  /** Only after this tip has been seen (keeps the opening tips in order). */
  after?: string;
  /** Shows right after this tip is dismissed; other tips wait until the player does something. */
  continues?: string;
  /** The action sheet this tip needs: closed so what it points at isn't covered, or open on a ready hero. */
  sheet?: 'open' | 'closed';
  when: (ctx: C) => boolean;
}

const live = (ctx: CoachContext) => ctx.state.phase === 'party';
const heroActed = (s: BattleState) => s.log.some((l) => l.side === 'hero');
const heroReady = (s: BattleState) => s.heroes.some((h) => h.alive && !h.acted && !h.prone);

/** The first-battle walkthrough, in priority order. */
export const BATTLE_TIPS: CoachTip[] = [
  {
    id: 'battle-horde',
    target: '[data-coach="horde"]',
    title: 'This is the horde',
    text: 'Each card shows what that enemy will do this round, and to whom. No dice, no surprises: plan around it.',
    sheet: 'closed',
    when: live,
  },
  {
    id: 'battle-party',
    target: '[data-coach="party"]',
    after: 'battle-horde',
    continues: 'battle-horde',
    title: 'Your party',
    text: 'Green is HP, blue is energy. Tap a hero to act with them; heroes can go in any order.',
    sheet: 'closed',
    when: live,
  },
  {
    id: 'battle-actions',
    target: '[data-coach="actions"]',
    after: 'battle-party',
    continues: 'battle-party',
    title: 'One attack, any utilities',
    text: 'Each hero gets one attack a round, plus any utilities (taunts, heals, armor, buffs) they have energy for. Blue numbers are costs; basic attacks give +2 energy back.',
    sheet: 'open',
    when: (ctx) => live(ctx) && !ctx.targeting && heroReady(ctx.state),
  },
  {
    id: 'battle-target',
    target: '[data-coach="horde"]',
    after: 'battle-actions',
    continues: 'battle-actions',
    title: 'Pick a target',
    text: 'Tap a highlighted enemy. Changed your mind? Cancel, or undo (↶) after acting.',
    when: (ctx) => live(ctx) && ctx.targeting,
  },
  {
    id: 'battle-doom',
    target: '[data-coach="doom"]',
    after: 'battle-actions',
    title: 'Someone is about to fall',
    text: 'This hero drops if you end the round now. Tap ☠ to see who is hitting them, then heal, shield, taunt or kill the threat.',
    sheet: 'closed',
    when: (ctx) => live(ctx) && !ctx.targeting && ctx.doomed.size > 0,
  },
  {
    id: 'battle-end-round',
    target: '[data-coach="end-round"]',
    after: 'battle-actions',
    title: 'End the round',
    text: 'The badge counts heroes who can still act. When you’re done, end the round: summons act, then the horde does what its cards said.',
    when: (ctx) => live(ctx) && !ctx.targeting && heroActed(ctx.state),
  },
  {
    id: 'battle-special',
    target: '[data-coach="special-soon"]',
    after: 'battle-actions',
    title: 'A special is coming',
    text: 'Champions announce their big move a round ahead. Kill or weaken it first, or spend a 💫 Fumble to cancel it.',
    when: (ctx) => live(ctx) && ctx.state.enemies.some((e) => e.alive && !e.asleep && activeSpecial(ctx.state, e) && specialDue(e, ctx.state.round + 1)),
  },
  {
    id: 'battle-fumble',
    target: '[data-coach="fumble"]',
    after: 'battle-actions',
    title: 'Fumbles',
    text: 'Earned from that player’s turnovers. Tap twice to spend one: the enemy loses its next action, specials included.',
    when: (ctx) => live(ctx) && !ctx.targeting && ctx.state.enemies.some((e) => canFumble(ctx.state, e)),
  },
  {
    id: 'battle-trait',
    target: '[data-coach="trait"]',
    after: 'battle-actions',
    title: 'Traits',
    text: 'A Champion whose player had a big night gets a trait, like ✋ Swat for 4+ blocks or 📣 Floor General for 10+ assists. Tap its card to see what the trait does and how to beat it.',
    when: (ctx) => live(ctx) && !ctx.targeting && ctx.state.enemies.some((e) => e.alive && !e.asleep && (e.traits?.length ?? 0) > 0),
  },
  {
    id: 'battle-wave',
    target: '[data-coach="wave"]',
    after: 'battle-end-round',
    title: 'Next wave',
    text: 'Waves arrive on a clock, or as soon as you clear the field, so they can pile up. Finish off the current one if you can.',
    when: (ctx) => {
      const at = nextWaveRound(ctx.state);
      return live(ctx) && at !== null && at - ctx.state.round <= 1;
    },
  },
];

/** The rewards screen after the first battle. */
export const RESULT_TIPS: CoachTip<unknown>[] = [
  {
    id: 'result-rewards',
    target: '[data-coach="rewards"]',
    title: 'Rewards',
    text: 'Each hero earns PP to spend in the 🛠️ Armory; the party earns gold for ten-day contracts and cap room. Next week you choose an encounter again.',
    when: () => true,
  },
];

/** The tip to show now: the first unseen one whose moment has come and whose element is on screen. */
export function pickTip<C>(tips: CoachTip<C>[], ctx: C, unseen: (id: string) => boolean, onScreen: (selector: string) => boolean): CoachTip<C> | undefined {
  return tips.find((t) => unseen(t.id) && (!t.after || !unseen(t.after)) && t.when(ctx) && onScreen(t.target));
}
