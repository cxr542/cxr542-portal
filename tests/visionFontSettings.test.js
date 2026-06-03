import { describe, expect, it } from 'vitest';

const STEP_TO_LEVEL = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const LEVEL_PRESETS = {
  1: { fontSize: 22 },
  5: { fontSize: 38 },
};

function levelFromStep(step) {
  return STEP_TO_LEVEL[step] ?? 3;
}

describe('vision-font settings mapping', () => {
  it('maps early test stop to larger reading level', () => {
    expect(levelFromStep(1)).toBe(5);
    expect(LEVEL_PRESETS[levelFromStep(1)].fontSize).toBe(38);
  });

  it('maps late test stop to smaller reading level', () => {
    expect(levelFromStep(5)).toBe(1);
    expect(LEVEL_PRESETS[levelFromStep(5)].fontSize).toBe(22);
  });
});
