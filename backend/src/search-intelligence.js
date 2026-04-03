/**
 * Search Intelligence Engine
 * 
 * Generates 6 business-focused reports from search analytics data:
 * 1. Search Success Rate Report
 * 2. Lost Opportunity Report
 * 3. Ranking Effectiveness Report
 * 4. AI Quick Wins (Auto-Fix Engine)
 * 5. Trending Searches Report
 * 6. Frustration Signals Report
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Main intelligence engine - processes analytics and generates all 6 reports
 */
async function generateSearchIntelligence(analyticsData, genAI) {
  try {
    console.log('\n🧠 === SEARCH INTELLIGENCE ENGINE ===');
    console.log(`Processing ${analyticsData.length} queries...`);

    if (analyticsData.length === 0) {
      return generateEmptyIntelligenceReport();
    }

    // Process raw analytics into calculated metrics
    const processedQueries = processAnalyticsData(analyticsData);

    // Generate all 6 reports
    const reports = {
      successRateReport: generateSuccessRateReport(processedQueries),
      lostOpportunityReport: generateLostOpportunityReport(processedQueries),
      rankingEffectivenessReport: generateRankingEffectivenessReport(processedQueries),
      quickWinsReport: generateQuickWinsReport(processedQueries),
      trendingSearchesReport: generateTrendingSearchesReport(processedQueries),
      frustrationSignalsReport: generateFrustrationSignalsReport(processedQueries),
    };

    // Generate AI-powered insights and recommendations
    const aiInsights = await generateAIInsights(processedQueries, genAI);

    // Compile executive summary
    const executiveSummary = generateExecutiveSummary(reports, processedQueries);

    // Build final intelligence report
    const finalReport = {
      timestamp: new Date().toISOString(),
      dataPoints: analyticsData.length,
      
      // 1. Executive Summary (Non-Technical)
      executiveSummary,

      // 2. Metrics Snapshot
      metricsSnapshot: generateMetricsSnapshot(reports, processedQueries),

      // 3. Key Problems
      keyProblems: extractKeyProblems(reports, processedQueries),

      // 4. Recommendations
      recommendations: aiInsights.recommendations,

      // 5. Top 3 Priority Actions
      priorityActions: aiInsights.priorityActions.slice(0, 3),

      // 6. Dashboard Sections
      dashboardSections: {
        searchHealth: reports.successRateReport.dashboardSection,
        missedOpportunities: reports.lostOpportunityReport.dashboardSection,
        quickWins: reports.quickWinsReport.dashboardSection,
        trendingNow: reports.trendingSearchesReport.dashboardSection,
        userPainPoints: reports.frustrationSignalsReport.dashboardSection,
        rankingIssues: reports.rankingEffectivenessReport.dashboardSection,
      },

      // 7. CTA for Home Page
      homePageCTA: generateHomePageCTA(reports, processedQueries),

      // Raw reports for detailed drill-down
      detailedReports: reports,

      // AI-powered insights
      aiInsights: aiInsights.insights,
    };

    console.log('✅ Intelligence report generated successfully');
    return finalReport;
  } catch (error) {
    console.error('Search intelligence generation failed:', error.message);
    return generateEmptyIntelligenceReport();
  }
}

/**
 * Calculate data confidence level based on sample size
 * Returns confidence level (LOW, MEDIUM, HIGH) and minimum sample size flag
 */
function getDataConfidenceLevel(sampleSize) {
  if (sampleSize < 5) {
    return { level: 'LOW', displayWarning: true, minRequired: 5 };
  } else if (sampleSize < 30) {
    return { level: 'MEDIUM', displayWarning: false, minRequired: 30 };
  } else if (sampleSize < 100) {
    return { level: 'MEDIUM', displayWarning: false, minRequired: 100 };
  } else {
    return { level: 'HIGH', displayWarning: false, minRequired: 100 };
  }
}

/**
 * Process raw analytics into calculated metrics with confidence levels
 * CRITICAL FIX: Cap CTR at 100% and add confidence indicators
 */
