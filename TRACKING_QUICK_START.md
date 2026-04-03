# Tracking Quick Start Guide

## What Was Implemented

A complete search event tracking system that captures all user interactions and feeds them into the Analytics Engine for business insights.

### Three Tracking Endpoints

| Endpoint | Purpose | Triggered By |
|----------|---------|--------------|
| **POST /track/search** | Log search queries | After user performs search (both AI & traditional) |
| **POST /track/click** | Log product clicks | When user clicks on any product in results |
| **POST /track/refinement** | Log filter/sort changes | When user applies filters, sorts, or changes category |

---

## Step 1: Verify Servers Running

**Terminal 1 - Backend:**
```bash
cd d:\ideafest\backend
npm start
```
✅ Should see: `Server running on http://localhost:5001`

**Terminal 2 - Frontend:**
```bash
cd d:\ideafest\frontend
npm run dev
```
✅ Should see: `Local: http://localhost:5173/`

---

## Step 2: Test Tracking in Browser

### Open DevTools
1. Go to `http://localhost:5173`
2. Press `F12` to open Developer Tools
3. Click "Network" tab

### Test Search Tracking
1. Type `"shoes"` in search box
2. Press Enter or click Search
3. **Check Network Tab:** Should see request to `/track/search`

**Request Details:**
- Method: POST
- URL: `http://localhost:5001/track/search`
- Status: 200
- Payload example:
  ```json
  {
    "query": "shoes",
    "resultsCount": 150,
    "isZeroResult": false,
    "engine": "traditional"
  }
  ```

### Test Click Tracking
1. Click on any product in search results
2. **Check Network Tab:** Should see request to `/track/click`

**Request Details:**
- Method: POST
- URL: `http://localhost:5001/track/click`
- Status: 200
- Payload example:
  ```json
  {
    "query": "shoes",
    "productId": "PROD_12345",
    "position": 3
  }
  ```

### Test Refinement Tracking
1. Change Price: "2000-5000"
2. **Check Network Tab:** Should see request to `/track/refinement`

**Request Details:**
- Method: POST
- URL: `http://localhost:5001/track/refinement`
- Status: 200
- Payload example:
  ```json
  {
    "originalQuery": "shoes",
    "newQuery": "shoes",
    "filterChanges": {
      "type": "filter_change",
      "priceRange": "2000-5000"
    }
  }
  ```

---

## Step 3: Verify Data in Elasticsearch

### Check Analytics Index
```bash
curl -X GET "localhost:9200/_cat/indices?v" | grep analytics
```

Expected output:
```
yellow open amazon_products-analytics ... 0 1
```

### View Analytics Data
```bash
curl -X GET "localhost:9200/amazon_products-analytics/_search?pretty"
```

Expected response (after 1+ searches):
```json
{
  "hits": {
    "hits": [
      {
        "_id": "shoes_2024-01-15",
        "_source": {
          "query": "shoes",
          "total_searches": 1,
          "clicks": 1,
          "avg_click_position": 3,
          "ctr": 100,
          "refinement_count": 1,
          "refinement_rate": 1,
          "zero_result_count": 0
        }
      }
    ]
  }
}
```

---

## Step 4: View Analytics Dashboard

### Home Page Analytics
1. Go to `http://localhost:5173` (Home page with SearchPage)
2. Scroll down to **"Search Analytics & Insights"** section
3. You should see:
   - ✅ Total searches count
   - ✅ Average CTR percentage
   - ✅ Top performing queries
   - ✅ Zero result queries (if any)
   - ✅ Low CTR queries requiring attention
   - ✅ High refinement queries
   - ✅ AI-powered recommendations
   - ✅ Priority actions
   - ✅ Smart insights and trends

### Expected Metrics
After performing:
- 1 search
- 1 product click  
- 1 filter change

Dashboard should show:
```
Metrics Snapshot
├─ Total Searches: 1
├─ Avg CTR: 100% (1 search with 1 click)
├─ Avg Refinement Rate: 100% (1 refinement tracked)
└─ Zero Results: 0

Top Queries
├─ "shoes" - 1 search, 100% CTR

Refinements Detected
└─ "shoes" refined 1 time (100% refinement rate)
```

