import { useState, useEffect } from 'react';
import '../styles/ThresholdSettings.css';

function ThresholdSettings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editedRules, setEditedRules] = useState({});
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterMetric, setFilterMetric] = useState('ALL');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rules/config?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (data?.rules) {
        setRules(data.rules);
        setEditedRules({});
        setError(null);
      } else {
        setError('No rules data available');
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError('Failed to load threshold rules');
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = (ruleId, field, value) => {
    setEditedRules(prev => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId],
        [field]: value
      }
    }));
  };

  const handleToggleRule = (ruleId) => {
    const rule = rules.find(r => r.rule_id === ruleId);
    handleRuleChange(ruleId, 'enabled', !rule.enabled);
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      
      const updatedRules = rules.map(rule => {
        if (editedRules[rule.rule_id]) {
          return { ...rule, ...editedRules[rule.rule_id] };
        }
        return rule;
      });

      const response = await fetch('/api/rules/config', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ rules: updatedRules })
      });

      if (response.ok) {
        setRules(updatedRules);
        setEditedRules({});
        setSuccessMessage('✅ Threshold rules updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to save rules');
      }
    } catch (err) {
      console.error('Error saving rules:', err);
      setError('Unable to save threshold rules');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => {
    setEditedRules({});
    setSuccessMessage('');
    setError(null);
  };

  const filteredRules = rules.filter(rule => {
    if (filterPriority !== 'ALL' && rule.priority !== filterPriority) return false;
    if (filterMetric !== 'ALL' && rule.metric !== filterMetric) return false;
    return true;
  });

  const hasChanges = Object.keys(editedRules).length > 0;
  const metrics = [...new Set(rules.map(r => r.metric))].sort();
  const priorities = ['HIGH', 'MEDIUM', 'LOW'];

  if (loading) {
    return (
      <div className="threshold-settings">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading threshold rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="threshold-settings">
      <div className="settings-header">
        <h1>⚙️ Threshold Configuration</h1>
        <p className="subtitle">Adjust rule thresholds and settings for search intelligence</p>
      </div>

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={fetchRules} className="retry-btn">🔄 Retry</button>
        </div>
      )}

      <div className="settings-controls">
        <div className="filter-group">
          <label>Priority Filter:</label>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="ALL">All Priorities</option>
            {priorities.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Metric Filter:</label>
          <select value={filterMetric} onChange={(e) => setFilterMetric(e.target.value)}>
            <option value="ALL">All Metrics</option>
            {metrics.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="control-buttons">
          {hasChanges && (
            <>
              <button onClick={handleSaveChanges} className="btn-save" disabled={saving}>
                {saving ? '💾 Saving...' : '💾 Save Changes'}
              </button>
              <button onClick={handleResetChanges} className="btn-reset">
                ↩️ Reset
              </button>
            </>
          )}
          <button onClick={fetchRules} className="btn-refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="rules-container">
        <div className="rules-summary">
          <p>Showing {filteredRules.length} of {rules.length} rules</p>
        </div>

        {filteredRules.length === 0 ? (
          <div className="no-rules">
            <p>No rules match the selected filters</p>
          </div>
        ) : (
          <div className="rules-grid">
            {filteredRules.map(rule => {
              const isEdited = editedRules[rule.rule_id];
              const currentValues = isEdited ? { ...rule, ...editedRules[rule.rule_id] } : rule;

              return (
                <div key={rule.rule_id} className={`rule-card ${isEdited ? 'edited' : ''} priority-${rule.priority.toLowerCase()}`}>
                  <div className="rule-header">
                    <div className="rule-title-section">
                      <h3>{rule.rule_name}</h3>
                      <span className={`priority-badge priority-${rule.priority.toLowerCase()}`}>
                        {rule.priority}
                      </span>
                      <span className={`status-badge ${currentValues.enabled ? 'enabled' : 'disabled'}`}>
                        {currentValues.enabled ? '✓ Active' : '⊘ Inactive'}
                      </span>
                    </div>
                    <button 
                      className="toggle-enabled"
                      onClick={() => handleToggleRule(rule.rule_id)}
                      title={currentValues.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {currentValues.enabled ? '🔔' : '🔕'}
                    </button>
                  </div>

                  <p className="rule-description">{rule.description}</p>

                  <div className="rule-details">
                    <div className="detail-row">
                      <label>Metric:</label>
                      <span className="metric-tag">{rule.metric}</span>
                    </div>

                    <div className="detail-row">
                      <label>Operator:</label>
                      <span className="operator">{rule.operator}</span>
                    </div>

                    <div className="detail-row">
                      <label>Threshold Value:</label>
                      <input
                        type="number"
                        value={currentValues.threshold}
                        onChange={(e) => handleRuleChange(rule.rule_id, 'threshold', parseFloat(e.target.value))}
                        step={typeof rule.threshold === 'number' && rule.threshold < 1 ? '0.01' : '1'}
                        className={isEdited?.threshold !== undefined ? 'input-changed' : ''}
                      />
                    </div>

                    <div className="detail-row">
                      <label>Minimum Searches:</label>
                      <input
                        type="number"
                        value={currentValues.min_searches}
                        onChange={(e) => handleRuleChange(rule.rule_id, 'min_searches', parseInt(e.target.value))}
                        className={isEdited?.min_searches !== undefined ? 'input-changed' : ''}
                      />
                    </div>

                    <div className="detail-row">
                      <label>Revenue Multiplier:</label>
                      <input
                        type="number"
                        value={currentValues.revenue_multiplier || 0}
                        onChange={(e) => handleRuleChange(rule.rule_id, 'revenue_multiplier', parseFloat(e.target.value))}
                        step="10"
                        className={isEdited?.revenue_multiplier !== undefined ? 'input-changed' : ''}
                      />
                    </div>

                    <div className="detail-row">
                      <label>Action Type:</label>
                      <select
                        value={currentValues.action_type}
                        onChange={(e) => handleRuleChange(rule.rule_id, 'action_type', e.target.value)}
                        className={isEdited?.action_type !== undefined ? 'input-changed' : ''}
                      >
                        <option value="ADD_TO_INVENTORY">Add to Inventory</option>
                        <option value="IMPROVE_RANKING">Improve Ranking</option>
                        <option value="ADD_FILTERS_IMPROVE_RELEVANCE">Add Filters & Improve Relevance</option>
                        <option value="FIX_RANKING_ALGORITHM">Fix Ranking Algorithm</option>
                        <option value="MAINTAIN_EXCELLENCE">Maintain Excellence</option>
                        <option value="EXPAND_CATALOG_OR_FEATURE">Expand Catalog or Feature</option>
                        <option value="EXPAND_INVENTORY">Expand Inventory</option>
                      </select>
                    </div>

                    <div className="detail-row">
                      <label>Rule ID:</label>
                      <code>{rule.rule_id}</code>
                    </div>
                  </div>

                  {isEdited && (
                    <div className="rule-changes">
                      <p className="changes-indicator">📝 This rule has unsaved changes</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="floating-action">
          <button onClick={handleSaveChanges} className="btn-save-main" disabled={saving}>
            {saving ? '💾 Saving...' : '💾 Save All Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ThresholdSettings;
