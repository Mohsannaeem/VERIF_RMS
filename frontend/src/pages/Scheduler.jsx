import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, Clock, GitBranch } from 'lucide-react';

function Scheduler() {
  const { project, phase } = useOutletContext();
  const [schedules, setSchedules] = useState([
    { id: '1', module: 'Nightly Full SoC Regression', frequency: 'Daily at 00:00 UTC', branch: 'main' },
    { id: '2', module: 'Cache Unit Quick Regression', frequency: 'On every PR merge', branch: 'feature/*' }
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('External integration API called to schedule regression!');
  };

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(400px, 1fr) minmax(300px, 1fr)' }}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Schedule New Regression in {project.name} ({phase})</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Target Module / Test Suite</label>
            <select className="form-control" required>
              <option value="">Select a module...</option>
              <option value="soc">Full SoC Regression</option>
              <option value="alu">ALU Cluster</option>
              <option value="cache">L2 Cache Subsystem</option>
              <option value="mmu">Memory Management Unit</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Branch / Revision</label>
              <div style={{ position: 'relative' }}>
                <GitBranch size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
                <input type="text" className="form-control" style={{ paddingLeft: '36px' }} placeholder="main" defaultValue="main" />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Schedule Type</label>
              <select className="form-control">
                <option value="cron">CRON Schedule</option>
                <option value="webhook">Webhook / Pipeline Trigger</option>
                <option value="polling">VCS Polling</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Timing (Cron Expression / Rules)</label>
              <input type="text" className="form-control" placeholder="0 0 * * *" defaultValue="0 0 * * *" />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Schedule</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Active Schedules</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schedules.map(s => (
            <div key={s.id} style={{ padding: '16px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.module}</span>
                <span className="badge badge-blue">Active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>
                <Clock size={14} /> {s.frequency}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <GitBranch size={14} /> {s.branch}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Scheduler;
