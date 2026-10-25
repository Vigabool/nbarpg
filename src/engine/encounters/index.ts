import type { Behavior, Rules } from '../../rules';
import type { BattleState } from '../combat';
import { encounterOf } from '../encounter';
import { common } from './common';
import { crypt } from './crypt';
import { dragonLair } from './dragonLair';
import { giantsHall } from './giantsHall';
import { goblinHorde } from './goblinHorde';
import type { BehaviorHandler, Mechanic, SpecialHandler } from './types';

export type { BehaviorHandler, BuffSource, DamageSource, Mechanic, SpecialHandler } from './types';

/**
 * Every encounter mechanic, in the order core combat runs their hooks. To add an encounter:
 * write its module (one or more Mechanics), list it here, and add its data to rules/encounters.json.
 */
export function allMechanics(): Mechanic[] {
  return (registry ??= build()).mechanics;
}

// Built on first use: the modules import core combat, so nothing here may run while modules load.
let registry: { mechanics: Mechanic[]; specials: Record<string, SpecialHandler>; behaviors: Partial<Record<Behavior, BehaviorHandler>> } | undefined;
function build() {
  const mechanics = [...common, ...goblinHorde, ...crypt, ...dragonLair, ...giantsHall];
  return {
    mechanics,
    specials: Object.assign({}, ...mechanics.map((m) => m.specials ?? {})),
    behaviors: Object.assign({}, ...mechanics.map((m) => m.behaviors ?? {})),
  };
}

export const specialHandler = (key: string | undefined): SpecialHandler | undefined => (key ? (registry ??= build()).specials[key] : undefined);
export const behaviorHandler = (b: Behavior): BehaviorHandler | undefined => (registry ??= build()).behaviors[b];

const inPlay = new WeakMap<Rules, Map<string, Mechanic[]>>();

/** The mechanics in play for this battle's encounter (cached per rules object). */
export function mechanicsFor(state: BattleState, rules: Rules): Mechanic[] {
  let byEnc = inPlay.get(rules);
  if (!byEnc) inPlay.set(rules, (byEnc = new Map()));
  const id = state.encounter ?? rules.encounters.default;
  let list = byEnc.get(id);
  if (!list) {
    const enc = encounterOf(id, rules);
    byEnc.set(id, (list = allMechanics().filter((m) => m.appliesTo(enc))));
  }
  return list;
}
