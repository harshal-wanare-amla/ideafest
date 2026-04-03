/**
 * Search Analytics & Insights Engine
 * Analyzes search data and generates actionable insights
 */

/**
 * Calculate CTR (Click-Through Rate)
 */
function calculateCTR(clicks, impressions) {
  if (impressions === 0) return 0;
  return ((clicks / impressions) * 100).toFixed(2);
}

/**
 * Analyze raw search analytics and generate insights
 */
async function analyzeSearchAnalytics(analyticsData, genAI) {
  try {
    console.log('\n📊 === ANALYZING SEARCH ANALYTICS ===');
    console.log(`Processing ${analyticsData.length} search queries`);

    if (analyticsData.length === 0) {
      return generateEmptyReport();
    }

    // Process data
    const processedData = analyticsData.map(item => ({
      query: item.query || 'Unknown',
      searches: item.total_searches || item.searches || 1,
      avgResultsCount: item.results_count_avg || item.avg_results || 0,
      clicks: item.clicks || 0,
      avgClickPosition: item.avg_click_position || 0,
      zeroResults: item.zero_result_count || item.zero_results || 0,
      refinementRate: (item.refinement_rate || 0) * 100, // Convert to percentage
      ctr: calculateCTR(item.clicks || 0, item.total_searches || 1),
    }));

    // Sort and categorize
    const topQueries = processedData
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 10);

    const zeroResultQueries = processedData
      .filter(q => q.zeroResults > 0)
      .sort((a, b) => b.zeroResults - a.zeroResults)
      .slice(0, 5);

    const lowCTRQueries = processedData
      .filter(q => q.searches >= 5 && parseFloat(q.ctr) < 5)
      .sort((a, b) => parseFloat(a.ctr) - parseFloat(b.ctr))
      .slice(0, 5);

    const highRefinementQueries = processedData
      .filter(q => q.refinementRate > 30)
      .sort((a, b) => b.refinementRate - a.refinementRate)
      .slice(0, 5);

    // Generate AI insights
    const aiInsights = await generateAIInsights(
      topQueries,
      zeroResultQueries,
      lowCTRQueries,
      highRefinementQueries,
      genAI
    );

    // Compile report
    const report = {
      timestamp: new Date().toISOString(),
      totalQueries: processedData.length,
      totalSearches: processedData.reduce((sum, q) => sum + q.searches, 0),
      avgCTR: (
        processedData.reduce((sum, q) => sum + parseFloat(q.ctr), 0) /
        processedData.length
      ).toFixed(2),
      
      metricsSnapshot: {
        top_queries: topQueries.slice(0, 5).map(q => ({
          query: q.query,
          searches: q.searches,
          ctr: q.ctr + '%',
          avg_position: q.avgClickPosition.toFixed(1),
        })),
        zero_results: zeroResultQueries.slice(0, 5).map(q => ({
          query: q.query,
          zero_result_count: q.zeroResults,
          searches: q.searches,
        })),
        low_ctr: lowCTRQueries.slice(0, 5).map(q => ({
          query: q.query,
          ctr: q.ctr + '%',
          searches: q.searches,
          potential_impression_loss: Math.round(q.searches * (20 - parseFloat(q.ctr)) / 100),
        })),
        high_refinement: highRefinementQueries.slice(0, 5).map(q => ({
          query: q.query,
          refinement_rate: q.refinementRate.toFixed(1) + '%',
          searches: q.searches,
        })),
      },

      problemDetection: {
        relevance_issues: lowCTRQueries.slice(0, 3).map(q => ({
          query: q.query,
          problem: `High impressions (${q.searches}) but only ${q.clicks} clicks - Poor relevance`,
          ctr: q.ctr + '%',
        })),
        content_gaps: zeroResultQueries.slice(0, 3).map(q => ({
          query: q.query,
          problem: `Searched ${q.searches} times but returned zero results`,
        })),
        ranking_issues: processedData
          .filter(q => q.avgClickPosition > 5 && q.clicks > 0)
          .sort((a, b) => b.searches - a.searches)
          .slice(0, 3)
          .map(q => ({
            query: q.query,
            problem: `Users clicking position ${q.avgClickPosition.toFixed(1)} - Top results not relevant`,
            searches: q.searches,
          })),
        intent_mismatch: highRefinementQueries.slice(0, 3).map(q => ({
          query: q.query,
          problem: `${q.refinementRate.toFixed(0)}% refinement rate - Users searching again after initial results`,
        })),
      },

      aiRecommendations: aiInsights.recommendations || [],

      priorityActions: aiInsights.priorityActions || [],

      smartInsights: aiInsights.smartInsights || [],

      businessImpact: {
        ctr_improvement_potential: `${Math.round((20 - parseFloat(processedData.reduce((sum, q) => sum + parseFloat(q.ctr), 0) / processedData.length)) * 10)}% improvement possible`,
        engagement_uplift: `Fixing top 5 zero-result queries could unlock ${zeroResultQueries.slice(0, 5).reduce((sum, q) => sum + q.searches, 0)} additional searches`,
        revenue_opportunity: `Estimated ${Math.round(zeroResultQueries.slice(0, 5).reduce((sum, q) => sum + q.searches, 0) * 15)}+ lost customer interactions`,
      },

      homePageReport: {
        title: 'Search Performance Insights',
        sections: [
          {
            title: '🔍 What Customers Are Searching',
            content: topQueries.slice(0, 3).map(q => `"${q.query}" (${q.searches} searches)`).join(' • '),
            insight: `Top searches show demand for ${topQueries[0].query}`,
          },
          {
            title: '⚠️ Where We\'re Losing Customers',
            content: zeroResultQueries.length > 0 
              ? `${zeroResultQueries.length} searches returned no results`
              : 'All searches are returning results',
            detail: zeroResultQueries.slice(0, 2).map(q => `"${q.query}"`).join(', '),
            urgency: zeroResultQueries.length > 5 ? 'high' : 'medium',
          },
          {
            title: '⚡ Quick Wins to Improve Search',
            content: aiInsights.priorityActions?.slice(0, 2)?.map(a => a.action).join(' • ') || 'Add missing product categories',
          },
        ],
      },

      cta: '🔍 View Search Insights → Discover what your customers are looking for and optimize your inventory',
    };

    console.log('✅ Analytics report generated');
    return report;
  } catch (error) {
    console.error('Error analyzing search analytics:', error.message);
    return generateEmptyReport();
  }
}

