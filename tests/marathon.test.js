import { describe, expect, it } from 'vitest';
import { raceDistanceKm, summarizeMonthlyDistance, summarizeMonthlyRaces } from '../src/utils/marathon';

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

describe('summarizeMonthlyRaces', () => {
  it('counts finished races in the target month by race date', () => {
    const races = [
      { date: '2026-06-01', distance: '10k', status: 'finished' },
      { date: '2026-06-15', distance: 'half', status: 'finished' },
      { date: '2026-05-30', distance: 'full', status: 'finished' },
      { date: '2026-06-20', distance: 'full', status: 'planned' },
    ];
    const summary = summarizeMonthlyRaces(races, new Date('2026-06-11T09:00:00.000Z'));
    expect(summary.count).toBe(2);
    expect(summary.totalKm).toBe(10 + raceDistanceKm('half'));
  });
});
