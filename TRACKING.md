# Search Event Tracking & Analytics

## Overview

The tracking system captures all user interactions with the search functionality and feeds them into the Analytics Engine for business insights. This enables the system to build comprehensive reports on search behavior, product engagement, and user refinement patterns.

## Architecture

```
Frontend Events → Backend Tracking Endpoints → Elasticsearch Analytics Index → Analytics Engine → Dashboard Insights
```

### Data Flow

1. **User performs search** → Frontend captures query, engine type (AI/traditional)
2. **Search completes** → Backend tracks search event with result count and zero-result status
3. **User clicks product** → Frontend captures product ID and click position (rank)
4. **User refines search** → Frontend captures refinement type (filter, sort, category, spec)
5. **Data stored** → Elasticsearch `{INDEX}-analytics` index aggregates events
6. **Analysis runs** → Analytics engine processes events, calculates KPIs, generates AI insights
7. **Dashboard displays** → UI shows metrics, problems, recommendations, business impact

## Tracking Endpoints

### 1. POST /track/search
**Track a search query execution**

**Request Body:**
```json
{
  "query": "string (sanitized search query)",
  "resultsCount": "number (total hits returned)",
  "isZeroResult": "boolean (true if no results)",
  "engine": "string ('AI-search' or 'traditional')",
  "timestamp": "ISO string (auto-generated)"
}
```

**Example:**
```javascript
fetch('http://localhost:5001/track/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'leather backpack',
    resultsCount: 24,
    isZeroResult: false,
    engine: 'ai-search'
  })
})
```

**Backend Processing:**
- Creates/updates aggregated analytics record in `{INDEX}-analytics` index
- Document ID: `{query_lowercase}_YYYY-MM-DD` (one per query per day)
- Updates metrics: `total_searches`, `zero_result_count`, `results_count_avg`
- Maintains last 100 timestamps for trend analysis

**Response:**
```json
{
  "success": true,
  "message": "Search tracked"
}
```

---

### 2. POST /track/click
**Track when user clicks on a product**

**Request Body:**
```json
{
  "query": "string (original search query)",
  "productId": "string (product ID from results)",
  "position": "number (rank position of product, 1-indexed)",
  "timestamp": "ISO string (auto-generated)"
}
```

**Example:**
```javascript
fetch('http://localhost:5001/track/click', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'leather backpack',
    productId: 'PROD_12345',
    position: 3  // User clicked 3rd result
  })
})
```

**Backend Processing:**
- Retrieves today's analytics record for the query
- Increments `clicks` counter
- Updates `avg_click_position` weighted average: `(old_avg * old_clicks + new_pos) / new_clicks`
- Recalculates CTR: `(clicks / total_searches) * 100`
- Stores in analytics document

**Response:**
```json
{
  "success": true,
  "message": "Click tracked"
}
```

**CTR Calculation:**
- **CTR** = (Total Clicks / Total Searches) × 100
- Used to identify queries with low engagement
- Typically 30-40% CTR is healthy; <10% indicates relevance issues

---

### 3. POST /track/refinement
**Track when user modifies search (filters, sorts, refines query)**

**Request Body:**
```json
{
  "originalQuery": "string (initial search query)",
  "newQuery": "string (refined/new query, can be same)",
  "filterChanges": "object (optional - describes what changed)",
  "timestamp": "ISO string (auto-generated)"
}
```

**Filter Change Object Examples:**
```javascript
// Price filter applied
{
  type: 'filter_change',
  priceRange: '2000-5000',
  sort: 'price_asc',
  color: null
}

// Category refined
{
  type: 'category_change',
  category: 'backpacks'
}

// Specification filtered
{
  type: 'specification_change',
  specification: 'Material:Leather'
}
```

**Example:**
```javascript
fetch('http://localhost:5001/track/refinement', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalQuery: 'backpack',
    newQuery: 'backpack',  // Same query, filters changed
    filterChanges: {
      type: 'price_filter',
      priceRange: '2000-5000'
    }
  })
})
```

**Backend Processing:**
- Updates original query's analytics record
- Increments `refinement_count`
- Calculates `refinement_rate`: `refinements / total_searches`
- Stores refinement details: query, filters, timestamp
- Keeps last 50 refinement records per query

**Refinement Rate Interpretation:**
- **0-10%**: Most searches result in at least one refinement attempt
- **10-30%**: Normal refinement rate (users adjusting filters)
- **>30%**: High refinement rate indicating unclear search intent or poor results

---

## Frontend Integration

### SearchPage Component