/**
 * Generate AI-powered insights using Gemini
 */
async function generateAIInsights(topQueries, zeroResultQueries, lowCTRQueries, highRefinementQueries, genAI) {
  if (!genAI) {
    return {
      recommendations: [],
      priorityActions: [],
      smartInsights: [],
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an e-commerce search expert. Analyze this search data and provide insights:

TOP QUERIES (Most searched):
${topQueries.slice(0, 5).map(q => `- "${q.query}": ${q.searches} searches, ${q.ctr}% CTR, Position ${q.avgClickPosition.toFixed(1)}`).join('\n')}

ZERO RESULT QUERIES (Users searching but getting nothing):
${zeroResultQueries.slice(0, 5).map(q => `- "${q.query}": ${q.searches} searches with 0 results`).join('\n')}

LOW CTR QUERIES (High impressions, low engagement):
${lowCTRQueries.slice(0, 5).map(q => `- "${q.query}": ${q.ctr}% CTR, ${q.searches} searches`).join('\n')}

HIGH REFINEMENT QUERIES (Users searching again):
${highRefinementQueries.slice(0, 5).map(q => `- "${q.query}": ${q.refinementRate.toFixed(0)}% refinement rate`).join('\n')}

Generate a JSON response with this structure:
{
  "recommendations": [
    {
      "query": "query_name",
      "problem": "specific_problem",
      "suggested_fix": "actionable_solution",
      "fix_type": "synonym|boost|content_gap|redirect"
    }
  ],
  "priority_actions": [
    {
      "rank": 1,
      "action": "specific_action",
      "impact": "business_impact",
      "effort": "low|medium|high"
    }
  ],
  "smart_insights": [
    "insight_about_trends_or_patterns"
  ]
}

Be specific, actionable, and business-focused. Keep insights concise.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    const aiData = JSON.parse(jsonText);

    return {
      recommendations: aiData.recommendations || [],
      priorityActions: aiData.priority_actions || [],
      smartInsights: aiData.smart_insights || [],
    };
  } catch (error) {
    console.warn('⚠️ AI insights generation failed:', error.message);
    return {
      recommendations: [],
      priorityActions: [],
      smartInsights: ['Search analytics show opportunity for query optimization'],
    };
  }
}

/**
 * Generate empty report template
 */
function generateEmptyReport() {
  return {
    timestamp: new Date().toISOString(),
    totalQueries: 0,
    totalSearches: 0,
    avgCTR: '0.00',
    metricsSnapshot: {
      top_queries: [],
      zero_results: [],
      low_ctr: [],
      high_refinement: [],
    },
    problemDetection: {
      relevance_issues: [],
      content_gaps: [],
      ranking_issues: [],
      intent_mismatch: [],
    },
    aiRecommendations: [],
    priorityActions: [],
    smartInsights: [],
    businessImpact: {
      ctr_improvement_potential: 'No data yet',
      engagement_uplift: 'No data yet',
      revenue_opportunity: 'No data yet',
    },
    homePageReport: {
      title: 'Search Performance Insights',
      sections: [
        {
          title: '🔍 What Customers Are Searching',
          content: 'Collecting data...',
        },
        {
          title: '⚠️ Where We\'re Losing Customers',
          content: 'Collecting data...',
        },
        {
          title: '⚡ Quick Wins to Improve Search',
          content: 'Collecting data...',
        },
      ],
    },
    cta: '🔍 View Search Insights → Enable search tracking to see customer insights',
  };
}

export { analyzeSearchAnalytics, generateAIInsights };
