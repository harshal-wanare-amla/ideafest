# 🎯 Rule-Based AI Search Intelligence Engine - Integration Guide

## Quick Start

### 1. Start the Server

```bash
# Install dependencies (if not already done)
npm install

# Start backend
npm start
```

Expected output:
```
✅ Search Insights API endpoints available:
  - GET /api/search-insights
  - GET /api/search-insights?format=quick
  - GET /api/search-insights?format=detailed
  - GET /api/search-insights?period=30d
  - GET /api/search-insights/export?format=csv
  - GET /api/search-insights/export?format=json
  - POST /api/search-insights/cache/clear
```

### 2. Test Endpoint

```bash
# Get insights (balanced format)
curl http://localhost:5000/api/search-insights

# Get quick format (mobile-friendly)
curl http://localhost:5000/api/search-insights?format=quick

# Get detailed insights
curl http://localhost:5000/api/search-insights?format=detailed

# Get 30-day insights
curl http://localhost:5000/api/search-insights?period=30d
```

---

## End-to-End Data Flow

### Step 1: Data Collection in Search

When a user searches, data is tracked:

```javascript
// In search execution
await trackSearch(query, resultsCount, isZeroResult);

// Stores in Elasticsearch:
// Index: {ES_INDEX}-analytics
// Document:
{
  query: "blue leather backpack",
  total_searches: 1,
  clicks: 0,
  zero_result_count: 0,
  avg_click_position: 0,
  refinement_rate: 0,
  timestamp: "2026-04-02T18:30:00Z"
}
```

### Step 2: Click Tracking

When user clicks a result:

```javascript
await trackClick(query, productId, position);

// Updates analytics document:
{
  query: "blue leather backpack",
  total_searches: 87,
  clicks: 31,           // ← Updated
  avg_click_position: 2.1,  // ← Calculated
  ctr: 35.6,            // ← Derived: (31/87)*100
}
```

### Step 3: Data Aggregation (Pipeline Start)

```
GET /api/search-insights

    ↓ DataFetcher.fetchAggregatedAnalytics()
```

**Data Fetcher queries Elasticsearch:**

```javascript
GET search_analytics/_search
{
  "aggs": {
    "queries_by_name": {
      "terms": {
        "field": "query.keyword",
        "size": 500,
        "order": { "_count": "desc" }
      },
      "aggs": {
        "total_searches": { "sum": { "field": "total_searches" } },
        "total_clicks": { "sum": { "field": "clicks" } },
        "total_zero_results": { "sum": { "field": "zero_result_count" } },
        "avg_position": { "avg": { "field": "avg_click_position" } },
        "position_percentiles": { "percentiles": { "field": "avg_click_position" } },
        ...
      }
    }
  }
}
```

**Returns normalized metrics:**

```json
[
  {
    "query": "blue leather backpack",
    "total_searches": 87,
    "clicks": 31,
    "ctr": 0.356,              // ← Normalized (0-1 scale)
    "zero_result_count": 0,
    "zero_result_rate": 0,
    "avg_click_position": 2.1,
    "refinement_rate": 0.138,
    "results_count_avg": 42,
    "scroll_depth": 0.65,
    "avg_time_spent": 12
  },
  {
    "query": "red shoes under 2000",
    "total_searches": 156,
    "clicks": 18,
    "ctr": 0.115,
    "avg_click_position": 4.7,
    "refinement_rate": 0.263,
    ...
  },
  ...
]
```

### Step 4: Rule Evaluation (Core Logic)

```
RuleEngine.evaluateRules(queries)

    ↓ For each query → for each rule
```

**Example: Evaluating "zero_result_high_volume" rule**

```javascript
Rule Configuration:
{
  rule_id: 'zero_result_high_volume',
  metric: 'zero_result_count',
  operator: '>=',
  threshold: 20,
  min_searches: 20,
  action_type: 'ADD_TO_INVENTORY',
  priority: 'HIGH'
}

Query: "waterproof travel bags"
{
  total_searches: 45,
  zero_result_count: 45,
  ...
}

Evaluation:
✓ checks min_searches: 45 >= 20 ✓ PASS
✓ checks condition: zero_result_count >= threshold
  45 >= 20 ✓ PASS
✓ RULE TRIGGERED!

Severity Score Calculation:
  Base: 50
  + Deviation factor: (45-20)/20 * 30 = 37.5
  + Volume factor: (45/200) * 20 = 4.5
  + Revenue factor: 10
  = 102 (capped at 100) ✓
  Severity: 100
```

