# Search Intelligence Engine - API & Output Reference

## Endpoint

### GET /search/intelligence
Returns comprehensive business intelligence reports based on tracked search analytics

**URL:** `http://localhost:5001/search/intelligence`

**Method:** GET

**Response:** Business Intelligence Report (JSON)

---

## Request Example

```bash
curl -X GET "http://localhost:5001/search/intelligence" \
  -H "Content-Type: application/json"
```

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5001/search/intelligence" -Method GET -UseBasicParsing | 
  Select-Object -ExpandProperty Content | ConvertFrom-Json
```

---

## Response Structure

### Top-Level Report Object

```javascript
{
  timestamp: "2026-04-02T16:55:00.000Z",
  dataPoints: 5,  // Number of unique queries analyzed
  
  // 1. Executive Summary (Non-Technical, 5 bullets)
  executiveSummary: [
    "🎯 Overall: 62% success rate - Good",
    "💸 Missed revenue: ~$48.5K in lost clicks",
    "📊 Ranking quality: 8 queries with ranking issues",
    "⚡ Quick wins: 5 critical fixes available",
    "📈 Top search: 'noise cancelling headphones' with 340 searches"
  ],
  
  // 2. Metrics Snapshot (Structured data)
  metricsSnapshot: { ... },
  
  // 3. Key Problems (Severity-based)
  keyProblems: [ ... ],
  
  // 4. Recommendations (Ranked by priority)
  recommendations: [ ... ],
  
  // 5. Top 3 Priority Actions
  priorityActions: [ ... ],
  
  // 6. Dashboard Sections
  dashboardSections: { ... },
  
  // 7. Home Page CTA
  homePageCTA: { ... },
  
  // Raw Reports (detailed drill-down)
  detailedReports: { ... },
  
  // AI Insights
  aiInsights: [ ... ]
}
```

---

## Full Response Example

### With Sample Data

After performing these searches:
- 5 users search "shoes" (45 times total) → 9 clicks (20% CTR)
- 3 users search "leather backpack" (28 times) → 2 clicks (7% CTR) + 3 zero results
- 2 users search "laptop" (12 times) → 6 clicks (50% CTR)

**Response:**

```json
{
  "timestamp": "2026-04-02T16:55:00.000Z",
  "dataPoints": 3,
  
  "executiveSummary": [
    "🎯 Overall Search Performance: 27% success rate - MODERATE",
    "💸 Missed Revenue: ~$15,800 in lost clicks from 2 high-volume queries",
    "📊 Ranking Quality: 1 query with suboptimal ranking (avg position 4.2)",
    "⚡ Quick Wins Available: 2 critical issues solvable within 1 hour",
    "📈 Opportunity: Implementing top 3 recommendations could improve CTR by ~20% and recover ~$4.7K"
  ],
  
  "metricsSnapshot": {
    "success_rate": "27%",
    "failure_rate": "73%",
    "avg_ctr": "26%",
    "total_searches": 85,
    "total_clicks": 17,
    "lost_opportunities": "$15,800",
    "ranking_issues": 1,
    "quick_wins": 2,
    "frustrated_queries": 1
  },
  
  "keyProblems": [
    {
      "problem": "🟡 Ranking: Users Click Below-Optimal Results",
      "description": "1 query shows users clicking position 4.2 on average instead of top 3.",
      "impact": "Medium - affects conversion rate",
      "queries": 1
    },
    {
      "problem": "🟡 Content Gap: Zero Result Queries",
      "description": "1 query returns no results. Users need products you don't have.",
      "impact": "Medium - lost sales opportunity",
      "queries": 1
    }
  ],
  
  "recommendations": [
    {
      "title": "Add leather backpack options to catalog",
      "description": "3 zero-result searches for 'leather backpack' indicate demand",
      "affectedQueries": 1,
      "estimatedImpact": "Convert 28 searches at 30% CTR = 8+ clicks",
      "effort": "Medium",
      "priority": "High",
      "timeToImplement": "3-5 days"
    },
    {
      "title": "Improve search results for 'shoes'",
      "description": "Only 20% CTR despite 45 searches. Add synonyms or boost quality results.",
      "affectedQueries": 1,
      "estimatedImpact": "+15-25% CTR improvement = +6-11 clicks",
      "effort": "Low",
      "priority": "High",
      "timeToImplement": "< 1 day"
    }
  ],
  
  "priorityActions": [
    {
      "rank": 1,
      "icon": "🎯",
      "title": "Add leather backpack stock",
      "query": "leather backpack",
      "action": "Add 3-5 leather backpack variants to inventory",
      "impact": "Convert ~8 potential clicks from 28 searches",
      "effort": "Medium (supplier coordination)",
      "timeframe": "3-5 days"
    },
    {
      "rank": 2,
      "icon": "⚡",
      "title": "Improve 'shoes' search results",
      "query": "shoes",
      "action": "Add synonyms (sneakers, trainers) and boost best-sellers",
      "impact": "Improve CTR from 20% to 30-35%",
      "effort": "Low (configuration)",
      "timeframe": "< 1 day"
    },
    {
      "rank": 3,
      "icon": "📈",
      "title": "Boost 'laptop' ranking",
      "query": "laptop",
      "action": "Already performing at 50% CTR - maintain and monitor",
      "impact": "Maintain current performance",
      "effort": "Very Low (monitoring)",
      "timeframe": "Ongoing"
    }
  ],
  
  "dashboardSections": {
    "searchHealth": {
      "title": "🔍 Search Health",
      "status": "⚠️ Fair",
      "metrics": {
        "successRate": "27%",
        "failureRate": "73%",
        "totalSearches": "85",
        "avgCTR": "26%"
      },
      "problemAreas": [
        {
          "query": "leather backpack",
          "searches": 28,
          "ctr": "7%",
          "status": "🔴 Zero Results + Low CTR"
        },
        {
          "query": "shoes",
          "searches": 45,
          "ctr": "20%",
          "status": "🟡 Below Target"
        }
      ],
      "strengths": [
        {
          "query": "laptop",
          "searches": 12,
          "ctr": "50%",
          "status": "🟢 Strong"
        }
      ]
    },
    
    "missedOpportunities": {
      "title": "💰 Missed Opportunities",
      "topLosses": [
        {
          "query": "leather backpack",
          "searches": 28,
          "currentCTR": "7%",
          "lostClicks": 12,
          "opportunity": "$1,800",
          "issue": "Zero Results"
        },
        {
          "query": "shoes",
          "searches": 45,
          "currentCTR": "20%",
          "lostClicks": 13,
          "opportunity": "$1,950",
          "issue": "Low Relevance"
        }
      ],
      "summary": "2 queries losing $3,750 potential revenue"
    },
    
    "quickWins": {
      "title": "⚡ Quick Wins",
      "topActions": [
        {
          "query": "shoes",
          "fix": "Add Synonyms",
          "impact": "Improve CTR from 20% to 30%+",
          "effort": "Low (< 1 day)"
        },
        {
          "query": "leather backpack",
          "fix": "Add Catalog Items",
          "impact": "Convert 100% of 28 searches to sales",
          "effort": "Medium (3-5 days)"
        }
      ],
      "summary": "2 critical quick wins available"
    },
    
    "trendingNow": {
      "title": "🔥 Trending Now",
      "hotSearches": [
        "🔥 laptop (12 searches, 50% CTR) - Best performer",
        "📈 shoes (45 searches, 20% CTR) - High volume",
        "⚠️ leather backpack (28 searches, 7% CTR) - Needs help"
      ],
      "risingSearches": [
        "📈 shoes (trending upward)"
      ],
      "declineWatching": [
        "⚠️ leather backpack (concerning low engagement)"
      ]
    },
    
    "userPainPoints": {
      "title": "😤 User Pain Points",
      "frustrationLevel": "medium",
      "problematicQueries": [
        {
          "query": "leather backpack",
          "level": "High",
          "signals": ["Zero results", "Low engagement"],
          "message": "Users searching for 'leather backpack' are frustrated - no products found."
        }
      ],
      "message": "Addressing 'leather backpack' would eliminate primary frustration."
    },
    
    "rankingIssues": {
      "title": "📉 Ranking Issues",
      "qualityScore": "33% top-ranked",
      "problemQueries": [
        {
          "query": "shoes",
          "avgPosition": 3.2,
          "clicks": 9,
          "severity": "Warning"
        }
      ]
    }
  },
  
  "homePageCTA": {
    "main": "⚡ 2 Easy Wins Available",
    "sub": "Quick fixes to boost search performance by 20%+",
    "cta": "See Quick Wins →",
    "urgency": "high"
  },
  
  "detailedReports": {
    "successRateReport": {
      "overallSuccessRate": 27,
      "overallFailureRate": 73,
      "totalSearches": 85,
      "totalClicks": 17,
      "problemQueries": [
        {
          "query": "leather backpack",
          "searches": 28,
          "ctr": "7%",
          "issue": "No results + low engagement"
        },
        {
          "query": "shoes",
          "searches": 45,
          "ctr": "20%",
          "issue": "Below target engagement"
        }
      ],
      "performantQueries": [
        {
          "query": "laptop",
          "searches": 12,
          "ctr": "50%",
          "status": "Excellent"
        }
      ],
      "insight": "27% success rate indicates optimization opportunities..."
    },
    
    "lostOpportunityReport": {
      "lostQueries": [
        {
          "query": "leather backpack",
          "searches": 28,
          "currentClicks": 2,
          "currentCTR": 7,
          "zeroResults": 3,
          "potentialClicks": 8,
          "lostClicks": 6,
          "estimatedOpportunityCost": "$900",
          "problemType": "Zero Results",
          "userWantedButDidntGet": "Durable, stylish leather backpacks"
        }
      ],
      "totalLostOpportunityCost": "$3750",
      "totalLostClicks": 25,
      "insight": "~$3.75K in lost opportunity from 2 high-impact queries"
    },
    
    "rankingEffectivenessReport": {
      "rankingIssues": [
        {
          "query": "shoes",
          "searches": 45,
          "clicks": 9,
          "avgClickPosition": 3.2,
          "issue": "🟡 Warning: Below-optimal ranking",
          "recommendation": "Boost top shoes to positions 1-2"
        }
      ],
      "rankingQualityScore": 33,
      "insight": "Only 33% of queries have users clicking top 3 results"
    },
    
    "quickWinsReport": {
      "quickWins": [
        {
          "query": "shoes",
          "problemType": "Low Relevance",
          "severity": "High",
          "searches": 45,
          "suggestedFix": "Synonym Addition",
          "action": "Add synonyms: sneaker, trainer, athletic shoe",
          "impact": "Improve CTR from 20% to 30%+",
          "effort": "Low"
        },
        {
          "query": "leather backpack",
          "problemType": "Zero Results",
          "severity": "Critical",
          "searches": 28,
          "suggestedFix": "Add Catalog Items",
          "action": "Add 3-5 leather backpacks to inventory",
          "impact": "Convert all 28 searches to potential sales",
          "effort": "Medium"
        }
      ],
      "totalWins": 2,
      "insight": "2 quick wins identified that could improve search"
    },
    
    "trendingSearchesReport": {
      "rising": [
        {
          "query": "shoes",
          "searches": 45,
          "ctr": 20,
          "trend": "📈 Rising"
        }
      ],
      "hot": [
        {
          "query": "laptop",
          "searches": 12,
          "ctr": 50,
          "trend": "🔥 Hot"
        }
      ]
    },
    
    "frustrationSignalsReport": {
      "frustratedQueries": [
        {
          "query": "leather backpack",
          "searches": 28,
          "frustrationLevel": 7,
          "signals": ["Zero results", "Low engagement"],
          "userMessage": "Users searching for 'leather backpack' can't find products"
        }
      ],
      "totalFrustratedQueries": 1,
      "insight": "1 query shows user frustration signals"
    }
  },
  
  "aiInsights": [
    "Search volume concentrated in 3 queries - unbalanced catalog",
    "Leather backpack demand clear but unmet - content gap",
    "Shoes performing at 20% CTR but needs better relevance",
    "Laptop category performing excellently - good benchmark",
    "Zero-result queries are highest priority for fix"
  ]
}
```

---

## Dashboard Display Example

When this JSON is displayed in the SearchInsights component:

```
┌─────────────────────────────────────────┐
│  🔍 SEARCH HEALTH                       │
├─────────────────────────────────────────┤
│  Status: ⚠️ Fair                         │
│                                         │
│  Metrics:                               │
│  • Success Rate: 27%                    │
│  • Failure Rate: 73%                    │
│  • Total Searches: 85                   │
│  • Avg CTR: 26%                         │
│                                         │
│  Problem Areas:                         │
│  • 🔴 leather backpack - Zero Results   │
│  • 🟡 shoes - Below Target              │
│                                         │
│  Strengths:                             │
│  • 🟢 laptop - 50% CTR (Strong)         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 MISSED OPPORTUNITIES                │
├─────────────────────────────────────────┤
│  Top Losses: $3,750 potential revenue   │
│                                         │
│  • leather backpack: $1,800 lost        │
│  • shoes: $1,950 lost                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ⚡ QUICK WINS                          │
├─────────────────────────────────────────┤
│  2 critical fixes available             │
│                                         │
│  1. Add synonyms to shoes (Low effort)  │
│  2. Add leather backpacks (Medium)      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🎯 TOP 3 PRIORITY ACTIONS              │
├─────────────────────────────────────────┤
│  🎯 #1: Add leather backpack stock      │
│     Impact: Convert 8+ clicks           │
│     Timeframe: 3-5 days                 │
│                                         │
│  ⚡ #2: Improve 'shoes' search         │
│     Impact: +15-25% CTR                 │
│     Timeframe: < 1 day                  │
│                                         │
│  📈 #3: Maintain laptop performance    │
│     Impact: Keep current 50% CTR       │
│     Timeframe: Ongoing                  │
└─────────────────────────────────────────┘
```

---

## Using the Intelligence in Your App

### Frontend Integration

```javascript
// Fetch intelligence
const response = await fetch('http://localhost:5001/search/intelligence');
const report = await response.json();

