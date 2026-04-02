import { useState, useCallback } from 'react';
import './SearchBar.css';

function SearchBar({ value, onChange, onSearch, aiSearchEnabled, onAiSearchToggle }) {
  // Handle input change (just update the input value, no search trigger)
  const handleChange = (e) => {
    const query = e.target.value;
    onChange(query);
  };

  // Handle Enter key press - trigger search
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(value);
    }
  };

  // Handle search icon click - trigger search
  const handleSearchClick = () => {
    onSearch(value);
  };

  return (
    <div className="search-bar-container">
      <div className="search-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search products... (Press Enter to search)"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="search-input"
          />
          <span className="search-icon" onClick={handleSearchClick} style={{ cursor: 'pointer' }}>🔍</span>
        </div>
        
        <div className="ai-search-toggle">
          <input
            type="checkbox"
            id="ai-search-checkbox"
            checked={aiSearchEnabled}
            onChange={(e) => onAiSearchToggle(e.target.checked)}
            className="ai-checkbox"
          />
          <label htmlFor="ai-search-checkbox" className="ai-label">
            🤖 Smart Search
          </label>
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