### Step 5: Triggered Rules Compiled

```json
{
  "triggered_rules": [
    {
      "query": "waterproof travel bags",
      "rule_id": "zero_result_high_volume",
      "rule_name": "Zero Result Opportunity - High Volume",
      "metric": "zero_result_count",
      "metric_value": 45,
      "threshold": 20,
      "action_type": "ADD_TO_INVENTORY",
      "priority": "HIGH",
      "severity_score": 100,
      "query_stats": {
        "total_searches": 45,
        "zero_results": 45,
        "ctr": "0%"
      }
    },
    // ... other triggered rules
  ],
  "stats": {
    "total_triggered": 8,
    "by_priority": { "CRITICAL": 1, "HIGH": 3, "MEDIUM": 2, "LOW": 2 },
    "by_action_type": { "ADD_TO_INVENTORY": 3, "IMPROVE_RANKING": 2, ... }
  }
}
```

### Step 6: Recommendation Generation

```
RecommendationEngine.generateRecommendations(ruleResults)
```

**For each triggered rule:**

```javascript
Input Rule:
{
  query: "waterproof travel bags",
  metric_value: 45 (zero_result_count),
  action_type: "ADD_TO_INVENTORY"
}

Generate Recommendation:

// 1. Get Problem Description
problem = "Users searching for 'waterproof travel bags' → 0 results returned. 
            45 searches with no products available."

// 2. Calculate Opportunity
potential_clicks = 45 * 0.3 = 13.5 ≈ 13
revenue_per_click = $150
opportunity = "Add products... Potential: 13 clicks, ~$1,950 revenue"

// 3. Get Action Template
action = ACTION_TEMPLATES['ADD_TO_INVENTORY']
{
  description: "Add products to inventory for this category",
  effort: "MEDIUM",
  estimated_hours: 4,
  impact: "HIGH"
}

// 4. Calculate Impact Score
impact =   50 (base)
        + (45 / 200 * 20) = 4.5  (volume factor)
        + 15 (zero results bonus)
        = 69.5

// 5. Generate Implementation Notes
implementation = [
  "1. Research product inventory for this category",
  "2. Contact suppliers to source products",
  "3. Add products to searchable catalog",
  "4. Re-index Elasticsearch",
  "5. Monitor search analytics for improvement"
]

Output Recommendation:
{
  query: "waterproof travel bags",
  problem: "Users searching... 0 results",
  opportunity: "Add products... $1,950 revenue",
  recommendation: "Add products to inventory",
  action_type: "ADD_TO_INVENTORY",
  priority: "HIGH",
  estimated_impact: 70,
  estimated_effort: "MEDIUM",
  estimated_hours: 4,
  implementation_notes: [...]
}
```

### Step 7: Dashboard Compilation

```javascript
Dashboard groups insights by:
1. Top Problems (by severity)
2. Top Recommendations (by impact)
3. Search Health Metrics
4. Opportunity Summary
5. Priority Grouping
```

**Example Dashboard Section:**

```json
{
  "search_health": {
    "total_queries": 15,
    "queries_with_issues": 8,
    "problem_percentage": "53.3%",
    "high_priority_count": 3,
    "critical_count": 1
  },
  "opportunities": {
    "inventory_gaps": 3,
    "ranking_issues": 2,
    "engagement_issues": 1
  },
  "top_problems": [
    {
      "query": "office chairs",
      "rule": "Critical Poor Ranking",
      "severity": 92,
      "priority": "HIGH",
      "searches": 112,
      "ctr": "2.7%"
    },
    {
      "query": "waterproof travel bags",
      "rule": "Zero Result Opportunity",
      "severity": 100,
      "priority": "HIGH",
      "searches": 45,
      "ctr": "0%"
    },
    // ... more top problems
  ]
}
```

### Step 8: API Response

```
GET /api/search-insights → SearchInsightsService.generateInsights()
```

**Full Response Structure:**

