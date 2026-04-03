import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HelpTooltip from './HelpTooltip';
import '../styles/SearchInsights.css';

function SearchInsights() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set());

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
        const e = data.quick_stats.engagement || {};
        const z = data.quick_stats.zero_result_terms || {};
        const i = data.quick_stats.issues || {};
        const r = data.quick_stats.revenue_impact || {};
        const a = data.quick_stats.actions_recommended || {};
        
        setReport({
          total_searches: s.total_searches_analyzed || 0,
          total_impressions: s.total_impressions || 0,
          total_clicks: s.total_clicks || 0,
          avg_ctr: s.average_ctr || e.ctr_percentage || '0%',
          avg_clicks_per_search: e.avg_clicks_per_search || '0',
          zero_result_searches: z.total_zero_result_searches || 0,
          zero_result_terms_count: z.zero_result_terms_count || 0,
          top_zero_result_terms: z.top_zero_result_terms || [],
          issues_count: i.total_issues_found || 0,
          critical_count: i.critical_issues || 0,
          lost_revenue: (r.lost_revenue_potential || '₹0').replace('$', '₹'),
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

  const toggleSection = (section) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const handleGenerateSynonyms = (searchTerm) => {
    // Navigate to SynonymPage with the search term as a URL parameter
    navigate(`/ai-synonyms?term=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <div className="search-insights-container">
      <div className="insights-header">
        <h2>📊 Search Analytics Dashboard</h2>
        <p className="insights-subtitle">
          {report.total_searches > 0 
            ? `${report.total_searches} searches analyzed • ${report.avg_ctr} CTR`
            : 'Enable tracking to see insights'}
        </p>
      </div>

      <div className="insights-sections">
        {/* Engagement Metrics Section */}
        <div className="insight-card interactive-card">
          <div 
            className="card-header clickable" 
            onClick={() => toggleSection('engagement')}
          >
            <h3>
              👥 Engagement Metrics
              <HelpTooltip text="How many people searched, clicked on results, and how often they clicked. Higher numbers = more engagement!" position="right" />
            </h3>
            <span className="toggle-icon">{expandedSections.has('engagement') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('engagement') && (
            <div className="card-content expanded">
              <div className="metrics-grid">
                <div className="metric-item">
                  <div className="metric-value">{report.total_impressions.toLocaleString()}</div>
                  <div className="metric-label">
                    Total Impressions
                    <HelpTooltip text="Total number of times someone used the search. Every search = 1 impression." position="bottom" />
                  </div>
                  <div className="metric-desc">Search queries executed</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{report.total_clicks.toLocaleString()}</div>
                  <div className="metric-label">
                    Total Clicks
                    <HelpTooltip text="How many times people clicked on products in search results. Higher = people like the results!" position="bottom" />
                  </div>
                  <div className="metric-desc">Product clicks from results</div>
                </div>
                <div className="metric-item highlight">
                  <div className="metric-value">{report.avg_ctr}</div>
                  <div className="metric-label">
                    Click-Through Rate
                    <HelpTooltip text="Percentage of searches that led to clicks. Example: 5% means 5 out of 100 searches got a click. Higher is better!" position="bottom" />
                  </div>
                  <div className="metric-desc">Clicks per impression</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{report.avg_clicks_per_search}</div>
                  <div className="metric-label">
                    Avg Clicks/Search
                    <HelpTooltip text="Average number of products clicked per search. Like: person searches once, clicks 2 products. Higher = more interest!" position="bottom" />
                  </div>
                  <div className="metric-desc">Average engagement depth</div>
                </div>
              </div>
              <div className="engagement-bar">
                <div className="bar-fill" style={{ width: `${Math.min(parseFloat(report.avg_ctr), 100)}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Zero-Result Searches Section */}
        <div className="insight-card zero-results-card">
          <div 
            className="card-header clickable danger" 
            onClick={() => toggleSection('zero-results')}
          >
            <h3>
              🔴 Zero-Result Searches
              <HelpTooltip text="When someone searches but finds NOTHING. This = lost customers = lost money!" position="right" />
            </h3>
            <span className="toggle-icon">{expandedSections.has('zero-results') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('zero-results') && (
            <div className="card-content expanded">
              <div className="alert-box">
                <p className="alert-text">
                  ⚠️ <strong>{report.zero_result_searches.toLocaleString()}</strong> searches returned no results
                </p>
                <p className="alert-subtext">
                  This represents <strong>{((report.zero_result_searches / report.total_impressions) * 100).toFixed(1)}%</strong> of total searches and 
                  <strong style={{ color: '#dc2626' }}> potentially lost ₹{(report.zero_result_searches * 1000 * 0.3).toLocaleString('en-IN', { maximumFractionDigits: 0 })} in revenue</strong>
                  <HelpTooltip text="If we assume ₹1000 average product price with 30% conversion rate, empty results cost this much money!" position="bottom" />
                </p>
              </div>
              
              {report.top_zero_result_terms && report.top_zero_result_terms.length > 0 ? (
                <div className="zero-terms-list">
                  <h4>
                    Top Zero-Result Search Terms:
                    <HelpTooltip text="Words people search for but can't find products. The solution? Add synonyms!" position="right" />
                  </h4>
                  <table className="terms-table">
                    <thead>
                      <tr>
                        <th>
                          Search Term
                          <HelpTooltip text="What people typed in the search box" position="bottom" />
                        </th>
                        <th>
                          Zero Results
                          <HelpTooltip text="How many times this search found nothing" position="bottom" />
                        </th>
                        <th>
                          Total Searches
                          <HelpTooltip text="Total times people searched for this term" position="bottom" />
                        </th>
                        <th>
                          Rate
                          <HelpTooltip text="Percentage of times this search got no results" position="bottom" />
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.top_zero_result_terms.slice(0, 5).map((term, idx) => (
                        <tr key={idx} className="term-row">
                          <td className="term-name">{term.query}</td>
                          <td className="zero-count">{term.zero_results}</td>
                          <td>{term.total_searches}</td>
                          <td><span className="rate-badge">{term.zero_rate}%</span></td>
                          <td><button className="action-btn" onClick={() => handleGenerateSynonyms(term.query)}>Generate Synonyms →</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="view-all">({report.top_zero_result_terms.length} zero-result terms found)</p>
                </div>
              ) : (
                <p className="no-data">No zero-result searches found. Great job! 🎉</p>
              )}
            </div>
          )}
        </div>

        {/* Issues & Health Section */}
        <div className="insight-card">
          <div 
            className="card-header clickable" 
            onClick={() => toggleSection('issues')}
          >
            <h3>
              🔍 Search Health
              <HelpTooltip text="How well your search is working. Like a health checkup for your search engine!" position="right" />
            </h3>
            <span className="toggle-icon">{expandedSections.has('issues') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('issues') && (
            <div className="card-content expanded">
              <div className="health-indicators">
                <div className="indicator critical">
                  <div className="indicator-value">{report.critical_count}</div>
                  <div className="indicator-label">
                    Critical Issues
                    <HelpTooltip text="Urgent problems that need fixing NOW. Like empty search results or slow performance." position="bottom" />
                  </div>
                </div>
                <div className="indicator warning">
                  <div className="indicator-value">{report.issues_count - report.critical_count}</div>
                  <div className="indicator-label">
                    Other Issues
                    <HelpTooltip text="Less urgent problems that should be fixed soon when you have time." position="bottom" />
                  </div>
                </div>
              </div>
              <p className="issue-summary">
                {report.issues_count > 0 ? 
                  `Found ${report.issues_count} potential improvements in your search experience` :
                  'No major issues detected. Your search is performing well! ✨'
                }
              </p>
            </div>
          )}
        </div>

        {/* Revenue Impact Section */}
        <div className="insight-card revenue-card">
          <div 
            className="card-header clickable" 
            onClick={() => toggleSection('revenue')}
          >
            <h3>
              💰 Revenue Impact
              <HelpTooltip text="Money you're missing because search isn't working well. Fix it = earn it!" position="right" />
            </h3>
            <span className="toggle-icon">{expandedSections.has('revenue') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('revenue') && (
            <div className="card-content expanded">
              <div className="revenue-highlight">
                <div className="revenue-lost">
                  <p className="label">
                    Potential Lost Revenue
                    <HelpTooltip text="Estimated money lost from customers who couldn't find what they wanted" position="bottom" />
                  </p>
                  <p className="amount">{report.lost_revenue}</p>
                  <p className="desc">From {report.searches_at_risk} at-risk searches</p>
                </div>
              </div>
              <div className="recovery-potential">
                <p><strong>💡 Opportunity:</strong> Improve zero-result searches and synonyms to recover lost revenue</p>
              </div>
            </div>
          )}
        </div>

        {/* Recommendations Section */}
        <div className="insight-card action-card">
          <div 
            className="card-header clickable" 
            onClick={() => toggleSection('actions')}
          >
            <h3>
              ⚡ Recommended Actions
              <HelpTooltip text="Things you should do to improve search results and make more money!" position="right" />
            </h3>
            <span className="toggle-icon">{expandedSections.has('actions') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('actions') && (
            <div className="card-content expanded">
              <div className="action-summary">
                <p>
                  <strong>{report.total_actions}</strong> recommended actions
                  <HelpTooltip text="Total number of things to fix or improve" position="bottom" />
                </p>
                <p className="action-urgent">
                  • <strong>{report.immediate_actions}</strong> immediate priority
                  <HelpTooltip text="These are URGENT - do these first!" position="bottom" />
                </p>
                <p className="action-effort">
                  • Total effort: <strong>~{report.effort_hours} hours</strong>
                  <HelpTooltip text="Estimated time to fix all issues" position="bottom" />
                </p>
              </div>
              <p className="action-hint">Go to Synonym Generator to create synonyms for zero-result search terms</p>
            </div>
          )}
        </div>
      </div>

      <div className="cta-section" style={{ marginTop: '20px', textAlign: 'center' }}>
        <button className="cta-button" onClick={fetchAnalytics} style={{
          padding: '10px 20px',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          🔄 Refresh Analytics
        </button>
      </div>

      {report.timestamp && (
        <div className="report-meta" style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#999' }}>
          <small>Last updated: {report.timestamp}</small>
        </div>
      )}
    </div>
  );
}

export default SearchInsights;
