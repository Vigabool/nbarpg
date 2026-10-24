import { rules as defaultRules, type Behavior, type EncounterDef, type MonsterKind, type Rules, type Twist } from '../rules';

/** Encounter lookup and display names. How a week's encounter is chosen is still to be decided; for now it's the default. */
export function encounterOf(id?: string, rules: Rules = defaultRules): EncounterDef {
  const e = rules.encounters.encounters;
  return e[id ?? rules.encounters.default] ?? e[rules.encounters.default];
}

export function encounterIds(rules: Rules = defaultRules): string[] {
  return Object.keys(rules.encounters.encounters);
}

export function hasTwist(twist: Twist, encounter?: string, rules: Rules = defaultRules): boolean {
  return encounterOf(encounter, rules).twists.includes(twist);
}

export function monsterName(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): string {
  return encounterOf(encounter, rules).monsters[kind]?.name ?? rules.monsters[kind].name;
}

export function monsterShort(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): string {
  return encounterOf(encounter, rules).monsters[kind]?.short ?? rules.monsters[kind].name;
}

export function monsterIcon(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): string {
  return encounterOf(encounter, rules).monsters[kind]?.icon ?? '❔';
}

export function isGoblinKin(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): boolean {
  return encounterOf(encounter, rules).goblinKin.includes(kind);
}

/** The behavior a monster kind uses in this encounter. */
export function behaviorOf(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): Behavior {
  return encounterOf(encounter, rules).monsters[kind]?.behavior ?? rules.monsters[kind].behavior;
}

export function monsterDescription(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): string {
  return encounterOf(encounter, rules).monsters[kind]?.description ?? rules.monsters[kind].description;
}

export interface SpecialInfo {
  key: string;
  name: string;
  short: string;
  description: string;
}

/** The special a monster kind uses in this encounter, with any encounter renaming. */
export function specialFor(kind: MonsterKind, encounter?: string, rules: Rules = defaultRules): SpecialInfo | null {
  const ov = encounterOf(encounter, rules).monsters[kind];
  const key = ov?.special ?? behaviorOf(kind, encounter, rules);
  const base = (rules.combat.specials as Record<string, { name: string; short: string; description: string } | undefined>)[key];
  if (!base) return null;
  return { key, name: ov?.specialName ?? base.name, short: ov?.specialShort ?? base.short, description: base.description };
}