function processAnalyticsData(analyticsData) {
  return analyticsData.map(query => {
    // Ensure safe integer values
    const totalSearches = Math.max(parseInt(query.total_searches) || 0, 0);
    const clicks = Math.max(parseInt(query.clicks) || 0, 0);
    
    // CRITICAL FIX: Cap CTR at maximum 100%
    const rawCTR = (Math.min(clicks, totalSearches) / Math.max(totalSearches, 1)) * 100;
    const ctr = Math.min(rawCTR, 100);
    
    const successRate = clicks > 0 ? 100 : 0;
    const failureRate = clicks === 0 ? 100 : 0;
    
    // Get confidence level for this query's data
    const confidence = getDataConfidenceLevel(totalSearches);

    return {
      query: query.query,
      total_searches: totalSearches,
      results_count_avg: Math.max(parseFloat(query.results_count_avg) || 0, 0),
      clicks: clicks,
      avg_click_position: Math.max(parseFloat(query.avg_click_position) || 0, 0),
      zero_result_count: Math.max(parseInt(query.zero_result_count) || 0, 0),
      refinement_rate: Math.min(Math.max(parseFloat(query.refinement_rate) || 0, 0), 1), // 0-1 range
      ctr,
      successRate,
      failureRate,
      confidence, // CRITICAL: Add confidence metadata
      engagementScore: calculateEngagementScore(query),
      urgencyScore: calculateUrgencyScore(query),
    };
  });
}

/**
 * Calculate engagement score (0-100)
 */
function calculateEngagementScore(query) {
  const ctrComponent = (query.clicks / Math.max(query.total_searches, 1)) * 40; // Max 40
  const resultCountComponent = Math.min(query.results_count_avg / 50 * 30, 30); // Max 30
  const refinementComponent = Math.min((1 - query.refinement_rate) * 30, 30); // Lower refine = higher score

  return Math.round(ctrComponent + resultCountComponent + refinementComponent);
}

/**
 * Calculate urgency score (0-100) - how much attention this needs
 */
function calculateUrgencyScore(query) {
  let score = 0;

  // High volume + low engagement = urgent
  if (query.total_searches >= 10 && query.clicks === 0) score += 40;
  else if (query.total_searches >= 10 && query.clicks / query.total_searches < 0.1) score += 30;

  // Zero results
  if (query.zero_result_count > 0) score += 30;

  // High refinement rate (user confusion)
  if (query.refinement_rate > 0.5) score += 20;

  // Low position clicks
  if (query.avg_click_position > 7) score += 15;

  return Math.min(score, 100);
}

// ============================================
// REPORT 1: SEARCH SUCCESS RATE
// ============================================

function generateSuccessRateReport(processedQueries) {
  const totalSearches = processedQueries.reduce((sum, q) => sum + q.total_searches, 0);
  const totalClicks = processedQueries.reduce((sum, q) => sum + q.clicks, 0);
  const overallSuccessRate = (totalClicks / Math.max(totalSearches, 1)) * 100;
  const overallFailureRate = 100 - overallSuccessRate;

  // Identify problem queries (high volume + low success)
  const problemQueries = processedQueries
    .filter(q => q.total_searches >= 5 && q.ctr < 20)
    .sort((a, b) => b.total_searches - a.total_searches)
    .slice(0, 5);

  // Performant queries
  const performantQueries = processedQueries
    .filter(q => q.ctr >= 40)
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 5);

  const insight = generateSuccessInsight(overallSuccessRate, problemQueries, performantQueries);

  return {
    overallSuccessRate: Math.round(overallSuccessRate),
    overallFailureRate: Math.round(overallFailureRate),
    totalSearches,
    totalClicks,
    problemQueries,
    performantQueries,
    insight,
    dashboardSection: {
      title: '🔍 Search Health',
      metrics: {
        successRate: `${Math.round(overallSuccessRate)}%`,
        failureRate: `${Math.round(overallFailureRate)}%`,
        totalSearches: totalSearches.toLocaleString(),
        avgCTR: `${Math.round(totalClicks / Math.max(totalSearches, 1) * 100)}%`,
      },
      problemAreas: problemQueries.map(q => ({
        query: q.query,
        searches: q.total_searches,
        ctr: `${Math.round(q.ctr)}%`,
        status: '🔴 Low CTR',
      })),
      strengths: performantQueries.map(q => ({
        query: q.query,
        searches: q.total_searches,
        ctr: `${Math.round(q.ctr)}%`,
        status: '🟢 Strong',
      })),
    },
  };
}

