import { describe, expect, it } from 'vitest';
import { summarizeMonthlyDistance } from '../src/utils/marathon';

describe('summarizeMonthlyDistance', () => {
  it('sums only records in the target month', () => {
    const logs = [
      { createdAt: '2026-06-01T10:00:00.000Z', distance: 5.2 },
      { createdAt: '2026-06-03T10:00:00.000Z', distance: 10 },
      { createdAt: '2026-05-30T10:00:00.000Z', distance: 7.5 },
    ];
    const summary = summarizeMonthlyDistance(logs, new Date('2026-06-11T09:00:00.000Z'));
    expect(summary.count).toBe(2);
    expect(summary.totalKm).toBe(15.2);
  });
});