---

## Tracking Data Flow Diagram

```
┌─────────────────────────┐
│   User Searches         │
│   "leather backpack"    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend: trackSearch()            │
│  Calls: POST /track/search          │
│  {query, resultsCount, engine}      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Backend: upsertAnalytics()         │
│  Updates: amazon_products-analytics  │
│  Doc ID: leather_backpack_2024-01-15│
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Elasticsearch                      │
│  {                                  │
│    total_searches: 5,               │
│    clicks: 1,                       │
│    ctr: 20%                         │
│  }                                  │
└────────┬────────────────────────────┘
         │
         ▼ (User clicks product)
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend: trackClick()             │
│  Calls: POST /track/click           │
│  {query, productId, position}       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Backend: trackClick()              │
│  Updates: clicks++, avg_position    │
│  Recalculates CTR                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Elasticsearch Updated              │
│  {                                  │
│    clicks: 2,                       │
│    ctr: 40%,                        │
│    avg_click_position: 2.5          │
│  }                                  │
└────────┬────────────────────────────┘
         │
         ▼ (Analytics Engine reads)
         │
         ▼
┌─────────────────────────────────────┐
│  Analytics Engine                   │
│  - Analyzes patterns                │
│  - Calls Gemini AI                  │
│  - Generates recommendations        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Dashboard (SearchInsights.jsx)    │
│  Displays report with:              │
│  - KPIs                             │
│  - Top queries                      │
│  - Problem detection                │
│  - AI recommendations               │
└─────────────────────────────────────┘
```

---

## Common Issues

### Issue: Network Requests Show 404
**Cause:** Backend not running on port 5001

**Fix:**
```bash
cd d:\ideafest\backend
npm start
```

### Issue: Network Requests Sent But Come Back Empty
**Cause:** Elasticsearch not running

**Fix:** 
- Check Elasticsearch is running (usually automatic)
- Or manually start: `docker-compose up` (if using Docker)

### Issue: Dashboard Shows "No Data Yet"
**Cause:** Analytics index hasn't been created yet (first search)

**Fix:**
1. Perform at least 1 search
2. Wait 2-3 seconds
3. Refresh page
4. Dashboard should populate

### Issue: "No valid search analytics data" Message
**Cause:** Same as above - analytics index doesn't exist until first tracked search

**Fix:** Perform any search query, then refresh

---

## What Gets Tracked

✅ **Tracked:**
- Search queries (text)
- Product clicks (ID + position)
- Filter changes (type + values)
- Sort changes
- Category changes
- Specification selections
- Zero result occurrences
- Click position (rank)

❌ **NOT Tracked:**
- User identity
- IP addresses
- Browser/device details
- Session IDs
- Personal information

---

## Performance Impact

- **Tracking calls:** Async, non-blocking (won't slow down search)
- **Network:** ~0.5-1ms per call
- **Elasticsearch:** Documents aggregated per query per day (efficient storage)
- **Browser:** No noticeable performance impact

---

## Next Steps

1. ✅ **Perform searches** - Test tracking in Network tab
2. ✅ **Click products** - Verify click tracking works
3. ✅ **Apply filters** - Test refinement tracking
4. ✅ **Check dashboard** - View analytics insights
5. ✅ **Review analytics** - Check Elasticsearch data

## Documentation

For detailed information, see [TRACKING.md](./TRACKING.md)

This includes:
- Full API endpoint documentation
- Data schema and structures
- Analytics engine processing
- Troubleshooting guide
- Performance tuning

---

## Summary

✅ **Tracking Implemented:**
- 3 backend endpoints for tracking
- Frontend integration for all interactions
- Elasticsearch data storage
- Real-time KPI calculation
- Analytics engine feed

✅ **Features:**
- Search tracking (query + results count)
- Click tracking (product ID + position)
- Refinement tracking (filters, sorts, categories)
- Auto-aggregation by query per day
- CTR and refinement rate calculation

✅ **Dashboard:**
- Displays real-time metrics
- Shows top queries, zero results, low CTR
- AI-powered recommendations
- Business impact assessment

🎯 **Result:** Complete end-to-end search analytics system ready for business insights!