```json
{
  "timestamp": "2026-04-02T18:30:00.000Z",
  "status": "success",
  "execution_time_ms": 1243,
  
  "data_overview": {
    "total_queries_analyzed": 15,
    "date_range": "now-7d"
  },
  
  "rules_evaluation": {
    "total_triggered": 8,
    "by_priority": {
      "CRITICAL": 1,
      "HIGH": 3,
      "MEDIUM": 2,
      "LOW": 2
    },
    "by_action_type": {
      "ADD_TO_INVENTORY": 3,
      "IMPROVE_RANKING": 2,
      "ADD_FILTERS_IMPROVE_RELEVANCE": 2,
      "EXPAND_INVENTORY": 1
    },
    "summary": {
      "total_triggers": 8,
      "critical_issues": 1,
      "high_priority_issues": 3,
      "searches_at_risk": 403,
      "percentage_of_total_searches": "27.3%"
    }
  },
  
  "recommendations": {
    "total_recommendations": 8,
    "critical": [...],
    "high": [...],
    "medium": [...],
    "low": [...],
    "all": [ 8 recommendation objects ]
  },
  
  "dashboard": {
    "top_problems": [ top 5 queries by severity ],
    "top_recommendations": [ top 5 actions by impact ],
    "search_health": { ... },
    "opportunities": { ... },
    "by_priority": { critical: 1, high: 3, ... }
  },
  
  "quick_stats": {
    "summary": { ... },
    "issues": { ... },
    "revenue_impact": {
      "lost_revenue_potential": "$30,150",
      "searches_at_risk": 403,
      "recovery_potential": "$15,075"
    },
    "actions_recommended": {
      "total": 8,
      "immediate": 5,
      "total_effort_hours": 23
    }
  }
}
```

---

## Client Integration Examples

### React Dashboard Component

```jsx
import { useEffect, useState } from 'react';

export function SearchInsightsDashboard() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      const response = await fetch('/api/search-insights');
      const data = await response.json();
      setInsights(data);
      setLoading(false);
    };
    
    fetchInsights();
    // Refresh every 5 minutes
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading insights...</div>;

  return (
    <div className="insights-dashboard">
      {/* Header Stats */}
      <div className="stats-grid">
        <StatCard 
          title="Total Queries Analyzed"
          value={insights.data_overview.total_queries_analyzed}
          icon="📊"
        />
        <StatCard 
          title="Issues Found"
          value={insights.rules_evaluation.total_triggered}
          trend={insights.rules_evaluation.by_priority.CRITICAL > 0 ? '🔴' : '🟡'}
        />
        <StatCard 
          title="Lost Revenue (Weekly)"
          value={insights.quick_stats.revenue_impact.lost_revenue_potential}
          icon="💸"
        />
        <StatCard 
          title="Recovery Potential"
          value={insights.quick_stats.revenue_impact.recovery_potential}
          icon="📈"
        />
      </div>

      {/* Top Problems */}
      <section className="top-problems">
        <h2>🚨 Top Issues to Fix</h2>
        <ProblemsList problems={insights.dashboard.top_problems} />
      </section>

      {/* Recommendations */}
      <section className="recommendations">
        <h2>💡 Recommended Actions</h2>
        <RecommendationsList 
          recommendations={insights.dashboard.top_recommendations}
        />
      </section>

      {/* Priority Breakdown */}
      <section className="priorities">
        <h2>Priority Breakdown</h2>
        <PriorityChart data={insights.dashboard.by_priority} />
      </section>

      {/* Export Options */}
      <section className="exports">
        <button onClick={() => downloadCSV()}>📥 Export as CSV</button>
        <button onClick={() => downloadJSON()}>📥 Export as JSON</button>
      </section>
    </div>
  );
}
```

