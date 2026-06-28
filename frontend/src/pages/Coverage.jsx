import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Layers, ListTree, Repeat, Shuffle } from 'lucide-react';

export default function Coverage() {
  const { project, phase, component } = useOutletContext();

  const dataModifier = (project.name.length * phase.length * component.length) % 15;
  const overallCov = Math.min(99.5, 75 + dataModifier + (project.id === 'p1' ? 10 : 0));
  
  const metrics = useMemo(() => [
    { name: 'Line Coverage', icon: Layers, val: Math.min(100, overallCov + 2.1) },
    { name: 'Toggle Coverage', icon: Repeat, val: overallCov - 4.5 },
    { name: 'FSM Coverage', icon: ListTree, val: Math.min(100, overallCov + 6.3) },
    { name: 'Condition Coverage', icon: Shuffle, val: overallCov - 1.2 }
  ], [overallCov]);

  const pieData = [
    { name: 'Covered', value: overallCov },
    { name: 'Missed', value: 100 - overallCov }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
        VCS Coverage metrics for <strong style={{color: 'var(--text-primary)'}}>{project.name}</strong> • Phase: <span className="badge badge-blue">{phase}</span> • Component: <span className="badge badge-blue">{component}</span>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 2fr)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="card-title" style={{ width: '100%', marginBottom: '20px' }}>Total Overall Coverage</h3>
          <div style={{ width: '220px', height: '220px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="var(--success-color)" />
                  <Cell fill="var(--bg-color-tertiary)" />
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{overallCov.toFixed(1)}%</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>VCS Urg</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginTop: '16px' }}>
            Merged base coverage from recent active regression runs over designated test suites.
          </p>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Detailed Coverage Blocks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {metrics.map((m, idx) => {
               const val = Math.max(0, m.val).toFixed(2);
               const Icon = m.icon;
               return (
                 <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-color-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                     <Icon size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                       <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.name}</span>
                       <span style={{ fontWeight: 600, color: val >= 90 ? 'var(--success-color)' : (val >= 75 ? 'var(--warning-color)' : 'var(--error-color)') }}>{val}%</span>
                     </div>
                     <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-color-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                       <div style={{ width: `${val}%`, height: '100%', backgroundColor: val >= 90 ? 'var(--success-color)' : (val >= 75 ? 'var(--warning-color)' : 'var(--error-color)') }}></div>
                     </div>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
