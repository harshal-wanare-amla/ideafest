# 🚀 Rule-Based AI Search Intelligence Engine

## Overview

A production-ready, modular Rule-Engine for e-commerce search analytics that:
- ✅ **Automatically detects business problems** from search data
- ✅ **Evaluates configurable rules** against Elasticsearch analytics
- ✅ **Generates AI-driven recommendations** for search optimization
- ✅ **Prioritizes actions** by business impact
- ✅ **Exports insights** via REST API with multiple formats

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  DATA LAYER (data-fetcher.js)                           │
│  - Fetches aggregated analytics from Elasticsearch      │
│  - Calculates derived metrics (CTR, refinement rate)    │
│  - Handles trending queries & zero-result analysis      │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  RULE ENGINE (rule-engine.js)                           │
│  - Evaluates 10+ configurable rules                     │
│  - Detects combo rules (multiple conditions)            │
│  - Calculates severity scores                           │
│  - Groups triggered rules by priority                   │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  RECOMMENDATION ENGINE (recommendation-engine.js)       │
│  - Generates actionable recommendations                 │
│  - Calculates impact scores                             │
│  - Provides implementation notes                        │
│  - Estimates effort & revenue impact                    │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  API LAYER (search-insights-api.js)                     │
│  - REST endpoints for insights access                   │
│  - Multiple export formats (JSON, CSV)                  │
│  - Dashboard-ready data grouping                        │
│  - Response caching (configurable TTL)                  │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  API ENDPOINTS (server.js)                              │
│  - GET /api/search-insights                             │
│  - GET /api/search-insights/export                      │
│  - POST /api/search-insights/cache/clear                │
└─────────────────────────────────────────────────────────┘
```

---

## Core Files

### 1. **rules-config.js** - Rule Configuration
Defines all configurable rules, action templates, and severity levels.

```javascript
// Each rule structure:
{
  rule_id: 'zero_result_high_volume',
  rule_name: 'Zero Result Opportunity - High Volume',
  metric: 'zero_result_count',
  operator: '>=',
  threshold: 20,
  action_type: 'ADD_TO_INVENTORY',
  priority: 'HIGH',
  min_searches: 20,
  enabled: true,
}
```

**Key Rules Included:**
- Zero Result Opportunities (content gaps)
- Low CTR Issues (ranking/relevance problems)
- High Refinement Rate (user confusion)
- Poor Ranking (click position analysis)
- High Volume Queries (trending detection)
- Niche Products (low engagement)
- Insufficient Results (inventory gaps)
- Scroll Depth Analysis
- Time Spent Analysis

### 2. **rule-engine.js** - Rule Evaluation Logic

```javascript
const engine = new RuleEngine();
const results = engine.evaluateRules(analyticsData);

// Results structure:
{
  triggered_rules: [...],     // Rules that were triggered
  stats: {
    total_queries_evaluated: 15,
    total_rules_checked: 150,
    total_triggers: 8,
    by_priority: { CRITICAL: 2, HIGH: 3, MEDIUM: 2, LOW: 1 },
    by_action_type: { ... }
  },
  summary: { ... }
}
```

**Features:**
- ✅ Flexible condition evaluation (>, <, >=, <=, ==)
- ✅ Combo rules (multiple conditions)
- ✅ Severity scoring (0-100 scale)
- ✅ Minimum search volume thresholds
- ✅ Grouping by priority & action type

### 3. **data-fetcher.js** - Elasticsearch Integration

```javascript
const fetcher = new DataFetcher(esClient, {
  indexName: 'search_analytics',
  dateRangeGte: 'now-7d',
});

const analyticsData = await fetcher.fetchAggregatedAnalytics();
/* Returns:
[
  {
    query: "backpack",
    total_searches: 234,
    clicks: 156,
    ctr: 0.667,
    zero_result_count: 0,
    avg_click_position: 1.2,
    refinement_rate: 0.009,
    ...
  }
]
*/
```

**Capabilities:**
- ✅ Aggregates query-level metrics from Elasticsearch
- ✅ Calculates derived metrics (CTR = clicks/searches)
- ✅ Fetches trending queries
- ✅ Analyzes zero-result queries
- ✅ Mock data for development/testing

### 4. **recommendation-engine.js** - Insight Generation

```javascript
const recEngine = new RecommendationEngine();
const insights = recEngine.generateRecommendations(ruleResults);

