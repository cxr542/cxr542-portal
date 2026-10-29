import { describe, expect, it } from 'vitest';
import { monthlyRunning, recentRecords } from '../src/utils/workspaceData';
const cloud = data => ({list:namespace=>data[namespace] || []});
describe('workspace account summaries', () => {
  it('counts completed runs and races, excludes planned and other months', () => {
    const data=cloud({'marathon-log':[
      {date:'2026-10-01',recordKind:'run',distanceKm:'6.2'},
      {date:'2026-10-09',distance:'half',status:'finished'},
      {date:'2026-10-15',distance:'full',status:'planned'},
      {date:'2026-09-20',distance:'full',status:'finished'},
      {date:'2026-10-22',distance:'10k',status:'dns'},
    ]});
    const summary=monthlyRunning(data,new Date(2026,9,29));
    expect(summary.count).toBe(2);
    expect(summary.totalKm).toBeCloseTo(27.297);
    expect(summary.weeks[0]).toBe(6.2);
  });
  it('sorts real records across tools without inserting sample content', () => {
    expect(recentRecords(cloud({}))).toEqual([]);
    const rows=recentRecords(cloud({'idea-bank':[{id:'a',title:'idea',createdAt:'2026-10-20'}],'prompt-collection':[{id:'b',title:'prompt',updatedAt:'2026-10-29'}]}));
    expect(rows.map(r=>r.id)).toEqual(['b','a']);
  });
});