function generateSuccessInsight(rate, problems, performant) {
  if (rate < 20) {
    return `⚠️ CRITICAL: Search is severely underperforming with only ${Math.round(rate)}% success rate. ${problems.length} queries need immediate attention.`;
  } else if (rate < 50) {
    return `📊 MODERATE: ${Math.round(rate)}% success rate indicates optimization opportunities. Focus on ${problems.length} high-volume, low-engagement queries.`;
  } else if (rate < 70) {
    return `✅ GOOD: ${Math.round(rate)}% success rate is solid. Fine-tuning ${problems.length} underperforming queries can push this higher.`;
  } else {
    return `🎯 EXCELLENT: ${Math.round(rate)}% success rate shows strong search performance. Maintain current strategy and apply best practices to remaining queries.`;
  }
}

// ============================================
// REPORT 2: LOST OPPORTUNITY
// ============================================

function generateLostOpportunityReport(processedQueries) {
  const lostQueries = processedQueries
    .filter(q => 
      q.total_searches >= 5 && (
        q.zero_result_count > 0 || 
        q.ctr < 15 ||
        (q.total_searches >= 10 && q.clicks === 0)
      )
    )
    .map(q => {
      const potentialClicks = Math.round(q.total_searches * 0.3); // If we improved to 30% CTR
      const lostClicks = potentialClicks - q.clicks;
      const lostOpportunityCost = lostClicks * 150; // ~$150 per click

      return {
        query: q.query,
        searches: q.total_searches,
        currentClicks: q.clicks,
        currentCTR: Math.round(q.ctr),
        zeroResults: q.zero_result_count,
        potentialClicks,
        lostClicks: Math.max(0, lostClicks),
        estimatedOpportunityCost: Math.max(0, lostOpportunityCost),
        problemType: q.zero_result_count > 0 ? 'Zero Results' : q.ctr < 5 ? 'Critical Relevance' : 'Low Engagement',
        userWantedButDidntGet: generateUserIntent(q),
      };
    })
    .sort((a, b) => b.estimatedOpportunityCost - a.estimatedOpportunityCost)
    .slice(0, 10);

  const totalLostOpportunity = lostQueries.reduce((sum, q) => sum + q.estimatedOpportunityCost, 0);

  return {
    lostQueries,
    totalLostOpportunityCost: Math.round(totalLostOpportunity),
    totalLostClicks: lostQueries.reduce((sum, q) => sum + q.lostClicks, 0),
    insight: `💸 Estimated $${Math.round(totalLostOpportunity).toLocaleString()} in lost opportunity from ${lostQueries.length} high-impact queries.`,
    dashboardSection: {
      title: '💰 Missed Opportunities',
      topLosses: lostQueries.slice(0, 5).map(q => ({
        query: q.query,
        searches: q.searches,
        currentCTR: `${q.currentCTR}%`,
        lostClicks: q.lostClicks,
        opportunity: `$${q.estimatedOpportunityCost.toLocaleString()}`,
        issue: q.problemType,
      })),
      summary: `${lostQueries.length} queries losing $${Math.round(totalLostOpportunity).toLocaleString()} potential revenue`,
    },
  };
}