// Recommendation structure:
{
  query: "office chairs",
  triggered_rules: [...],
  primary_rule_name: "Critical Low CTR",
  problem: "Users searching for office chairs are not clicking results...",
  opportunity: "Improve ranking... Potential: +14 clicks, +$2,100 revenue",
  recommendation: "Adjust ranking algorithm or boost relevance",
  action_type: "IMPROVE_RANKING",
  priority: "HIGH",
  severity_score: 85,
  estimated_impact: 75,
  estimated_effort: "LOW",
  estimated_hours: 2,
  impact_category: "Ranking/Algorithm",
  implementation_notes: [
    "1. Review top 5 search results - are they relevant?",
    "2. Check if product titles match search intent",
    "3. Adjust ranking weight/boost for this category",
    ...
  ]
}
```

**Features:**
- ✅ Template-based recommendation generation
- ✅ Impact score calculation
- ✅ Effort estimation
- ✅ Revenue impact analysis
- ✅ Step-by-step implementation guides

### 5. **search-insights-api.js** - REST API Layer

```javascript
setupSearchInsightsAPI(app, esClient, {
  indexName: 'search_analytics',
  cacheEnabled: true,
  cacheTtlSeconds: 300,
});
```

---

## API Endpoints

### GET /api/search-insights
**Main endpoint for getting search insights**

```bash
# Default (balanced response)
GET /api/search-insights

# Quick format (mobile-friendly)
GET /api/search-insights?format=quick

# Detailed format (full response)
GET /api/search-insights?format=detailed

# Custom date range
GET /api/search-insights?period=30d  # 7d, 30d, 90d, today

# Filter by priority
GET /api/search-insights?priority=HIGH  # CRITICAL, HIGH, MEDIUM, LOW, ALL
```

**Response Structure:**
```json
{
  "timestamp": "2026-04-02T18:30:00.000Z",
  "status": "success",
  "data_period": {
    "range": "now-7d",
    "end": "now"
  },
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
    }
  },
  "recommendations": {
    "total_recommendations": 8,
    "critical": [...],
    "high": [...],
    "medium": [...],
    "low": [...],
    "all": [...]
  },
  "dashboard": {
    "top_problems": [...],
    "top_recommendations": [...],
    "search_health": {
      "total_queries": 15,
      "queries_with_issues": 8,
      "problem_percentage": "53.3%"
    }
  },
  "quick_stats": {
    "summary": {...},
    "issues": {...},
    "revenue_impact": {...},
    "actions_recommended": {...}
  }
}
```

### GET /api/search-insights/export
**Export recommendations in different formats**

```bash
# Export as CSV
GET /api/search-insights/export?format=csv

# Export as JSON
GET /api/search-insights/export?format=json
```

### POST /api/search-insights/cache/clear
**Clear cached results**

```bash
POST /api/search-insights/cache/clear
```

---

## Usage Examples

### Complete Pipeline

```javascript
import { SearchInsightsService } from './search-insights-api.js';

const service = new SearchInsightsService(esClient);
const insights = await service.generateInsights({
  dateRangeGte: 'now-7d',
});

console.log('Critical Issues:', insights.rules_evaluation.by_priority.CRITICAL);
console.log('Top Recommendation:', insights.recommendations.all[0]);
console.log('Lost Revenue:', insights.quick_stats.revenue_impact.lost_revenue_potential);
```

### Rule Engine Only

```javascript
import { RuleEngine } from './rule-engine.js';

const engine = new RuleEngine();
const results = engine.evaluateRules(analyticsData);

// Get high-priority rules
const urgent = engine.getTriggeredRulesByPriority('HIGH');

// Get by action type
const inventoryGaps = engine.getTriggeredRulesByActionType('ADD_TO_INVENTORY');
```

### Data Fetching Only

```javascript
import { DataFetcher } from './data-fetcher.js';

const fetcher = new DataFetcher(esClient);
const data = await fetcher.fetchAggregatedAnalytics();
const trending = await fetcher.fetchTrendingQueries(7);
const zeroResults = await fetcher.fetchZeroResultQueries();
```

### Recommendations Only

```javascript
import { RecommendationEngine } from './recommendation-engine.js';

const recEngine = new RecommendationEngine();
const recommendations = recEngine.generateRecommendations(ruleResults);

