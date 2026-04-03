import { useState, useEffect } from 'react';
import HelpTooltip from './HelpTooltip';
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
      const response = await fetch(`/search/intelligence?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Debug: Log the response structure
      console.log('📊 Intelligence API Response:', data);

      // Extract intelligence report (can be nested under 'intelligence' or root level)
      const report = data?.intelligence || data;
      
      if (!report) {
        throw new Error('No report data in response');
      }

      // Get grouped recommendations (should be structured by priority)
      const grouped = report.grouped || {};
      
      // Fallback: if grouped doesn't exist, group them from recommendations array
      const critical = grouped.critical || report.recommendations?.filter(r => r.priority === 'Critical' || r.priority === 'CRITICAL') || [];
      const high = grouped.high || report.recommendations?.filter(r => r.priority === 'High' || r.priority === 'HIGH') || [];
      const medium = grouped.medium || report.recommendations?.filter(r => r.priority === 'Medium' || r.priority === 'MEDIUM') || [];
      const low = grouped.low || report.recommendations?.filter(r => r.priority === 'Low' || r.priority === 'LOW') || [];
      
      // Extract quick wins from detailed reports
      const quickWins = report.detailedReports?.quickWinsReport?.quickWins || [];
      
      const hasIssues = critical.length + high.length > 0;
      
      setIntelligence({
        main: hasIssues ? '🚨 Critical Issues Found' : '✅ All Good',
        sub: `${critical.length + high.length} opportunities found`,
        urgency: hasIssues ? 'high' : 'normal',
        summary: report.executiveSummary || [
          `Found ${critical.length} critical and ${high.length} high-priority opportunities`,
          `${report.keyProblems?.length || 0} total issues to address`,
          `Revenue at risk: ₹${(report.metricsSnapshot?.lost_opportunities || 0).toLocaleString('en-IN')}`,
          `Recommended actions: ${critical.length + high.length}`
        ],
        metrics: {
          success_rate: report.metricsSnapshot?.success_rate || '0%',
          avg_ctr: report.metricsSnapshot?.avg_ctr || '0%',
          total_searches: report.dataPoints || 0,
          lost_revenue: `₹${(report.metricsSnapshot?.lost_opportunities || 0).toLocaleString('en-IN')}`
        },
        recommendations: {
          critical: critical,
          high: high,
          medium: medium,
          low: low
        },
        quickWins: quickWins,
        timestamp: new Date().toLocaleString()
      });
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching intelligence:', err);
      setIntelligence(null);
      setError(err.message || 'Unable to load intelligence');
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
        <h1>
          🧠 Search Intelligence
          <HelpTooltip text="Smart AI analysis of your search. It finds problems and tells you how to fix them!" position="right" />
        </h1>
        <p className="subtitle">AI-powered recommendations</p>
        
        <div className={`cta-banner urgency-${i.urgency}`}>
          <h3>{i.main}</h3>
          <p>{i.sub}</p>
        </div>
      </div>

      <div className="executive-summary">
        <h2>
          📈 Summary
          <HelpTooltip text="Quick overview of the most important information" position="right" />
        </h2>
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
          className={`tab ${activeTab === 'quickwins' ? 'active' : ''}`}
          onClick={() => setActiveTab('quickwins')}
          title="Quick fixes to boost search performance"
        >
          ⚡ Quick Wins ({i.quickWins?.length || 0})
          <HelpTooltip text="Easy fixes that can boost search performance in 1-2 hours!" position="bottom" />
        </button>
        <button 
          className={`tab ${activeTab === 'critical' ? 'active' : ''}`}
          onClick={() => setActiveTab('critical')}
          title="Urgent problems that need instant fixing"
        >
          🚨 Critical ({i.recommendations?.critical?.length || 0})
          <HelpTooltip text="URGENT: Fix these first! Problems that seriously hurt your search." position="bottom" />
        </button>
        <button 
          className={`tab ${activeTab === 'high' ? 'active' : ''}`}
          onClick={() => setActiveTab('high')}
          title="Important issues to fix soon"
        >
          ⚠️ High ({i.recommendations?.high?.length || 0})
          <HelpTooltip text="Important but not super urgent. Fix after critical issues." position="bottom" />
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <h2>Metrics</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.success_rate}</div>
                <div className="metric-label">
                  Success Rate
                  <HelpTooltip text="Percentage of searches that found good results. Higher is better! 90% = 9 out of 10 searches work well." position="bottom" />
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.avg_ctr}</div>
                <div className="metric-label">
                  Avg CTR
                  <HelpTooltip text="Average percent of people who click on results after searching. Like your search's 'like' rating!" position="bottom" />
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{i.metrics?.total_searches}</div>
                <div className="metric-label">
                  Total Searches
                  <HelpTooltip text="How many searches have been done in total. More = more data = better AI" position="bottom" />
                </div>
              </div>
              <div className="metric-card danger">
                <div className="metric-value">{i.metrics?.lost_revenue}</div>
                <div className="metric-label">
                  Lost Revenue
                  <HelpTooltip text="Money you could have earned if search worked perfectly. Fix = earn!" position="bottom" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quickwins' && (
          <div className="tab-pane">
            <h2>
              ⚡ Quick Wins ({i.quickWins?.length || 0} Critical Issues)
              <HelpTooltip text="Easy-to-implement solutions that will boost search performance quickly. These typically take 1-2 hours to fix." position="right" />
            </h2>
            <div className="quick-wins-list">
              {i.quickWins?.length > 0 ? (
                i.quickWins.map((win, idx) => (
                  <div key={idx} className="quick-win-card">
                    <div className="win-header">
                      <span className="win-number">#{idx + 1}</span>
                      <h3>{win.query}</h3>
                      <span className={`severity-badge ${win.severity?.toLowerCase()}`}>{win.severity}</span>
                    </div>
                    <div className="win-body">
                      <div className="win-row">
                        <strong>Problem:</strong> {win.problemType}
                      </div>
                      <div className="win-row">
                        <strong>Issue:</strong> {win.action}
                      </div>
                      <div className="win-row">
                        <strong>Solution:</strong> {win.suggestedFix}
                      </div>
                      <div className="win-row">
                        <strong>Impact:</strong> <span className="impact-text">{win.impact}</span>
                      </div>
                      <div className="win-row">
                        <strong>Effort:</strong> <span className="effort-badge">{win.effort}</span>
                      </div>
                      <div className="win-row">
                        <strong>Search Volume:</strong> {win.searches} searches
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{padding: '16px', color: '#666'}}>No quick wins found. Your search is performing well!</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'critical' && (
          <div className="tab-pane">
            <h2>
              Critical Issues
              <HelpTooltip text="Do these RIGHT NOW! These problems are costing you real money." position="right" />
            </h2>
            <div className="recommendations-list">
              {i.recommendations?.critical?.length > 0 ? (
                i.recommendations.critical.map((rec, idx) => (
                  <div key={idx} className="recommendation-card">
                    <div className="rec-header">
                      <h4>{rec.title || rec.problem_title || 'Issue ' + (idx + 1)}</h4>
                      <span className="priority-badge critical">🚨 Critical</span>
                    </div>
                    <div className="rec-body">
                      {rec.description && <p><strong>Description:</strong> {rec.description}</p>}
                      {rec.affectedQueries && <p><strong>Affected Queries:</strong> {rec.affectedQueries}</p>}
                      {rec.estimatedImpact && <p><strong>Impact:</strong> {rec.estimatedImpact}</p>}
                      {rec.effort && <p><strong>Effort:</strong> {rec.effort}</p>}
                    </div>
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
            <h2>
              High Priority
              <HelpTooltip text="Important issues to fix soon. These are slowing down your growth." position="right" />
            </h2>
            <div className="recommendations-list">
              {i.recommendations?.high?.length > 0 ? (
                i.recommendations.high.map((rec, idx) => (
                  <div key={idx} className="recommendation-card">
                    <div className="rec-header">
                      <h4>{rec.title || rec.problem_title || 'Issue ' + (idx + 1)}</h4>
                      <span className="priority-badge high">⚠️ High</span>
                    </div>
                    <div className="rec-body">
                      {rec.description && <p><strong>Description:</strong> {rec.description}</p>}
                      {rec.affectedQueries && <p><strong>Affected Queries:</strong> {rec.affectedQueries}</p>}
                      {rec.estimatedImpact && <p><strong>Impact:</strong> {rec.estimatedImpact}</p>}
                      {rec.effort && <p><strong>Effort:</strong> {rec.effort}</p>}
                    </div>
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
