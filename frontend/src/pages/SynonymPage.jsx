import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SynonymPage.css';

function SynonymPage() {
  const navigate = useNavigate();
  
  // State management
  const [keywords, setKeywords] = useState([]);
  const [manualKeywords, setManualKeywords] = useState('');
  const [synonyms, setSynonyms] = useState([]);
  const [editableSynonyms, setEditableSynonyms] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState('keywords'); // keywords, generate, edit, apply
  const [useManualInput, setUseManualInput] = useState(false);
  const [selectedField, setSelectedField] = useState('name');
  const [selectedSize, setSelectedSize] = useState(20);

  // Extract keywords from Elasticsearch
  const handleExtractKeywords = async () => {
    try {
      setLoading(true);
      setMessage(`Extracting keywords from "${selectedField}" field...`);

      console.log(`🔍 Fetching keywords - Field: "${selectedField}", Size: ${selectedSize}`);
      const response = await fetch(`/keywords?field=${selectedField}&size=${selectedSize}`);
      const data = await response.json();

      console.log('📋 Keywords response:', data);

      if (data.success) {
        setKeywords(data.keywords);
        setMessage(`✅ Extracted ${data.count} keywords from "${selectedField}"`);
        console.log(`✅ Successfully extracted ${data.count} keywords`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.error}`);
        console.error('❌ Error:', data.error);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      console.error('❌ Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Remove keyword from list
  const handleRemoveKeyword = (indexToRemove) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  // Remove manual keyword from textarea
  const handleRemoveManualKeyword = (indexToRemove) => {
    const keywordArray = manualKeywords
      .split(',')
      .map(k => k.trim())
      .filter((k, idx) => k.length > 0 && idx !== indexToRemove);
    setManualKeywords(keywordArray.join(', '));
  };

  // Generate synonyms using Gemini
  const handleGenerateSynonyms = async () => {
    try {
      setLoading(true);
      setMessage('Generating synonyms with AI...');

      // Get keywords from manual input or extracted keywords
      const keywordsToUse = useManualInput
        ? manualKeywords
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0)
        : keywords;

      if (keywordsToUse.length === 0) {
        setMessage('❌ Please enter or extract keywords first');
        setLoading(false);
        return;
      }

      const response = await fetch('/generate-synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsToUse.slice(0, 20) }),
      });

      const data = await response.json();

      if (data.success) {
        setSynonyms(data.synonyms);
        setEditableSynonyms(data.synonyms.join('\n'));
        setStep('edit');
        setMessage(`✅ Generated ${data.count} synonym rules`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.error}: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update synonyms in Elasticsearch
  const handleUpdateSynonyms = async () => {
    try {
      setLoading(true);
      setMessage('Updating Elasticsearch synonyms...');

      // Parse edited synonyms
      const synonymLines = editableSynonyms
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (synonymLines.length === 0) {
        setMessage('❌ No synonyms to apply');
        setLoading(false);
        return;
      }

      const response = await fetch('/update-synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synonyms: synonymLines }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ ${data.message}`);
        setStep('apply');
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage(`❌ ${data.error}: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render keywords section
  const renderKeywordsSection = () => (
    <div className="section keywords-section">
      <h2>📚 Step 1: Get Keywords</h2>
      
      <div className="tab-buttons">
        <button
          className={`tab-btn ${!useManualInput ? 'active' : ''}`}
          onClick={() => setUseManualInput(false)}
        >
          Extract from Elasticsearch
        </button>
        <button
          className={`tab-btn ${useManualInput ? 'active' : ''}`}
          onClick={() => setUseManualInput(true)}
        >
          Manual Input
        </button>
      </div>

      {!useManualInput ? (
        <div className="extract-keywords">
          <p>Extract top keywords from your product database</p>
          
          <div className="extraction-options">
            <div className="option-group">
              <label htmlFor="field-select">Field:</label>
              <select 
                id="field-select"
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                disabled={loading}
              >
                <option value="name">Product Name</option>
                <option value="description">Description</option>
              </select>
            </div>

            <div className="option-group">
              <label htmlFor="size-select">Number of Keywords:</label>
              <select 
                id="size-select"
                value={selectedSize}
                onChange={(e) => setSelectedSize(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <button
            className="action-btn primary"
            onClick={handleExtractKeywords}
            disabled={loading}
          >
            {loading ? '⏳ Extracting...' : '🔍 Extract Keywords'}
          </button>

          {keywords.length > 0 && (
            <div className="keywords-list">
              <h3>Extracted Keywords ({keywords.length}) from "{selectedField}":</h3>
              <div className="keyword-tags">
                {keywords.map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">
                    <span className="keyword-text">{keyword}</span>
                    <button
                      className="keyword-remove-btn"
                      onClick={() => handleRemoveKeyword(idx)}
                      title="Remove this keyword"
                      type="button"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="manual-keywords">
          <p>Enter keywords separated by commas (max 20):</p>
          <textarea
            value={manualKeywords}
            onChange={(e) => setManualKeywords(e.target.value)}
            placeholder="backpack, handbag, sling bag, crossbody, tote"
            rows="4"
            className="textarea"
          />
          <small>
            {manualKeywords.split(',').filter(k => k.trim()).length} / 20 keywords
          </small>
        </div>
      )}

      {(keywords.length > 0 || manualKeywords.trim().length > 0) && (
        <button
          className="action-btn primary next-btn"
          onClick={() => setStep('generate')}
        >
          Next: Generate Synonyms →
        </button>
      )}
    </div>
  );

  // Render generate section
  const renderGenerateSection = () => (
    <div className="section generate-section">
      <h2>🧠 Step 2: Generate Synonyms</h2>
      
      <div className="keywords-preview">
        <h3>Selected Keywords:</h3>
        <div className="keyword-tags">
          {(useManualInput
            ? manualKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0)
            : keywords
          ).map((keyword, idx) => (
            <span key={idx} className="keyword-tag">
              <span className="keyword-text">{keyword}</span>
              <button
                className="keyword-remove-btn"
                onClick={() => useManualInput ? handleRemoveManualKeyword(idx) : handleRemoveKeyword(idx)}
                title="Remove this keyword"
                type="button"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <p>Using Google Gemini AI to generate relevant synonyms...</p>
      <button
        className="action-btn primary"
        onClick={handleGenerateSynonyms}
        disabled={loading}
      >
        {loading ? '⏳ Generating Synonyms...' : '✨ Generate Synonyms'}
      </button>

      <button
        className="action-btn secondary"
        onClick={() => setStep('keywords')}
      >
        ← Back
      </button>
    </div>
  );

  // Render edit section
  const renderEditSection = () => (
    <div className="section edit-section">
      <h2>✏️ Step 3: Edit Synonyms</h2>
      
      <div className="edit-instructions">
        <p>Review and edit the generated synonyms. Format:</p>
        <code>primary_term, synonym1, synonym2, synonym3</code>
      </div>

      <textarea
        value={editableSynonyms}
        onChange={(e) => setEditableSynonyms(e.target.value)}
        className="textarea large"
        rows="12"
      />

      <div className="edit-stats">
        <span>
          {editableSynonyms
            .split('\n')
            .filter(line => line.trim().length > 0).length} synonym rules
        </span>
      </div>

      <div className="button-group">
        <button
          className="action-btn primary"
          onClick={handleUpdateSynonyms}
          disabled={loading}
        >
          {loading ? '⏳ Updating...' : '🚀 Apply to Elasticsearch'}
        </button>
        <button
          className="action-btn secondary"
          onClick={() => setStep('generate')}
        >
          ← Back
        </button>
      </div>
    </div>
  );

  // Render apply section
  const renderApplySection = () => (
    <div className="section apply-section">
      <h2>✅ Step 4: Success!</h2>
      
      <div className="success-message">
        <p>🎉 Synonyms have been successfully applied to Elasticsearch!</p>
        <p>Your search now understands and uses these synonyms for better results.</p>
      </div>

      <div className="applied-stats">
        <div className="stat">
          <strong>{editableSynonyms.split('\n').filter(line => line.trim().length > 0).length}</strong>
          <span>Synonym rules applied</span>
        </div>
      </div>

      <div className="button-group">
        <button
          className="action-btn primary"
          onClick={() => navigate('/')}
        >
          🔍 Go to Search & Test
        </button>
        <button
          className="action-btn secondary"
          onClick={() => {
            setKeywords([]);
            setManualKeywords('');
            setSynonyms([]);
            setEditableSynonyms('');
            setUseManualInput(false);
            setStep('keywords');
            setMessage('');
          }}
        >
          ➕ Create More Synonyms
        </button>
      </div>
    </div>
  );

  return (
    <div className="synonym-page">
      <header className="synonym-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back to Search
          </button>
          <h1>🧠 AI Synonym Generator</h1>
          <p>Create smarter product search with AI-powered synonyms</p>
        </div>
      </header>

      {message && (
        <div className={`message ${message.startsWith('✅') || message.startsWith('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="synonym-container">
        {step === 'keywords' && renderKeywordsSection()}
        {step === 'generate' && renderGenerateSection()}
        {step === 'edit' && renderEditSection()}
        {step === 'apply' && renderApplySection()}

        <div className="progress-indicator">
          <div className={`step ${step === 'keywords' ? 'active' : step !== 'keywords' ? 'completed' : ''}`}>
            1. Keywords
          </div>
          <div className={`step ${step === 'generate' ? 'active' : step === 'edit' || step === 'apply' ? 'completed' : ''}`}>
            2. Generate
          </div>
          <div className={`step ${step === 'edit' ? 'active' : step === 'apply' ? 'completed' : ''}`}>
            3. Edit
          </div>
          <div className={`step ${step === 'apply' ? 'active' : ''}`}>
            4. Apply
          </div>
        </div>
      </div>
    </div>
  );
}

export default SynonymPage;