function generateUserIntent(query) {
  // Generate a human-readable description of what users were likely looking for
  const intentMap = {
    'backpack': 'Durable, stylish backpacks for daily use',
    'shoes': 'Comfortable, trendy shoes',
    'laptop': 'High-performance laptops for work/gaming',
    'watch': 'Elegant, functional watches',
    'headphones': 'High-quality audio devices',
    'dress': 'Fashionable, well-fitting dresses',
    'camera': 'Professional or hobby photography equipment',
  };

  for (const [keyword, intent] of Object.entries(intentMap)) {
    if (query.query.toLowerCase().includes(keyword)) {
      return intent;
    }
  }

  return `Users looking for: ${query.query}`;
}

// ============================================
// REPORT 3: RANKING EFFECTIVENESS
// ============================================

function generateRankingEffectivenessReport(processedQueries) {
  const rankingIssues = processedQueries
    .filter(q => q.clicks > 0 && (q.avg_click_position > 5 || (q.total_searches >= 10 && q.avg_click_position >= 3)))
    .map(q => ({
      query: q.query,
      searches: q.total_searches,
      clicks: q.clicks,
      avgClickPosition: Math.round(q.avg_click_position * 10) / 10,
      issue: q.avg_click_position > 7 ? '🔴 Critical: Users skip top results' : '🟡 Warning: Below-optimal ranking',
      recommendation: `Re-rank or boost results for "${q.query}" to improve position from ${Math.round(q.avg_click_position)} to top 3`,
    }))
    .sort((a, b) => b.avgClickPosition - a.avgClickPosition)
    .slice(0, 10);

  const perfectRankingQueries = processedQueries
    .filter(q => q.clicks > 0 && q.avg_click_position <= 2)
    .length;

  return {
    rankingIssues,
    perfectRankingQueries,
    totalQueriesWithClicks: processedQueries.filter(q => q.clicks > 0).length,
    rankingQualityScore: Math.round(
      (perfectRankingQueries / Math.max(processedQueries.filter(q => q.clicks > 0).length, 1)) * 100
    ),
    insight: `📊 ${rankingIssues.length} queries have ranking issues. Users click ${rankingIssues.length > 0 ? 'lower' : 'higher'} results than optimal.`,
    dashboardSection: {
      title: '📉 Ranking Issues',
      qualityScore: `${Math.round(perfectRankingQueries / Math.max(processedQueries.filter(q => q.clicks > 0).length, 1) * 100)}% top-ranked`,
      problemQueries: rankingIssues.slice(0, 5).map(q => ({
        query: q.query,
        avgPosition: q.avgClickPosition,
        clicks: q.clicks,
        severity: q.avgClickPosition > 7 ? 'Critical' : 'Warning',
      })),
    },
  };
}

// ============================================
// REPORT 4: QUICK WINS (AUTO-FIX ENGINE)
// ============================================

