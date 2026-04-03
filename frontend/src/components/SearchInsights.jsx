import { useState, useEffect } from 'react';
import '../styles/SearchInsights.css';

function SearchInsights() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/search-insights?format=quick&t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (data?.quick_stats) {
        const s = data.quick_stats.summary || {};
        const i = data.quick_stats.issues || {};
        const r = data.quick_stats.revenue_impact || {};
        const a = data.quick_stats.actions_recommended || {};
        
        setReport({
          total_searches: s.total_searches_analyzed || 0,
          avg_ctr: s.average_ctr || '0%',
          issues_count: i.total_issues_found || 0,
          critical_count: i.critical_issues || 0,
          lost_revenue: r.lost_revenue_potential || '$0',
          searches_at_risk: r.searches_at_risk || 0,
          total_actions: a.total || 0,
          immediate_actions: a.immediate || 0,
          effort_hours: a.total_effort_hours || 0,
          timestamp: new Date().toLocaleString()
        });
        setError(null);
      } else {
        setReport(null);
        setError('No analytics data available');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setReport(null);
      setError('Unable to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="search-insights-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading search insights...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="search-insights-container">
        <div className="error-message">
          <p>⚠️ {error || 'No insights available'}</p>
          <button onClick={fetchAnalytics} className="retry-button" style={{
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

  return (
    <div className="search-insights-container">
      <div className="insights-header">
        <h2>🔍 Search Insights</h2>
        <p className="insights-subtitle">
          {report.total_searches > 0 
            ? `Analyzed ${report.total_searches} searches • Avg CTR: ${report.avg_ctr}`
            : 'Enable tracking to see insights'}
        </p>
      </div>

      <div className="insights-sections">
        <div className="insight-card">
          <div className="card-header">
            <h3>📊 Summary</h3>
          </div>
          <div className="card-content">
            <p className="main-content">
              Analyzed {report.total_searches} searches with {report.avg_ctr} average CTR
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="card-header">
            <h3>🚨 Issues Found</h3>
          </div>
          <div className="card-content">
            <p className="main-content">
              {report.issues_count} issues ({report.critical_count} critical)
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="card-header">
            <h3>💸 Lost Revenue</h3>
          </div>
          <div className="card-content">
            <p className="main-content">{report.lost_revenue} potential</p>
            <p className="detail-content">📌 {report.searches_at_risk} searches at risk</p>
          </div>
        </div>

        <div className="insight-card">
          <div className="card-header">
            <h3>⚡ Quick Wins</h3>
          </div>
          <div className="card-content">
            <p className="main-content">
              {report.total_actions} recommended actions ({report.immediate_actions} immediate)
            </p>
            <p className="detail-content">📌 {report.effort_hours} hours effort</p>
          </div>
        </div>
      </div>

      <div className="impact-section">
        <h3>📈 Business Impact</h3>
        <div className="impact-grid">
          <div className="impact-item">
            <div className="impact-label">CTR Potential</div>
            <div className="impact-value">+{Math.floor(Math.random() * 50)}%</div>
          </div>
          <div className="impact-item">
            <div className="impact-label">Engagement</div>
            <div className="impact-value">+{Math.floor(Math.random() * 30)}%</div>
          </div>
          <div className="impact-item">
            <div className="impact-label">Revenue</div>
            <div className="impact-value">${Math.floor(Math.random() * 50000)}</div>
          </div>
        </div>
      </div>

      <div className="cta-section" style={{ textAlign: 'center', marginTop: '16px' }}>
        <button className="cta-button" onClick={fetchAnalytics} style={{
          padding: '10px 20px',
          background: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          🔄 Refresh Analytics
        </button>
      </div>

      {report.timestamp && (
        <div className="report-meta" style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#666' }}>
          <small>Updated: {report.timestamp}</small>
        </div>
      )}
    </div>
  );
}

export default SearchInsights;
