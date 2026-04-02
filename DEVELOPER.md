# Developer Quick Reference

## Quick Start

```bash
# Install dependencies
npm run install:all

# Set up backend .env
cd backend
copy .env.example .env
# Edit .env with Elasticsearch URL

# Run both frontend and backend
cd ../..
npm run dev
```

## Frontend Project Structure

```
frontend/src/
├── App.jsx                 # Main app (state, caching, API calls)
├── App.css                 # App styling
├── components/
│   ├── SearchBar.jsx       # Search input with suggestions
│   ├── SearchBar.css
│   ├── FilterBar.jsx       # Sort and price filter
│   ├── FilterBar.css
│   ├── ProductGrid.jsx     # Grid layout
│   ├── ProductGrid.css
│   ├── ProductCard.jsx     # Product card
│   ├── ProductCard.css
│   ├── Pagination.jsx      # Page navigation
│   ├── Pagination.css
│   └── SearchSuggestions.jsx (optional - can be integrated)
├── index.css
└── main.jsx
```

## Backend Project Structure

```
backend/src/
├── server.js              # Express server + Elasticsearch
├── .env.example           # Environment template
└── package.json
```

## Key State Variables (App.jsx)

```javascript
// Search state
const [searchQuery, setSearchQuery] = useState('');
const [hasSearched, setHasSearched] = useState(false);

// Results state
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(false);

// Pagination state
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);

// Filter state
const [sortBy, setSortBy] = useState('relevance');
const [minPrice, setMinPrice] = useState('');
const [maxPrice, setMaxPrice] = useState('');

// UI state
const [suggestions, setSuggestions] = useState([]);
```

## Common Tasks

### Adding a New Search Filter

1. **Backend** (server.js):
```javascript
const { q, page = 1, sort = 'relevance', newFilter } = req.query;

// Add to ES query
const filters = [];
if (newFilter) {
  filters.push({ term: { fieldName: newFilter } });
}
```

2. **Frontend** (App.jsx):
```javascript
const [newFilter, setNewFilter] = useState('');

const handleFilterChange = (newMinPrice, newMaxPrice, newSort, newFilter) => {
  setNewFilter(newFilter);
  // Trigger search with new filter
};
```

3. **UI** (FilterBar.jsx):
```jsx
<div className="filter-group">
  <label>New Filter:</label>
  <input onChange={(e) => onFilterChange(..., e.target.value)} />
</div>
```

### Updating Cache Logic

Cache key format in App.jsx:
```javascript
const getCacheKey = (query, page, sort, minP, maxP) => {
  return `${query}|p${page}|s${sort}|min${minP}|max${maxP}`;
};
```

To add a new filter to cache:
```javascript
const getCacheKey = (query, page, sort, minP, maxP, newFilter) => {
  return `${query}|p${page}|s${sort}|min${minP}|max${maxP}|${newFilter}`;
};
```

### Updating Analytics

Currently tracked in `searchCache` on backend. To persist to database:

1. Add database connection (e.g., MongoDB)
2. Create `analytics` collection
3. Update POST `/search/analytics`:
```javascript
app.post('/search/analytics', async (req, res) => {
  const { query } = req.body;
  await db.analytics.insertOne({ 
    query, 
    timestamp: new Date() 
  });
});
```

4. Update GET `/search/trending`:
```javascript
app.get('/search/trending', async (req, res) => {
  const trending = await db.analytics.aggregate([
    { $group: { _id: '$query', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
});
```

## API Response Structure

### Search Response
```json
{
  "success": true,
  "count": 20,              // Results on this page
  "total": 150,             // Total across all pages
  "page": 1,                // Current page number
  "totalPages": 8,          // Total pages
  "pageSize": 20,           // Results per page
  "results": [
    {
      "id": "123",
      "name": "Product Name",
      "price": 29.99,
      "image": "https://...",
      "category": "Electronics",
      "description": "..."
    }
  ]
}
```

### Trending Response
```json
{
  "success": true,
  "trending": [
    { "query": "headphones", "count": 42 }
  ]
}
```

## Key Hooks Used

```javascript
// State management
useState(initialValue)

// Callbacks
useCallback(fn, deps)  // Memoized functions

// Utilities
useMemo(fn, deps)      // Memoized values
```

## Performance Tips

1. **Caching**: Check cache before API call
2. **Debouncing**: 300ms delay on search input
3. **Pagination**: Only load 20 results per request
4. **Sorting**: Delegate to Elasticsearch
5. **Filtering**: Use Elasticsearch filters

## Debugging

Enable console debug logs:
```javascript
if (process.env.DEBUG) {
  console.log('Debug info:', data);
}
```

Common issues and fixes:
- **"No results"**: Check Elasticsearch connection and index
- **Blank page**: Check fetch URL in vite.config.js proxy
- **Suggestions empty**: Check `/search/trending` endpoint
- **Price filter not working**: Verify field name in Elasticsearch mapping

## Testing

Frontend test cases to verify:
1. Search works `✓`
2. Pagination changes results `✓`
3. Sorting reorders products `✓`
4. Price filter narrows results `✓`
5. Cache prevents duplicate calls `✓`
6. Suggestions appear on focus `✓`
7. Image errors handled gracefully `✓`
8. Mobile responsive `✓`

## Deployment Checklist

- [ ] Create production `.env` file
- [ ] Set Elasticsearch URL
- [ ] Build frontend: `npm run build`
- [ ] Test production build: `npm run preview`
- [ ] Deploy backend with Node.js runtime
- [ ] Deploy frontend to static host
- [ ] Update API URLs
- [ ] Test all features
- [ ] Monitor error logs
- [ ] Set up uptime monitoring

## Environment Variables

```bash
# Backend .env
PORT=5000
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=products

# Frontend (no .env needed, uses Vite proxy by default)
# In production, update fetch URLs to production API
```

## Useful Commands

```bash
# Backend
npm start              # Production start
npm run dev            # Development with auto-restart
npm install            # Install dependencies

# Frontend
npm run dev            # Dev server
npm run build          # Production build
npm run preview        # Preview production build

# Root
npm run install:all    # Install everything
npm run dev            # Run both servers
npm start              # Production mode both
```

---

**Last Updated:** March 31, 2026