**1. Search Event Tracking**

When user clicks "Search":
```javascript
// Automatically called after fetchProducts completes
trackSearch(sanitizedQuery, totalHits, totalHits === 0);

// Parameters:
// - query: Sanitized search term
// - resultsCount: Total hits from Elasticsearch
// - isZeroResult: Boolean indicating if 0 results returned
```

**2. Click Event Tracking**

When user clicks on a product:
```javascript
// ProductCard onClick handler calls trackClick
trackClick(productId, position)

// Flow:
// ProductCard → ProductGrid → SearchPage.trackClick
// position = 1-based rank (1st result, 2nd result, etc.)
```

**3. Refinement Event Tracking**

When user applies filters:
```javascript
// Filter changes tracked before fetchProducts
trackRefinement(newQuery, filterChanges)

// Triggered by:
// - handleFilterChange() - Price, sort, color filters
// - handleCategoryChange() - Category selection
// - handleSpecificationChange() - Spec filtering
```

### Component Changes

**ProductCard.jsx:**
- Accept `onProductClick` callback and `index` prop
- Call `onProductClick(productId, position)` on click
- Position = index + 1 (1-indexed)

**ProductGrid.jsx:**
- Pass `onProductClick` callback from parent
- Pass `index` to each ProductCard

**SearchPage.jsx:**
- Define `trackSearch()`, `trackClick()`, `trackRefinement()` functions
- Call `trackSearch()` after fetch completes
- Pass `trackClick` to ProductGrid
- Call `trackRefinement()` in filter handlers

---

## Elasticsearch Analytics Index

### Index Schema

**Index Name:** `{ELASTICSEARCH_INDEX}-analytics` (e.g., `amazon_products-analytics`)

**Document Structure:**
```json
{
  "query": "leather backpack",
  "total_searches": 15,
  "clicks": 4,
  "zero_result_count": 1,
  "avg_click_position": 2.5,
  "refinement_count": 3,
  "results_count_avg": 24,
  "refinement_rate": 0.2,
  "ctr": 26.67,
  "timestamps": ["2024-01-15T10:30:00Z", "2024-01-15T14:22:00Z", ...],
  "refinement_details": [
    {
      "timestamp": "2024-01-15T10:35:00Z",
      "new_query": "leather backpack men",
      "filter_changes": { "type": "query_refinement" }
    }
  ]
}
```

### Aggregation Strategy

**Per-Query Daily Records:**
- Document ID: `{query_lowercase}_YYYY-MM-DD`
- Example: `leather_backpack_2024-01-15`
- One record per unique query per calendar day
- Aggregates all searches of same query on same day

**Example Timeline:**
```
User 1: 10:30 searches "backpack" → total_searches = 1
User 2: 10:45 searches "backpack" → total_searches = 2
User 1: 10:50 clicks product #2 → clicks = 1, avg_position = 2
User 3: 14:22 searches "backpack" → total_searches = 3, results_count_avg updated
```

---

## Analytics Engine Processing

### Data Collection Phase (Current)

The system is now collecting real-time tracking data. This phase:
- ✅ Captures all search events
- ✅ Records click interactions
- ✅ Tracks filter refinements
- ✅ Maintains aggregated metrics
- ✅ Calculates KPIs: CTR, refinement rate, zero results

### Analytics Report Generation

**Metrics Snapshot:**
```json
{
  "top_queries": [
    { "query": "backpack", "searches": 150, "ctr": 35 },
    { "query": "shoes", "searches": 120, "ctr": 28 }
  ],
  "zero_results": [
    { "query": "very specific product", "count": 5 }
  ],
  "low_ctr": [
    { "query": "generic term", "ctr": 8, "searches": 45 }
  ],
  "high_refinement": [
    { "query": "unclear query", "refinement_rate": 0.45 }
  ]
}
```

**Problem Detection:**
- **Relevance Issues**: CTR < 10% + high searches
- **Content Gaps**: Zero results + intent detected
- **Ranking Issues**: High refinement rate + low position clicks
- **Intent Mismatch**: Query rewritten by AI recovery

---

## Testing the Tracking System

### 1. Manual Testing

**Step 1: Open Frontend**
```
http://localhost:5173
```

**Step 2: Perform Search**
```
- Type: "leather backpack"
- Click Search button
- Observe /track/search call in browser DevTools Network tab
```

**Step 3: Click Product**
```
- Click any product in results
- Observe /track/click call in Network tab
- Check product position (rank)
```

