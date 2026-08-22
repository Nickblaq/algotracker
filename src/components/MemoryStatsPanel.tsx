import { useMemo } from 'react';
import { MemoryStats, MemoryEntry } from '../types';

interface Props {
  stats: MemoryStats;
  memories: MemoryEntry[];
}

export function MemoryStatsPanel({ stats, memories }: Props) {
  const tierData = useMemo(() => {
    const tiers = ['sensory', 'short_term', 'long_term', 'episodic', 'procedural'] as const;
    return tiers.map(t => ({
      tier: t,
      label: t.replace('_', '-'),
      count: stats.tierCounts[t],
      max: t === 'long_term' ? 100 : t === 'sensory' ? 50 : t === 'episodic' ? 60 : 30,
      avgImportance: memories.filter(m => m.tier === t).reduce((sum, m) => sum + m.importance, 0) / (stats.tierCounts[t] || 1),
    }));
  }, [stats, memories]);

  const recentActivity = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      time: now - (11 - i) * 60000,
      count: 0,
    }));

    memories.forEach(m => {
      const bucketIdx = Math.floor((now - m.createdAt) / 60000);
      if (bucketIdx < 12) {
        buckets[11 - bucketIdx].count++;
      }
    });

    return buckets;
  }, [memories]);

  const maxActivity = Math.max(...recentActivity.map(b => b.count), 1);

  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Memories</span>
          <span className="stat-value">{stats.totalMemories}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Importance</span>
          <span className="stat-value">{(stats.avgImportance * 100).toFixed(1)}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Consolidation Rate</span>
          <span className="stat-value">{(stats.consolidationRate * 100).toFixed(1)}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Utilization</span>
          <span className="stat-value">{(stats.memoryUtilization * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="chart-section">
        <h3>Tier Distribution</h3>
        <div className="tier-bars">
          {tierData.map(t => (
            <div key={t.tier} className="tier-bar-row">
              <span className="tier-bar-label">{t.label}</span>
              <div className="tier-bar-track">
                <div
                  className="tier-bar-fill"
                  style={{
                    width: `${(t.count / t.max) * 100}%`,
                    backgroundColor: `var(--${t.tier.replace('_', '-')})`,
                  }}
                />
              </div>
              <span className="tier-bar-value">{t.count}/{t.max}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <h3>Recent Activity</h3>
        <div className="activity-chart">
          {recentActivity.map((b, i) => (
            <div
              key={i}
              className="activity-bar"
              style={{ height: `${(b.count / maxActivity) * 100}%` }}
              title={`${b.count} memories`}
            />
          ))}
        </div>
        <div className="activity-labels">
          <span>12m ago</span>
          <span>Now</span>
        </div>
      </div>

      <div className="chart-section">
        <h3>Importance Distribution</h3>
        <div className="importance-histogram">
          {Array.from({ length: 10 }, (_, i) => {
            const low = i / 10;
            const high = (i + 1) / 10;
            const count = memories.filter(m => m.importance >= low && m.importance < high).length;
            const maxCount = Math.max(...Array.from({ length: 10 }, (_, j) =>
              memories.filter(m => m.importance >= j / 10 && m.importance < (j + 1) / 10).length
            ), 1);
            return (
              <div key={i} className="importance-bar-col">
                <div
                  className="importance-bar-fill"
                  style={{ height: `${(count / maxCount) * 100}%` }}
                />
                <span className="importance-bar-label">{(high * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
