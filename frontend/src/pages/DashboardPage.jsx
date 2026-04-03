import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchInsights from '../components/SearchInsights';
import SearchIntelligence from '../components/SearchIntelligence';
import '../styles/DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [exportFormat, setExportFormat] = useState('json');

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/search-insights/export?format=${format}&t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-insights.${format === 'csv' ? 'csv' : 'json'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>📊 Analytics Dashboard</h1>
          <div className="header-buttons">
            <button 
              className="back-button"
              onClick={() => navigate('/')}
              title="Back to search"
            >
              ← Search
            </button>
            <button 
              className="nav-button"
              onClick={() => navigate('/ai-synonyms')}
              title="Manage synonyms"
            >
              🧠 Synonyms
            </button>
            <button 
              className="nav-button"
              onClick={() => navigate('/settings/thresholds')}
              title="Configure threshold rules"
            >
              ⚙️ Thresholds
            </button>
          </div>
        </div>
        <p className="subtitle">Rule-Based AI Search Intelligence Engine</p>
      </header>

      <main className="dashboard-container">
        {/* Tab Navigation */}
        <div className="dashboard-nav">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📈 Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'intelligence' ? 'active' : ''}`}
            onClick={() => setActiveTab('intelligence')}
          >
            🧠 Intelligence
          </button>
          <button
            className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            💾 Export
          </button>
        </div>

        {/* Tab Content */}
        <div className="dashboard-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>📊 Search Analytics Overview</h2>
                <p className="section-description">Quick summary of search metrics and issues</p>
              </div>
              <SearchInsights />
            </div>
          )}

          {/* Intelligence Tab */}
          {activeTab === 'intelligence' && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>🧠 Search Intelligence Reports</h2>
                <p className="section-description">AI-powered business recommendations and insights</p>
              </div>
              <SearchIntelligence />
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>💾 Export Data</h2>
                <p className="section-description">Download your search analytics in CSV or JSON format</p>
              </div>

              <div className="export-section">
                <div className="export-card">
                  <h3>📋 Quick Export</h3>
                  <p>Download all current analytics data</p>
                  <div className="export-buttons">
                    <button 
                      className="export-button json"
                      onClick={() => handleExport('json')}
                    >
                      📄 JSON
                    </button>
                    <button 
                      className="export-button csv"
                      onClick={() => handleExport('csv')}
                    >
                      📊 CSV
                    </button>
                  </div>
                </div>

                <div className="export-card">
                  <h3>⚙️ API Reference</h3>
                  <p>Access analytics programmatically</p>
                  <code className="api-code">
                    GET /api/search-insights?format=quick|detailed
                  </code>
                  <code className="api-code">
                    GET /api/search-insights/export?format=json|csv
                  </code>
                </div>
              </div>

              <div className="info-box">
                <h4>📌 Cache Management</h4>
                <p>Analytics data is cached for 60 minutes to improve performance.</p>
                <button 
                  className="clear-cache-button"
                  onClick={async () => {
                    try {
                      await fetch('/api/search-insights/cache/clear', { 
                        method: 'POST',
                        headers: { 'Cache-Control': 'no-cache' }
                      });
                      alert('✅ Cache cleared successfully');
                    } catch (error) {
                      alert('❌ Failed to clear cache');
                    }
                  }}
                >
                  🔄 Clear Cache Now
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