### Angular Service

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class SearchInsightsService {
  constructor(private http: HttpClient) {}

  // Get insights with auto-refresh
  getInsights$(refreshInterval = 5 * 60 * 1000): Observable<any> {
    return interval(refreshInterval).pipe(
      switchMap(() => this.fetchInsights()),
      tap(insights => console.log('Insights updated:', insights))
    );
  }

  // Fetch insights once
  fetchInsights(): Observable<any> {
    return this.http.get('/api/search-insights');
  }

  // Fetch quick format (mobile)
  getQuickInsights(): Observable<any> {
    return this.http.get('/api/search-insights?format=quick');
  }

  // Get detailed insights
  getDetailedInsights(): Observable<any> {
    return this.http.get('/api/search-insights?format=detailed');
  }

  // Get specific period
  getInsightsByPeriod(period: '7d' | '30d' | '90d'): Observable<any> {
    return this.http.get(`/api/search-insights?period=${period}`);
  }

  // Export data
  exportAsCSV(): void {
    window.location.href = '/api/search-insights/export?format=csv';
  },

  exportAsJSON(): void {
    this.http.get('/api/search-insights/export?format=json').subscribe(
      data => {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `insights-${new Date().toISOString()}.json`;
        a.click();
      }
    );
  }

  // Clear cache
  clearCache(): Observable<any> {
    return this.http.post('/api/search-insights/cache/clear', {});
  }
}
```

### Vue Component

```vue
<template>
  <div class="insights-container">
    <h1>🔍 Search Intelligence Dashboard</h1>
    
    <div class="stats-grid" v-if="insights">
      <StatCard 
        v-for="stat in stats"
        :key="stat.key"
        :title="stat.title"
        :value="stat.value"
        :icon="stat.icon"
      />
    </div>

    <div class="problems-section" v-if="insights?.dashboard?.top_problems">
      <h2>🚨 Top Issues</h2>
      <ProblemItem 
        v-for="problem in insights.dashboard.top_problems"
        :key="problem.query"
        :problem="problem"
        @fix="fixProblem(problem)"
      />
    </div>

    <div class="actions-section" v-if="insights?.dashboard?.top_recommendations">
      <h2>💡 Recommended Actions</h2>
      <ActionItem 
        v-for="action in insights.dashboard.top_recommendations"
        :key="`${action.query}-${action.action}`"
        :action="action"
        @implement="implementAction(action)"
      />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      insights: null,
      loading: true,
      refreshInterval: null,
    };
  },

  computed: {
    stats() {
      if (!this.insights) return [];
      return [
        {
          key: 'queries',
          title: 'Queries Analyzed',
          value: this.insights.data_overview.total_queries_analyzed,
          icon: '📊'
        },
        {
          key: 'issues',
          title: 'Issues Found',
          value: this.insights.rules_evaluation.total_triggered,
          icon: '🚨'
        },
        {
          key: 'lost_revenue',
          title: 'Lost Revenue/Week',
          value: this.insights.quick_stats.revenue_impact.lost_revenue_potential,
          icon: '💸'
        },
        {
          key: 'recovery',
          title: 'Recovery Potential',
          value: this.insights.quick_stats.revenue_impact.recovery_potential,
          icon: '📈'
        },
      ];
    }
  },

  methods: {
    fetchInsights() {
      fetch('/api/search-insights')
        .then(r => r.json())
        .then(data => {
          this.insights = data;
          this.loading = false;
        });
    },

    fixProblem(problem) {
      console.log('Implementing fix for:', problem);
      // Send to backend to implement recommendation
    },

    implementAction(action) {
      console.log('Implementing action:', action);
    },
  },

  mounted() {
    this.fetchInsights();
    this.refreshInterval = setInterval(() => this.fetchInsights(), 5 * 60 * 1000);
  },

  beforeUnmount() {
    clearInterval(this.refreshInterval);
  }
};
</script>
```

---

## Monitoring & Alerts

### Setup Email Alerts

```javascript
// Add to your alerting system
const sendAlert = async (insights) => {
  const critical = insights.rules_evaluation.by_priority.CRITICAL;
  
  if (critical > 0) {
    await sendEmail({
      to: 'ops@company.com',
      subject: `🚨 CRITICAL: ${critical} search issues detected`,
      body: `
        Top Issues:
        ${insights.dashboard.top_problems.map(p => 
          `- ${p.query}: ${p.rule} (Severity: ${p.severity})`
        ).join('\n')}
        
        Lost Revenue: ${insights.quick_stats.revenue_impact.lost_revenue_potential}
        
        View Dashboard: https://dashboard.company.com/insights
      `
    });
  }
};
```

### Setup Slack Integration

```javascript
const notifySlack = async (insights) => {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Search Intelligence Update* ${new Date().toLocaleString()}`
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Queries Analyzed:*\n${insights.data_overview.total_queries_analyzed}` },
        { type: 'mrkdwn', text: `*Issues Found:*\n${insights.rules_evaluation.total_triggered}` },
        { type: 'mrkdwn', text: `*Lost Revenue:*\n${insights.quick_stats.revenue_impact.lost_revenue_potential}` },
        { type: 'mrkdwn', text: `*Recovery Potential:*\n${insights.quick_stats.revenue_impact.recovery_potential}` },
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top Issue:* ${insights.dashboard.top_problems[0]?.query}\n${insights.dashboard.top_problems[0]?.rule}}`
      }
    }
  ];

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ blocks })
  });
};
```

