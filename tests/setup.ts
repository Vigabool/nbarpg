import { rules } from '../src/rules';

/**
 * Tests assert exact pool and tier math, so they run against fixed tier
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