function generateQuickWinsReport(processedQueries) {
  const quickWins = [];

  // Find all issues and map to fixes
  processedQueries.forEach(q => {
    // Issue 1: Zero results
    if (q.zero_result_count > 0 && q.total_searches >= 3) {
      quickWins.push({
        query: q.query,
        problemType: 'Zero Results',
        severity: 'Critical',
        searches: q.total_searches,
        suggestedFix: 'Add Catalog Items',
        action: `Add products for "${q.query}" to inventory based on user demand signal (${q.total_searches} searches)`,
        impact: 'Convert 100% of searches to potential sales',
        effort: 'Medium (requires inventory sourcing)',
      });
    }

    // Issue 2: High searches + zero clicks
    if (q.total_searches >= 10 && q.clicks === 0) {
      quickWins.push({
        query: q.query,
        problemType: 'Relevance Crisis',
        severity: 'Critical',
        searches: q.total_searches,
        suggestedFix: 'Query Rewrite + Synonym',
        action: `Users searching "${q.query}" can't find matches. Add synonyms or rewrite intent. Example: "casual shoes" → also match "sneakers", "trainers"`,
        impact: `Recover ${Math.round(q.total_searches * 0.4)} potential clicks`,
        effort: 'Low (synonym addition)',
      });
    }

    // Issue 3: High volume + low CTR
    if (q.total_searches >= 15 && q.ctr > 0 && q.ctr < 10) {
      quickWins.push({
        query: q.query,
        problemType: 'Low Relevance',
        severity: 'High',
        searches: q.total_searches,
        suggestedFix: 'Boost Top Results',
        action: `Boost best-selling products for "${q.query}" to top positions. Currently ${Math.round(q.avg_click_position)} avg position.`,
        impact: `Increase CTR from ${Math.round(q.ctr)}% to ${Math.round(q.ctr * 2)}%`,
        effort: 'Low (ranking adjustment)',
      });
    }

    // Issue 4: High refinement rate
    if (q.refinement_rate > 0.4 && q.total_searches >= 5) {
      quickWins.push({
        query: q.query,
        problemType: 'Intent Mismatch',
        severity: 'Medium',
        searches: q.total_searches,
        suggestedFix: 'Category/Filter Suggestion',
        action: `Users refine "${q.query}" frequently (${Math.round(q.refinement_rate * 100)}% refinement rate). Add filter suggestions or category recommendations.`,
        impact: `Reduce refinement rate, improve user satisfaction`,
        effort: 'Low (UI enhancement)',
      });
    }
  });

  // Sort by impact (severity × searches)
  const prioritizedWins = quickWins
    .sort((a, b) => {
      const severityMap = { Critical: 3, High: 2, Medium: 1 };
      const scoreA = severityMap[a.severity] * a.searches;
      const scoreB = severityMap[b.severity] * b.searches;
      return scoreB - scoreA;
    })
    .slice(0, 15);

  return {
    quickWins: prioritizedWins,
    totalWins: quickWins.length,
    highImpactWins: quickWins.filter(w => w.severity === 'Critical').length,
    dashboardSection: {
      title: '⚡ Quick Wins',
      topActions: prioritizedWins.slice(0, 5).map(w => ({
        query: w.query,
        fix: w.suggestedFix,
        impact: w.impact,
        effort: w.effort,
      })),
      summary: `${prioritizedWins.filter(w => w.severity === 'Critical').length} critical fixes available`,
    },
  };
}

// ============================================
// REPORT 5: TRENDING SEARCHES
// ============================================

function generateTrendingSearchesReport(processedQueries) {
  // In real system, would compare with historical data
  // For now, identify trending by engagement and search volume
  const rising = processedQueries
    .filter(q => q.total_searches >= 5 && q.engagementScore >= 60)
    .sort((a, b) => b.total_searches - a.total_searches)
    .slice(0, 5);

  const hot = processedQueries
    .filter(q => q.total_searches >= 10 && q.ctr >= 30)
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 5);

  const declining = processedQueries
    .filter(q => q.total_searches >= 10 && q.ctr < 10)
    .sort((a, b) => a.ctr - b.ctr)
    .slice(0, 5);

  return {
    rising: rising.map(q => ({ query: q.query, searches: q.total_searches, ctr: Math.round(q.ctr), trend: '📈 Rising' })),
    hot: hot.map(q => ({ query: q.query, searches: q.total_searches, ctr: Math.round(q.ctr), trend: '🔥 Hot' })),
    declining: declining.map(q => ({ query: q.query, searches: q.total_searches, ctr: Math.round(q.ctr), trend: '📉 Declining' })),
    dashboardSection: {
      title: '📊 Trending Now',
      hotSearches: hot.map(q => `🔥 ${q.query} (${q.searches} searches, ${q.ctr}% CTR)`),
      risingSearches: rising.map(q => `📈 ${q.query} (${q.searches} searches)`),
      declineWatching: declining.slice(0, 3).map(q => `⚠️ ${q.query} (${Math.round(q.ctr)}% CTR)`),
    },
  };
}

// ============================================
// REPORT 6: FRUSTRATION SIGNALS
// ============================================