**Step 4: Apply Filter**
```
- Change price range to "2000-5000"
- Observe /track/refinement call
- Verify filterChanges object
```

### 2. Verify Data in Elasticsearch

```bash
# Check analytics index exists
curl -X GET "localhost:9200/_cat/indices?v" | grep analytics

# View analytics documents
curl -X GET "localhost:9200/amazon_products-analytics/_search?pretty" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 100,
    "sort": [{ "total_searches": { "order": "desc" } }]
  }'

# Example response:
{
  "hits": {
    "hits": [
      {
        "_id": "leather_backpack_2024-01-15",
        "_source": {
          "query": "leather backpack",
          "total_searches": 5,
          "clicks": 1,
          "ctr": 20,
          "avg_click_position": 2,
          "refinement_count": 1,
          "zero_result_count": 0
        }
      }
    ]
  }
}
```

### 3. View Analytics Dashboard

```
- Navigate to SearchPage home
- Scroll to bottom to see SearchInsights component
- View real-time analytics based on collected data
- Check:
  - Top performing queries
  - Zero result queries
  - Low CTR queries
  - High refinement queries
  - AI-powered recommendations
```

---

## Data Privacy & Storage

### Tracking Data Stored
- ✅ Search queries (text)
- ✅ Product clicks (IDs and positions)
- ✅ Filter changes (type and values)
- ✅ Timestamps (ISO format)

### Data NOT Tracked
- ❌ User identity (no user IDs captured)
- ❌ IP addresses
- ❌ Device/browser details
- ❌ Session IDs

### Retention Policy
- Analytics records kept in Elasticsearch indefinitely
- Last 100 timestamps per query (rolling window)
- Last 50 refinement details per query (rolling window)
- Purpose: Trend analysis and historical comparison

---

## Performance Considerations

### Asynchronous Tracking
All tracking calls are **fire-and-forget**, non-blocking:
```javascript
fetch(...).catch(() => {});  // No error handling to UI
```

This ensures tracking failures don't impact user experience.

### Query Aggregation
- One analytics document per query per day
- Prevents index bloat from thousands of daily searches
- Enables efficient aggregation and trending
- Example: 10,000 searches of "backpack" = 1 document/day

### Elasticsearch Performance
- Document updates use `index` operation (efficient upsert)
- Bulk operations combine search + click + refinement in batch
- Aggregation queries optimized with `terms` and `size` limits
- Analytics index separate from product index (no cross-table joins)

---

## Troubleshooting

### Tracking Calls Not Appearing

**Check 1: Backend running?**
```bash
curl http://localhost:5001/health
# Should return 200 OK
```

**Check 2: Browser DevTools Network Tab**
- Open F12 → Network tab
- Perform search/click
- Look for `/track/search`, `/track/click`, `/track/refinement` requests
- Check response status (should be 200, body: `{"success": true}`)

**Check 3: Console Errors**
- Any CORS errors? Check backend CORS config
- Any 404 errors? Backend not running on port 5001
- Any timeout errors? Elasticsearch connection issue

### Analytics Dashboard Shows Empty Report

**Reason:** Analytics index doesn't exist yet or has no data

**Solution:**
1. Perform at least 1 search in the UI
2. Verify /track/search endpoint was called
3. Wait a few seconds
4. Refresh dashboard
5. Should see data populate

**Check data manually:**
```bash
curl -X GET "localhost:9200/amazon_products-analytics/_search"
```

---

## Future Enhancements

### Planned Tracking Features
- [ ] Session tracking (group related searches together)
- [ ] Dwell time tracking (how long on result page)
- [ ] Add-to-cart tracking (product engagement)
- [ ] Conversion tracking (if purchase data available)
- [ ] A/B test tracking (for feature comparison)

### Analytics Improvements
- [ ] Real-time dashboard updates (WebSocket)
- [ ] Export reports (PDF, CSV)
- [ ] Scheduled automation reports (daily emails)
- [ ] Cohort analysis (group users by behavior)
- [ ] Predictive recommendations (forecast trends)

---

## Summary

The tracking system provides:
- ✅ **Real-time data collection** via three dedicated endpoints
- ✅ **Frontend integration** in search, click, and filter components
- ✅ **Elasticsearch storage** with daily aggregation
- ✅ **KPI calculation** (CTR, refinement rate, zero results)
- ✅ **Analytics engine feed** with structured data for insights
- ✅ **Performance optimization** with async non-blocking calls
- ✅ **Privacy protection** with no user identification

This enables the Analytics Engine to generate actionable business insights and AI-powered recommendations from real search behavior data.

