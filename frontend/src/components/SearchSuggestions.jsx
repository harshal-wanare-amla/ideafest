import './SearchSuggestions.css';

function SearchSuggestions({ suggestions, onSuggestionClick }) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="search-suggestions">
      <p className="suggestions-title">Popular searches:</p>
      <div className="suggestions-list">
        {suggestions.slice(0, 5).map((suggestion, index) => (
          <button
            key={index}
            className="suggestion-tag"
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SearchSuggestions;