function generateFrustrationSignalsReport(processedQueries) {
  const frustratedQueries = processedQueries
    .filter(q => {
      const hasHighRefinement = q.refinement_rate > 0.3;
      const hasLowCTR = q.ctr < 15;
      const hasNoClicks = q.clicks === 0;
      const hasZeroResults = q.zero_result_count > 0;

      return (hasHighRefinement || hasLowCTR || hasNoClicks || hasZeroResults) && q.total_searches >= 3;
    })
    .map(q => ({
      query: q.query,
      searches: q.total_searches,
      refinementRate: Math.round(q.refinement_rate * 100),
      ctr: Math.round(q.ctr),
      zeroResults: q.zero_result_count,
      frustrationLevel: calculateFrustrationLevel(q),
      signals: identifyFrustrationSignals(q),
    }))
    .sort((a, b) => b.frustrationLevel - a.frustrationLevel)
    .slice(0, 10);

  return {
    frustratedQueries,
    totalFrustratedQueries: frustratedQueries.length,
    criticalFrustration: frustratedQueries.filter(q => q.frustrationLevel >= 8).length,
    dashboardSection: {
      title: '😤 User Pain Points',
      criticalIssues: frustratedQueries.filter(q => q.frustrationLevel >= 8).map(q => ({
        query: q.query,
        frustration: `${q.frustrationLevel}/10`,
        issues: q.signals.join(', '),
      })),
      attention: `${frustratedQueries.length} queries show user frustration patterns`,
    },
  };
}

function calculateFrustrationLevel(query) {
  let level = 0;

  // CRITICAL FIX: Reweight frustration scoring
  // Zero results = definite frustration (users can't find anything)
  if (query.zero_result_count > 0) level += 50;
  
  // No clicks despite results = frustration
  // (But only if we actually showed results)
  if (query.clicks === 0 && query.results_count_avg > 0) level += 40;
  
  // Poor ranking (users skip top results) = somewhat frustrating
  if (query.avg_click_position > 7) level += 20;
  
  // HIGH REFINEMENT ONLY IF NO CLICKS
  // Key fix: High refinement after successful click = user narrowing down (GOOD)
  // High refinement after no clicks = user frustrated (BAD)
  if (query.refinement_rate > 0.5 && query.clicks === 0) level += 30;
  
  // Low CTR without zero results = moderate frustration
  if (query.ctr > 0 && query.ctr < 10 && query.clicks > 0) level += 15;

  return Math.min(level, 100);
}

function identifyFrustrationSignals(query) {
  const signals = [];

  // CRITICAL FIX: Add context to refinement signal
  // High refinement is only bad if user didn't find results
  if (query.refinement_rate > 0.5 && query.clicks === 0) {
    signals.push('High refinement (no successful clicks)');
  } else if (query.refinement_rate > 0.5 && query.clicks > 0) {
    // This is actually GOOD - user found something and narrowed down
    // Don't flag as frustration signal
  }
  
  if (query.clicks === 0 && query.results_count_avg > 0) signals.push('No clicks with results shown');
  if (query.ctr < 10 && query.ctr > 0) signals.push('Low engagement');
  if (query.zero_result_count > 0) signals.push('Zero results');
  if (query.avg_click_position > 5) signals.push('Low ranking');

  return signals;
}

// ============================================
// AI-POWERED INSIGHTS
// ============================================