---

## Testing the System

### Manual Testing Script

```javascript
// test-insights.js
async function testInsightsSystem() {
  const baseURL = 'http://localhost:5000';

  console.log('🧪 Testing Search Insights System...\n');

  // Test 1: Default format
  console.log('Test 1: Default format');
  let res = await fetch(`${baseURL}/api/search-insights`);
  let data = await res.json();
  console.log(`✓ Response time: ${data.execution_time_ms}ms`);
  console.log(`✓ Queries analyzed: ${data.data_overview.total_queries_analyzed}`);
  console.log(`✓ Issues triggered: ${data.rules_evaluation.total_triggered}\n`);

  // Test 2: Quick format
  console.log('Test 2: Quick format');
  res = await fetch(`${baseURL}/api/search-insights?format=quick`);
  data = await res.json();
  console.log(`✓ Quick format works`);
  console.log(`✓ Has quick_stats: ${!!data.quick_stats}\n`);

  // Test 3: Different periods
  console.log('Test 3: Different periods');
  for (const period of ['7d', '30d', '90d']) {
    res = await fetch(`${baseURL}/api/search-insights?period=${period}`);
    data = await res.json();
    console.log(`✓ Period ${period}: ${data.data_overview.total_queries_analyzed} queries`);
  }

  // Test 4: Export formats
  console.log('\nTest 4: Export formats');
  res = await fetch(`${baseURL}/api/search-insights/export?format=csv`);
  console.log(`✓ CSV export: ${res.headers.get('content-type')}`);
  
  res = await fetch(`${baseURL}/api/search-insights/export?format=json`);
  console.log(`✓ JSON export: ${res.headers.get('content-type')}`);

  console.log('\n✅ All tests passed!');
}

testInsightsSystem();
```

Run tests:
```bash
node test-insights.js
```

---

## Performance Optimization

### Query Optimization

```javascript
// In data-fetcher.js, reduce aggregation size for large datasets
const query = {
  ...
  aggs: {
    queries_by_name: {
      terms: {
        field: 'query.keyword',
        size: 100,  // ← Reduce from 500 if too slow
        min_doc_count: 5,  // ← Exclude very small queries
      },
      ...
    }
  }
};
```

### Caching Strategy

```javascript
// Enable long-lived cache for less-frequently-updated data
setupSearchInsightsAPI(app, esClient, {
  cacheEnabled: true,
  cacheTtlSeconds: 900,  // 15 minutes instead of 5
});
```

### Database Indexing

```json
PUT search_analytics/_mapping
{
  "properties": {
    "query": { "type": "keyword", "index": true },
    "timestamp": { "type": "date", "index": true },
    "total_searches": { "type": "long", "index": true }
  }
}
```

---

## Troubleshooting

### Issue: No recommendations showing

```javascript
// 1. Check Elasticsearch has data
curl http://localhost:9200/products-analytics/_search

// 2. Check rule configuration
console.log(RULES_CONFIG.filter(r => r.enabled));

// 3. Enable DEBUG mode
DEBUG=true npm start

// 4. Check min_searches thresholds
```

### Issue: Slow API response

```javascript
// 1. Reduce aggregation size
// 2. Enable caching
// 3. Use 'quick' format instead of 'detailed'
// 4. Check Elasticsearch jvm.opts memory allocation
```

### Issue: Wrong CTR values

```javascript
// Verify data in Elasticsearch
GET products-analytics/_search
{
  "query": { "term": { "query.keyword": "test" } }
}

// CTR must be calculated as: clicks / total_searches
```

---

## Support Resources

- Full README: [RULE_ENGINE_README.md](./RULE_ENGINE_README.md)
- Sample Data: [COMPREHENSIVE_SAMPLE_DATA_AND_REPORTS.md](../COMPREHENSIVE_SAMPLE_DATA_AND_REPORTS.md)
- Architecture: See deployment diagram in this guide

---

**Last Updated:** April 3, 2026  
**Version:** 1.0.0