// Get dashboard-ready groups
const dashboard = recEngine.getDashboardGrouped();
```

---

## Key Metrics Tracked

| Metric | Description | Formula |
|--------|-------------|---------|
| **CTR** | Click-Through Rate | clicks / total_searches |
| **Zero Result Rate** | Searches returning 0 results | zero_result_count / total_searches |
| **Refinement Rate** | Users refining queries | refinement_count / total_searches |
| **Avg Click Position** | Average position of clicked result | sum(position) / clicks |
| **Scroll Depth** | How far users scroll (0-1) | avg scroll percentage |
| **Severity Score** | How severe the issue is (0-100) | calculated from deviation + volume + revenue |

---

## Configuration

### Enable/Disable Rules

Edit `rules-config.js`:

```javascript
const RULES_CONFIG = [
  {
    rule_id: 'zero_result_high_volume',
    // ... rule config
    enabled: true,  // Set to false to disable
  },
  // ...
];
```

### Customize Thresholds

```javascript
export const CATEGORY_THRESHOLDS = {
  HIGH_VOLUME: 150,        // Queries above 150 are "trending"
  CRITICAL_CTR: 0.05,      // 5% CTR threshold
  POOR_CTR: 0.15,          // 15% CTR threshold
  GOOD_CTR: 0.40,          // 40% CTR threshold
};
```

### Cache Configuration

```javascript
setupSearchInsightsAPI(app, esClient, {
  cacheEnabled: true,           // Enable/disable caching
  cacheTtlSeconds: 300,         // 5-minute cache
});
```

---

## Response Examples

### Top Problems (Dashboard)

```json
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
    "query": "organic cotton baby clothes",
    "rule": "Zero Result Opportunity",
    "severity": 85,
    "priority": "HIGH",
    "searches": 89,
    "ctr": "0%"
  }
]
```

### Top Recommendations (Dashboard)

```json
"top_recommendations": [
  {
    "query": "office chairs",
    "action": "IMPROVE_RANKING",
    "impact": 92,
    "priority": "HIGH",
    "effort_hours": 2
  },
  {
    "query": "organic cotton baby clothes",
    "action": "ADD_TO_INVENTORY",
    "impact": 85,
    "priority": "HIGH",
    "effort_hours": 4
  }
]
```

### Quick Stats (Mobile)

```json
"quick_stats": {
  "summary": {
    "total_searches_analyzed": 1478,
    "average_ctr": "34.2%",
    "queries_analyzed": 15
  },
  "issues": {
    "total_issues_found": 8,
    "critical_issues": 1,
    "high_priority_issues": 3
  },
  "revenue_impact": {
    "lost_revenue_potential": "$30,150",
    "searches_at_risk": 245,
    "recovery_potential": "$15,075"
  },
  "actions_recommended": {
    "total": 8,
    "immediate": 5,
    "total_effort_hours": 23
  }
}
```

---

## Business Impact

### Revenue Recovery Potential

Each triggered rule identifies lost revenue:

```
Zero Result Queries (245 searches) × 30% conversion × $150/click = $11,025 lost

With Fix: 245 × 30% × $150 = Potential recovery
```

### Effort vs. Impact Matrix

| Action | Effort | Impact | Priority |
|--------|--------|--------|----------|
| Add inventory | MEDIUM (4h) | HIGH | CRITICAL |
| Fix ranking | LOW (2h) | HIGH | HIGH |
| Add filters | MEDIUM (3h) | MEDIUM | MEDIUM |
| Boost category | LOW (1h) | MEDIUM | MEDIUM |

---

## Testing & Development

### Mock Data Mode

Auto-enabled when Elasticsearch has no data:

```bash
# Set DEBUG=true to see mock data
DEBUG=true npm start
```

### Manual Rule Testing

```bash
POST /api/search-insights/rules/check
{
  "rule_id": "zero_result_high_volume",
  "query_data": {
    "query": "test product",
    "total_searches": 100,
    "zero_result_count": 50,
     ...
  }
}
```

---

## Production Checklist

- [ ] Configure Elasticsearch index name (`ELASTICSEARCH_INDEX`)
- [ ] Set analytics index (`{INDEX}-analytics`)
- [ ] Enable caching for performance
- [ ] Configure date ranges for your data
- [ ] Test with sample data first
- [ ] Monitor API response times
- [ ] Set up alerts for critical issues
- [ ] Document custom rules added
- [ ] Train team on insights interpretation

---

## Troubleshooting

### No Data Returned

```
Solution:
1. Verify Elasticsearch is running
2. Check index name matches: {ES_INDEX}-analytics
3. Verify search_analytics index has data
4. Check date range: 'now-7d' to 'now'
```

### Rules Not Triggering

```
Solution:
1. Check rule is enabled: rule.enabled = true
2. Verify threshold values make sense
3. Check min_searches threshold
4. Enable DEBUG mode to see evaluated metrics
```

### Slow API Response

```
Solution:
1. Enable caching: cacheEnabled: true
2. Reduce date range: 'now-7d' instead of 'now-90d'
3. Limit aggregation size in data-fetcher.js
4. Use 'quick' format instead of 'detailed'
```

---

## Future Enhancements

- 🔮 Machine Learning-based threshold optimization
- 🔮 A/B testing for recommendation effectiveness
- 🔮 Real-time alerting system
- 🔮 Custom rule builder UI
- 🔮 Recommendation auto-implementation
- 🔮 Multi-language support
- 🔮 Competitor analysis integration

---

## License & Support

Part of the Ideafest Search Analytics Platform.  
For issues and questions, contact: support@ideafest.dev