async function generateAIInsights(processedQueries, genAI) {
  try {
    const topIssues = processedQueries
      .slice(0, 20)
      .map(q => `Query: "${q.query}", Searches: ${q.total_searches}, CTR: ${Math.round(q.ctr)}%, Refinement Rate: ${Math.round(q.refinement_rate * 100)}%`)
      .join('\n');

    const prompt = `You are a search optimization expert. Analyze these search queries and provide actionable recommendations:

${topIssues}

Provide:
1. Top 3 pattern-based insights (what you notice across queries)
2. 5-7 specific, implementable recommendations
3. Estimated impact per recommendation

Format as JSON:
{
  "patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "affectedQueries": "number",
      "estimatedImpact": "string (e.g., +15% CTR)",
      "effort": "Low|Medium|High",
      "priority": "Critical|High|Medium"
    }
  ],
  "summary": "string - executive summary"
}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response
    let jsonText = responseText;
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    const aiResponse = JSON.parse(jsonText);

    return {
      insights: aiResponse.patterns,
      recommendations: aiResponse.recommendations.map(rec => ({
        ...rec,
        priority: rec.priority || 'Medium',
      })),
      priorityActions: aiResponse.recommendations
        .sort((a, b) => {
          const priorityMap = { Critical: 3, High: 2, Medium: 1 };
          return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
        })
        .slice(0, 5),
      summary: aiResponse.summary,
    };
  } catch (error) {
    console.error('AI insights generation failed:', error.message);
    return {
      insights: ['Unable to generate insights at this time'],
      recommendations: [],
      priorityActions: [],
      summary: 'AI analysis pending',
    };
  }
}

// ============================================
// SUMMARY GENERATION
// ============================================

function generateExecutiveSummary(reports, processedQueries) {
  const successRate = reports.successRateReport.overallSuccessRate;
  const lostOpportunity = reports.lostOpportunityReport.totalLostOpportunityCost;
  const rankingIssues = reports.rankingEffectivenessReport.rankingIssues.length;
  const quickWins = reports.quickWinsReport.quickWins.filter(w => w.severity === 'Critical').length;

  return [
    `🎯 Overall Search Performance: ${successRate}% success rate - ${successRate > 60 ? '✅ Good' : successRate > 40 ? '🟡 Moderate' : '🔴 Critical'}`,
    `💸 Missed Revenue: ~$${lostOpportunity.toLocaleString()} in lost clicks from high-volume, low-engagement queries`,
    `📊 Ranking Quality: ${rankingIssues} queries with suboptimal rankings (users clicking position ${reports.rankingEffectivenessReport.rankingIssues[0]?.avgClickPosition || '?'} instead of top 3)`,
    `⚡ Quick Wins Available: ${quickWins} critical issues solvable within 1-2 hours`,
    `📈 Opportunity: Implementing top 3 recommendations could improve CTR by ~20% and recover $${Math.round(lostOpportunity * 0.3).toLocaleString()} in potential revenue`,
  ];
}

function generateMetricsSnapshot(reports, processedQueries) {
  return {
    success_rate: `${reports.successRateReport.overallSuccessRate}%`,
    failure_rate: `${reports.successRateReport.overallFailureRate}%`,
    avg_ctr: `${Math.round(processedQueries.reduce((sum, q) => sum + q.ctr, 0) / processedQueries.length)}%`,
    total_searches: reports.successRateReport.totalSearches,
    total_clicks: reports.successRateReport.totalClicks,
    lost_opportunities: `$${reports.lostOpportunityReport.totalLostOpportunityCost.toLocaleString()}`,
    ranking_issues: reports.rankingEffectivenessReport.rankingIssues.length,
    quick_wins: reports.quickWinsReport.highImpactWins,
    frustrated_queries: reports.frustrationSignalsReport.totalFrustratedQueries,
  };
}

function extractKeyProblems(reports, processedQueries) {
  const problems = [];

  // Problem 1: Low success rate
  if (reports.successRateReport.overallSuccessRate < 50) {
    problems.push({
      problem: '🔴 Critical: Low Search Success Rate',
      description: `Only ${reports.successRateReport.overallSuccessRate}% of searches result in clicks. Users are not finding what they need.`,
      impact: 'High - affects revenue and user satisfaction',
      queries: reports.successRateReport.problemQueries.length,
    });
  }

  // Problem 2: Zero result queries
  const zeroResultQueries = processedQueries.filter(q => q.zero_result_count > 0);
  if (zeroResultQueries.length > 0) {
    problems.push({
      problem: '🔴 Content Gap: Zero Result Queries',
      description: `${zeroResultQueries.length} queries return no results. Users need products you don't have.`,
      impact: 'Medium - lost sales opportunity',
      queries: zeroResultQueries.length,
    });
  }

  // Problem 3: Ranking issues
  if (reports.rankingEffectivenessReport.rankingIssues.length > 0) {
    problems.push({
      problem: '🟡 Ranking: Users Click Below-Optimal Results',
      description: `${reports.rankingEffectivenessReport.rankingIssues.length} queries show users clicking position ${Math.round(reports.rankingEffectivenessReport.rankingIssues[0].avgClickPosition)}+ instead of top 3.`,
      impact: 'Medium - affects conversion rate',
      queries: reports.rankingEffectivenessReport.rankingIssues.length,
    });
  }

  // Problem 4: High refinement
  const highRefinementQueries = processedQueries.filter(q => q.refinement_rate > 0.4);
  if (highRefinementQueries.length > 0) {
    problems.push({
      problem: '🟡 UX: High Search Refinement Rate',
      description: `${highRefinementQueries.length} queries have >40% refinement rate. Users struggle with initial results.`,
      impact: 'Low-Medium - affects user experience',
      queries: highRefinementQueries.length,
    });
  }

  return problems;
}

