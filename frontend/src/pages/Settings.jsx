import React from 'react';
import { Mail, MessageSquare, Webhook, Key } from 'lucide-react';

function Settings() {
  const saveSettings = (e) => {
    e.preventDefault();
    alert('Integrations configuration saved!');
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card-header">
        <h3 className="card-title">Integrations & External Tools</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>
        Configure external systems used to dispatch tests, pull source changes, and notify stakeholders of consolidated project closure metrics and run completions.
      </p>

      <form onSubmit={saveSettings}>
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            <Key size={18} /> CI/CD Automation Engine
          </h4>
          <div className="form-group">
            <label className="form-label">Execution Host URL (Jenkins / GitHub Actions)</label>
            <input type="text" className="form-control" defaultValue="https://ci.internal.company.com/job/regression" />
          </div>
          <div className="form-group">
            <label className="form-label">API Access Token</label>
            <input type="password" className="form-control" defaultValue="************************" />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0' }}></div>

        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            <MessageSquare size={18} /> Slack / Teams Notifications
          </h4>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Incoming Webhook URL</label>
              <input type="text" className="form-control" placeholder="https://hooks.slack.com/services/..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notify On</label>
              <select className="form-control">
                <option>Only Failures</option>
                <option>All Completions</option>
                <option>Never</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0' }}></div>

        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            <Mail size={18} /> Project Closure Reports
          </h4>
          <div className="form-group">
            <label className="form-label">Email Distribution List</label>
            <input type="text" className="form-control" defaultValue="verification-team@company.com" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Consolidated test results will be attached as PDF to this distribution list upon scheduled closure.
            </span>
          </div>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">Save Integrations</button>
        </div>
      </form>
    </div>
  );
}

export default Settings;