// Display metrics
console.log(report.executiveSummary);      // Show bullet points
console.log(report.metricsSnapshot);       // Show KPIs
console.log(report.priorityActions);       // Show action items

// Display dashboard
<SearchInsights report={report} />
```

### React Component Example

```jsx
import { useEffect, useState } from 'react';

function SearchIntelligenceDashboard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5001/search/intelligence')
      .then(res => res.json())
      .then(data => {
        setReport(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading intelligence...</div>;
  if (!report) return <div>No data</div>;

  return (
    <div>
      {/* Executive Summary */}
      <div className="summary">
        {report.executiveSummary.map((bullet, i) => (
          <p key={i}>{bullet}</p>
        ))}
      </div>

      {/* CTA */}
      <div className="cta">
        <h2>{report.homePageCTA.main}</h2>
        <p>{report.homePageCTA.sub}</p>
        <button>{report.homePageCTA.cta}</button>
      </div>

      {/* Dashboard Sections */}
      {Object.values(report.dashboardSections).map(section => (
        <DashboardSection key={section.title} section={section} />
      ))}
    </div>
  );
}
```

---

## Refresh Frequency

- **Endpoint:** Fresh data on every request
- **Tracking:** Events captured in real-time
- **Analytics Index:** Updated as searches happen
- **Reports:** Generated on-demand (5 Query)
- **Dashboard:** Can refresh every 30 seconds

---

## Summary

Use `/search/intelligence` to get:
- ✅ 7-part business intelligence report
- ✅ Executive summary (5 bullets)
- ✅ 6 specialized reports
- ✅ Key problems identified
- ✅ Ranked recommendations
- ✅ Top 3 priority actions
- ✅ Dashboard-ready sections
- ✅ Home page CTA
- ✅ AI pattern insights

**All from tracked search analytics data.**