function generateHomePageCTA(reports, processedQueries) {
  const hasUrgentIssues = reports.successRateReport.overallSuccessRate < 50 || 
                          reports.lostOpportunityReport.lostQueries.length > 5;

  if (hasUrgentIssues) {
    return {
      main: '🚨 Your Search is Leaving Money on the Table',
      sub: `$${reports.lostOpportunityReport.totalLostOpportunityCost.toLocaleString() || 'Thousands'} in lost clicks from underperforming queries`,
      cta: 'View Intelligence Report →',
      urgency: 'critical',
    };
  }

  const hasQuickWins = reports.quickWinsReport.highImpactWins > 0;
  if (hasQuickWins) {
    return {
      main: `⚡ ${reports.quickWinsReport.highImpactWins} Easy Wins Available`,
      sub: 'Quick fixes to boost search performance by 20%+',
      cta: 'See Quick Wins →',
      urgency: 'high',
    };
  }

  return {
    main: '📊 Unlock Search Insights',
    sub: 'Fix what your customers can\'t find',
    cta: 'View Analytics Report →',
    urgency: 'normal',
  };
}

// ============================================
// EMPTY REPORT TEMPLATE
// ============================================

function generateEmptyIntelligenceReport() {
  return {
    timestamp: new Date().toISOString(),
    dataPoints: 0,
    executiveSummary: [
      '📊 Waiting for search data...',
      'Start performing searches to generate intelligence',
      'Analytics will activate after first 5-10 queries',
    ],
    metricsSnapshot: {
      success_rate: 'N/A',
      failure_rate: 'N/A',
      avg_ctr: 'N/A',
      total_searches: 0,
    },
    keyProblems: [],
    recommendations: [],
    priorityActions: [],
    dashboardSections: {
      searchHealth: { title: '🔍 Search Health', status: 'Collecting data...' },
      missedOpportunities: { title: '💰 Missed Opportunities', status: 'Collecting data...' },
      quickWins: { title: '⚡ Quick Wins', status: 'Collecting data...' },
      trendingNow: { title: '📊 Trending Now', status: 'Collecting data...' },
      userPainPoints: { title: '😤 User Pain Points', status: 'Collecting data...' },
    },
    homePageCTA: {
      main: '📊 Search Analytics Ready',
      sub: 'Perform searches to generate insights',
      cta: 'Get Started →',
    },
  };
}

export {
  generateSearchIntelligence,
  processAnalyticsData,
  generateSuccessRateReport,
  generateLostOpportunityReport,
  generateRankingEffectivenessReport,
  generateQuickWinsReport,
  generateTrendingSearchesReport,
  generateFrustrationSignalsReport,
  generateAIInsights,
  generateExecutiveSummary,
  generateMetricsSnapshot,
  extractKeyProblems,
  generateHomePageCTA,
  generateEmptyIntelligenceReport,
  calculateFrustrationLevel,
  identifyFrustrationSignals,
  getDataConfidenceLevel,
};
