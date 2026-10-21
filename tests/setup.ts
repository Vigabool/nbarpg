import { rules } from '../src/rules';

/**
 * Tests assert exact pool, tier and combat math, so they run against fixed tier
 * thresholds (the design doc's originals) rather than whatever calibration
 * last wrote to src/rules/tiers.json. Tuning the live thresholds should never
 * break the engine tests.
 */
rules.tiers.thresholds = {
  wizard: { average: 2, good: 3, great: 4, elite: 6 },
  rogue: { average: 3, good: 6, great: 9, elite: 12 },
  ranger: { average: 10, good: 18, great: 26, elite: 35 },
  warrior: { average: 7, good: 13, great: 18, elite: 24 },
  cleric: { average: 3, good: 6, great: 9, elite: 12 },
};

/** Combat pacing is tuned often; tests check mechanics against these fixed values. */
rules.combat.waveArrivalRounds = [3, 5];
rules.combat.specialEveryNRounds = 3;
rules.combat.warlordEnrage = { atHpFraction: 0.5, damageBonus: 3 };
rules.monsters.ogre.damageByTier = [5, 6, 7, 8, 9];
rules.monsters.warlock.damageByTier = [4, 5, 6, 7, 8];
rules.monsters.hunter.damageByTier = [4, 5, 6, 7, 8];
rules.monsters.assassin.damageByTier = [5, 6, 7, 8, 9];
rules.monsters.shaman.damageByTier = [2, 2, 3, 4, 4];
