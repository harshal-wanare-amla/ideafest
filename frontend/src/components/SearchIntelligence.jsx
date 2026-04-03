import { useState, useEffect } from 'react';
import '../styles/SearchIntelligence.css';

function SearchIntelligence() {
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchIntelligence();
  }, []);

  const fetchIntelligence = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/search-insights?format=detailed&t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (data?.dashboard) {
        const d = data.dashboard;
        const s = d.summary || {};
        const g = d.grouped || {};
        
        const critical = g.critical?.length || 0;
        const high = g.high?.length || 0;
        
        setIntelligence({
          main: critical > 0 ? '🚨 Critical Issues' : '✅ All Good',
          sub: `${critical + high} opportunities found`,
          urgency: critical > 0 ? 'high' : 'normal',
          summary: [
            `Found ${critical} critical and ${high} high-priority opportunities`,
            `${s.total_issues_found || 0} total issues to address`,
            `Revenue at risk: ${s.lost_revenue || '$0'}`,
            `Recommended actions: ${critical + high}`
          ],
          metrics: {
            success_rate: s.overall_success_rate || '0%',
            avg_ctr: s.avg_ctr || '0%',
            total_searches: s.total_queries_analyzed || 0,
            lost_revenue: s.lost_revenue || '$0'
          },
          recommendations: {
            critical: g.critical || [],
            high: g.high || [],
            medium: g.medium || [],
            low: g.low || []
          },
          timestamp: new Date().toLocaleString()
        });
        setError(null);
      } else {
        setIntelligence(null);
        setError('No data available');
      }
    } catch (err) {
      console.error('Error fetching intelligence:', err);
      setIntelligence(null);
      setError('Unable to load intelligence');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="search-intelligence-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <div className="search-intelligence-container">
        <div className="error-message">
          <p>⚠️ {error || 'No data'}</p>
          <button onClick={fetchIntelligence} style={{
            padding: '8px 16px',
            background: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '8px'
          }}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const i = intelligence;

  return (
    <div className="search-intelligence-container">
      <div className="intelligence-header">
        <h1>🧠 Search Intelligence</h1>
        <p className="subtitle">AI-powered recommendations</p>
        
        <div className={`cta-banner urgency-${i.urgency}`}>
          <h3>{i.main}</h3>
          <p>{i.sub}</p>
        </div>
      </div>

      <div className="executive-summary">
        <h2>📈 Summary</h2>
        <div className="summary-bullets">
          {i.summary?.map((bullet, idx) => (
            <div key={idx} className="summary-item"><p>{bullet}</p></div>
          ))}
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab ${activeTab === 'critical' ? 'active' : ''}`}
          onClick={() => setActiveTab('critical')}
        >
          🚨 Critical ({i.recommendations?.critical?.length || 0})
        </button>
        <button 
          className={`tab ${activeTab === 'high' ? 'active' : ''}`}
          onClick={() => setActiveTab('high')}
        >
          ⚠️ High ({i.recommendations?.high?.length || 0})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <h2>Metrics</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.success_rate}</div>
                <div className="metric-label">Success Rate</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.avg_ctr}</div>
                <div className="metric-label">Avg CTR</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.total_searches}</div>
                <div className="metric-label">Total Searches</div>
              </div>
              <div className="metric-card danger">
                <div className="metric-value">{i.metrics?.lost_revenue}</div>
                <div className="metric-label">Lost Revenue</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'critical' && (
          <div className="tab-pane">
            <h2>Critical Issues</h2>
            <div className="recommendations-list">
              {i.recommendations?.critical?.length > 0 ? (
                i.recommendations.critical.slice(0, 5).map((rec, idx) => (
                  <div key={idx} className="recommendation-item">
                    <p>{rec.problem_title || rec.title || 'Issue ' + (idx + 1)}</p>
                  </div>
                ))
              ) : (
                <p style={{padding: '16px', color: '#666'}}>No critical issues found</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'high' && (
          <div className="tab-pane">
            <h2>High Priority</h2>
            <div className="recommendations-list">
              {i.recommendations?.high?.length > 0 ? (
                i.recommendations.high.slice(0, 5).map((rec, idx) => (
                  <div key={idx} className="recommendation-item">
                    <p>{rec.problem_title || rec.title || 'Issue ' + (idx + 1)}</p>
                  </div>
                ))
              ) : (
                <p style={{padding: '16px', color: '#666'}}>No high priority issues</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{textAlign: 'center', marginTop: '16px'}}>
        <button onClick={fetchIntelligence} style={{
          padding: '10px 20px',
          background: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          🔄 Refresh
        </button>
      </div>

      {i.timestamp && (
        <div style={{textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#666'}}>
          <small>Updated: {i.timestamp}</small>
        </div>
      )}
    </div>
  );
}

export default SearchIntelligence;
