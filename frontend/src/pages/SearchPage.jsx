import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ProductGrid from '../components/ProductGrid';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import '../App.css';

// Simple cache implementation
const searchCache = {};

function SearchPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('relevance');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [color, setColor] = useState('');
  const [category, setCategory] = useState('');
  const [specifications, setSpecifications] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [facets, setFacets] = useState({ colors: [], categories: [], specifications: [] });
  const [aiInterpretation, setAiInterpretation] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [aiSearchEnabled, setAiSearchEnabled] = useState(false);
  const [enableRecovery, setEnableRecovery] = useState(false);
  const [recovery, setRecovery] = useState(null);

  // Generate cache key - includes all search parameters including AI state
  const getCacheKey = useCallback((query, page, sort, minP, maxP, c, cat, specs, aiState) => {
    const specsString = Object.entries(specs).map(([k, v]) => `${k}:${v.join(',')}`).join('|');
    return `${query}|p${page}|s${sort}|min${minP}|max${maxP}|c${c}|cat${cat}|spec${specsString}|ai${aiState}`;
  }, []);

  // Track search analytics
  const trackSearch = useCallback((query) => {
    fetch('/search/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, timestamp: new Date().toISOString() }),
    }).catch(() => {});
  }, []);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/search/trending');
      const data = await response.json();
      if (data.success && Array.isArray(data.trending)) {
        setSuggestions(data.trending.map(t => t.query));
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Fetch products from backend
  const fetchProducts = useCallback(async (query, page = 1, sort = 'relevance', minP = '', maxP = '', c = '', cat = '', specs = {}, aiSearchOverride = null) => {
    if (!query.trim()) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    const sanitizedQuery = query.replace(/<[^>]*>/g, '');
    const aiSearchActive = aiSearchOverride !== null ? aiSearchOverride : aiSearchEnabled;

    setLoading(true);
    setHasSearched(true);

    try {
      if (aiSearchActive) {
        const aiSearchPayload = { 
          query: sanitizedQuery, 
          page,
          enableRecovery,
          ...(minP && { minPrice: parseFloat(minP) }),
          ...(maxP && { maxPrice: parseFloat(maxP) }),
          ...(c && { color: c }),
          ...(cat && { category: cat }),
        };

        if (Object.keys(specs).length > 0) {
          aiSearchPayload.spec = Object.entries(specs)
            .filter(([_, values]) => values.length > 0)
            .map(([name, values]) => `${name}:${values.join(',')}`)
            .join('|');
        }

        const response = await fetch('/ai-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSearchPayload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.results)) {
          setProducts(data.results);
          setCurrentPage(data.page);
          setTotalPages(data.totalPages);
          setAiInterpretation(data.aiInterpretation || '');
          setAppliedFilters(data.appliedFilters || null);
          setRecovery(data.recovery || null);

          if (data.facets) {
            setFacets({
              colors: data.facets.colors || [],
              categories: data.facets.categories || [],
              specifications: data.facets.specifications || [],
            });
          }

          trackSearch(sanitizedQuery);
        } else {
          setProducts([]);
          setTotalPages(1);
          setFacets({ colors: [], categories: [], specifications: [] });
          setAiInterpretation('');
          setRecovery(null);
        }
      } else {
        const params = new URLSearchParams({
          q: sanitizedQuery,
          page,
          sort,
          ...(minP && { minPrice: minP }),
          ...(maxP && { maxPrice: maxP }),
          ...(c && { color: c }),
          ...(cat && { category: cat }),
        });

        Object.entries(specs).forEach(([specName, specValues]) => {
          if (specValues.length > 0) {
            params.append('spec', `${specName}:${specValues.join(',')}`);
          }
        });

        const response = await fetch(`/search?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.results)) {
          setProducts(data.results);
          setCurrentPage(data.page);
          setTotalPages(data.totalPages);
          setRecovery(data.recovery || null);

          if (data.facets) {
            setFacets({
              colors: data.facets.colors || [],
              categories: data.facets.categories || [],
              specifications: data.facets.specifications || [],
            });
          }

          trackSearch(sanitizedQuery);
        } else {
          setProducts([]);
          setTotalPages(1);
          setFacets({ colors: [], categories: [], specifications: [] });
          setRecovery(null);
        }
        
        setAiInterpretation('');
        setAppliedFilters(null);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      console.warn('Dev: API request failed - check Elasticsearch connection on port 9200');
      setProducts([]);
      setTotalPages(1);
      setFacets({ colors: [], categories: [], specifications: [] });
      setAiInterpretation('');
      setRecovery(null);
    } finally {
      setLoading(false);
    }
  }, [getCacheKey, trackSearch, aiSearchEnabled]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleSearchSubmit = (query) => {
    if (!query || query.trim().length === 0) {
      return;
    }
    setCurrentPage(1);
    fetchProducts(query, 1, sortBy, minPrice, maxPrice, color, category, specifications);
  };

  const handleAiSearchToggle = (enabled) => {
    setAiSearchEnabled(enabled);
    if (searchQuery.trim() && hasSearched) {
      setCurrentPage(1);
      fetchProducts(searchQuery, 1, sortBy, minPrice, maxPrice, color, category, specifications, enabled);
    }
  };

  const handleFilterChange = (newMinPrice, newMaxPrice, newSort, newColor) => {
    setMinPrice(newMinPrice);
    setMaxPrice(newMaxPrice);
    setSortBy(newSort);
    setColor(newColor);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      fetchProducts(searchQuery, 1, newSort, newMinPrice, newMaxPrice, newColor, category, specifications);
    }
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      fetchProducts(searchQuery, 1, sortBy, minPrice, maxPrice, color, newCategory, specifications);
    }
  };

  const handleSpecificationChange = (specName, specValue) => {
    const newSpecs = { ...specifications };
    if (!newSpecs[specName]) {
      newSpecs[specName] = [];
    }
    const index = newSpecs[specName].indexOf(specValue);
    if (index > -1) {
      newSpecs[specName].splice(index, 1);
    } else {
      newSpecs[specName].push(specValue);
    }
    if (newSpecs[specName].length === 0) {
      delete newSpecs[specName];
    }
    setSpecifications(newSpecs);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      fetchProducts(searchQuery, 1, sortBy, minPrice, maxPrice, color, category, newSpecs);
    }
  };

  const handleResetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSortBy('relevance');
    setColor('');
    setCategory('');
    setSpecifications({});
    setCurrentPage(1);
    if (searchQuery.trim()) {
      fetchProducts(searchQuery, 1, 'relevance', '', '', '', '', {});
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchProducts(searchQuery, page, sortBy, minPrice, maxPrice, color, category, specifications);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>Product Search</h1>
          <button 
            className="synonym-link"
            onClick={() => navigate('/ai-synonyms')}
            title="Manage product search synonyms with AI"
          >
            🧠 AI Synonyms
          </button>
        </div>
        <p>Find what you're looking for</p>
      </header>

      <main className="container">
        <SearchBar 
          value={searchQuery} 
          onChange={handleSearch}
          onSearch={handleSearchSubmit}
          aiSearchEnabled={aiSearchEnabled}
          onAiSearchToggle={handleAiSearchToggle}
        />

        {aiSearchEnabled && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            marginTop: '8px',
            borderRadius: '6px',
            backgroundColor: '#e7f3ff',
            border: '1px solid #b3d9ff',
            fontSize: '14px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={enableRecovery}
                onChange={(e) => setEnableRecovery(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>🔄 Enable Zero-Result Recovery (AI will try alternate searches)</span>
            </label>
          </div>
        )}

        {aiInterpretation && (
          <div className="ai-interpretation">
            <strong>AI Interpretation:</strong> {aiInterpretation}
          </div>
        )}

        {recovery && (
          <div className="recovery-message" style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            color: '#856404',
            fontSize: '14px'
          }}>
            <strong>⚠️ Search Adjusted:</strong> {recovery.message}
            {recovery.originalQuery && recovery.rewrittenQuery && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                Query rewritten: "<strong>{recovery.originalQuery}</strong>" → "<strong>{recovery.rewrittenQuery}</strong>"
              </div>
            )}
            {recovery.appliedRemovals && recovery.appliedRemovals.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                Filters removed: <strong>{recovery.appliedRemovals.join(', ')}</strong>
              </div>
            )}
          </div>
        )}

        {hasSearched && (
          <div className="products-section">
            <div className="filter-sidebar">
              <FilterBar 
                facets={facets}
                onFilterChange={handleFilterChange}
                onCategoryChange={handleCategoryChange}
                onSpecificationChange={handleSpecificationChange}
                onResetFilters={handleResetFilters}
                sortBy={sortBy}
                minPrice={minPrice}
                maxPrice={maxPrice}
                color={color}
              />
            </div>
            <div className="products-container">
              {loading && <p className="loading">Loading...</p>}
              {!loading && products.length === 0 && <p className="no-results">No products found</p>}
              {!loading && products.length > 0 && (
                <>
                  <div className="results-header">
                    <p className="results-count">Found {products.length} products</p>
                    <div className="sort-dropdown">
                      <label htmlFor="header-sort">Sort by:</label>
                      <select 
                        id="header-sort" 
                        value={sortBy} 
                        onChange={(e) => handleFilterChange(minPrice, maxPrice, e.target.value, color)}
                      >
                        <option value="relevance">Relevance</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                      </select>
                    </div>
                  </div>
                  <ProductGrid products={products} />
                  {totalPages > 1 && (
                    <Pagination 
                      currentPage={currentPage} 
                      totalPages={totalPages} 
                      onPageChange={handlePageChange}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {!hasSearched && (
          <div className="initial-state">
            <p>Start typing to search for products</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default SearchPage;
