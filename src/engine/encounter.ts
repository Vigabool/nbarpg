import { rules as defaultRules, type EncounterDef, type MonsterKind, type Rules } from '../rules';

/** Encounter lookup and display names. How a week's encounter is chosen is still to be decided; for now it's the default. */
export function encounterOf(id?: string, rules: Rules = defaultRules): EncounterDef {
  const e = rules.encounters.encounters;
  return e[id ?? rules.encounters.default] ?? e[rules.encounters.default];
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
