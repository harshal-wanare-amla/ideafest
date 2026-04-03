/**
 * RULE-BASED AI SEARCH INTELLIGENCE ENGINE
 * Recommendation Engine - AI Insights Generation
 * 
 * Generates actionable recommendations from triggered rules
 * Uses template-based recommendations (no external AI needed for MVP)
 */

import { ACTION_TEMPLATES } from './rules-config.js';

/**
 * Recommendation Engine: Converts triggered rules into actionable insights
 */
export class RecommendationEngine {
  constructor(config = {}) {
    this.config = {
      enableDetailedAnalysis: config.enableDetailedAnalysis ?? true,
      maxRecommendations: config.maxRecommendations || 50,
    };
    this.recommendations = [];
  }

  /**
   * Generate recommendations from triggered rules
   */
  generateRecommendations(triggeredRulesData) {
    console.log(`\n💡 RECOMMENDATION ENGINE: Processing ${triggeredRulesData.triggered_rules?.length || 0} triggered rules`);

    const triggers = triggeredRulesData.triggered_rules || [];
    this.recommendations = [];

    // Group triggers by query for consolidated recommendations
    const queryGroups = this.groupTriggersByQuery(triggers);

    // Generate recommendation for each query with triggered rules
    for (const [query, queryTriggers] of Object.entries(queryGroups)) {
      const recommendation = this.generateRecommendationForQuery(query, queryTriggers);
      if (recommendation) {
        this.recommendations.push(recommendation);
      }
    }

    // Sort by priority and impact
    this.recommendations.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (b.estimated_impact || 0) - (a.estimated_impact || 0);
    });

    console.log(`✅ Generated ${this.recommendations.length} recommendations`);

    return {
      recommendations: this.recommendations.slice(0, this.config.maxRecommendations),
      summary: this.generateRecommendationSummary(),
    };
  }

  /**
   * Group triggers by query for consolidated analysis
   */
  groupTriggersByQuery(triggers) {
    const groups = {};

    for (const trigger of triggers) {
      if (!groups[trigger.query]) {
        groups[trigger.query] = [];
      }
      groups[trigger.query].push(trigger);
    }

    return groups;
  }

  /**
   * Generate single recommendation for a query with multiple triggers
   */
  generateRecommendationForQuery(query, triggers) {
    // Find highest priority trigger
    const triggersByPriority = {
      CRITICAL: triggers.filter(t => t.priority === 'CRITICAL'),
      HIGH: triggers.filter(t => t.priority === 'HIGH'),
      MEDIUM: triggers.filter(t => t.priority === 'MEDIUM'),
      LOW: triggers.filter(t => t.priority === 'LOW'),
    };

    let topTrigger = null;
    for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (triggersByPriority[priority].length > 0) {
        topTrigger = triggersByPriority[priority][0];
        break;
      }
    }

    if (!topTrigger) return null;

    // Get problem description based on rule
    const problemDescription = this.getProblemDescription(topTrigger);
    const opportunity = this.getOpportunity(topTrigger, query);
    const actionTemplate = ACTION_TEMPLATES[topTrigger.action_type];

    // Calculate estimated impact
    const impactScore = this.calculateImpactScore(topTrigger, triggers);

    return {
      query,
      triggered_rules: triggers.map(t => ({
        rule_id: t.rule_id,
        rule_name: t.rule_name,
        metric: t.metric,
        metric_value: t.metric_value,
        threshold: t.threshold,
      })),
      primary_rule_id: topTrigger.rule_id,
      primary_rule_name: topTrigger.rule_name,
      problem: problemDescription,
      opportunity,
      recommendation: actionTemplate?.description || 'Investigate and optimize search results',
      action_type: topTrigger.action_type,
      priority: topTrigger.priority,
      severity_score: topTrigger.severity_score,
      estimated_impact: impactScore,
      estimated_effort: actionTemplate?.effort || 'MEDIUM',
      estimated_hours: actionTemplate?.estimated_hours || 3,
      impact_category: actionTemplate?.category || 'Search Quality',
      query_stats: topTrigger.query_stats,
      implementation_notes: this.generateImplementationNotes(topTrigger, query),
    };
  }

  /**
   * Get problem description based on triggered rule
   */
  getProblemDescription(trigger) {
    const problems = {
      'zero_result_high_volume': `Users searching for "${trigger.query}" - 0 results returned. ${trigger.query_stats?.total_searches} searches with no products available.`,
      'zero_result_critical': `🚨 CRITICAL: "${trigger.query}" has ${trigger.query_stats?.total_searches} searches but 0 results. Massive content gap.`,
      'low_ctr_critical': `Users searching for "${trigger.query}" are not clicking results. Only ${trigger.query_stats?.ctr} CTR despite ${trigger.query_stats?.total_searches} searches. Results not relevant.`,
      'low_ctr_warning': `"${trigger.query}" shows ${trigger.query_stats?.ctr} CTR - below expected performance.`,
      'high_refinement_critical': `Users searching ${trigger.query_stats?.total_searches} times for "${trigger.query}" but ${trigger.query_stats?.refinement_rate} refine their search. Results confusing or misaligned with intent.`,
      'high_refinement_warning': `"${trigger.query}" has high refinement rate (${trigger.query_stats?.refinement_rate}) - users struggling to find what they want.`,
      'poor_ranking_critical': `Top results for "${trigger.query}" are not matching user clicks. Users clicking at position ${trigger.query_stats?.avg_click_position} - top results irrelevant.`,
      'poor_ranking_warning': `"${trigger.query}" showing at position ${trigger.query_stats?.avg_click_position} average - could be ranked higher.`,
      'niche_product_low_engagement': `"${trigger.query}" is a niche query with ${trigger.query_stats?.total_searches} searches but only ${trigger.query_stats?.ctr} engagement.`,
      'low_results_available': `"${trigger.query}" returns very few results (${trigger.query_stats?.results_available || 'unknown'} avg) - limited inventory.`,
    };

    return problems[trigger.rule_id] || `Rule "${trigger.rule_name}" triggered for query "${trigger.query}". Investigate search results quality and user engagement.`;
  }

  /**
   * Get opportunity description
   */
  getOpportunity(trigger, query) {
    if (trigger.action_type === 'ADD_TO_INVENTORY') {
      const potentialClicks = Math.round((trigger.query_stats?.total_searches || 0) * 0.3);
      const potentialRevenue = potentialClicks * 150;
      return `Add products for "${query}" to inventory. Potential: ${potentialClicks} clicks, ~$${potentialRevenue} revenue recovered.`;
    }

    if (trigger.action_type === 'IMPROVE_RANKING') {
      const potentialClicks = Math.round((trigger.query_stats?.total_searches || 0) * 0.25);
      const potentialRevenue = potentialClicks * 150;
      return `Improve ranking for "${query}" from position ${trigger.query_stats?.avg_click_position} to top 3. Potential: +${potentialClicks} clicks, +$${potentialRevenue} revenue.`;
    }

    if (trigger.action_type === 'ADD_FILTERS_IMPROVE_RELEVANCE') {
      return `Add filters and improve result relevance. Expected to reduce refinement rate by 50% and increase CTR.`;
    }

    return `Optimize search results for "${query}". Expected improvement in user engagement and conversions.`;
  }

  /**
   * Calculate impact score (0-100)
   * Based on search volume, severity, and revenue potential
   */
  calculateImpactScore(trigger, allTriggers) {
    let impact = 50; // Base score

    // Factor 1: Search volume
    const volume = trigger.query_stats?.total_searches || 1;
    const volumeScore = Math.min((volume / 200) * 20, 20);
    impact += volumeScore;

    // Factor 2: Severity (multiple rules triggered)
    const severityBonus = Math.min(allTriggers.length * 5, 15);
    impact += severityBonus;

    // Factor 3: Revenue multiplier
    if (trigger.rule_id === 'zero_result_high_volume' || trigger.rule_id === 'zero_result_critical') {
      impact += 15; // Zero results are critical
    }

    return Math.min(impact, 100);
  }

  /**
   * Generate implementation notes/steps
   */
  generateImplementationNotes(trigger, query) {
    const notes = {
      'zero_result_high_volume': [
        '1. Research product inventory for this category',
        '2. Contact suppliers to source products',
        '3. Add products to searchable catalog',
        '4. Re-index Elasticsearch',
        '5. Monitor search analytics for improvement',
      ],
      'zero_result_critical': [
        '🔴 URGENT - Do this today:',
        '1. Check if products exist in database',
        '2. If not, emergency procurement needed',
        '3. Consider temporary redirect to similar products',
        '4. Set up alerts for zero-result queries',
      ],
      'low_ctr_critical': [
        '1. Review top 5 search results - are they relevant?',
        '2. Check if product titles match search intent',
        '3. Adjust ranking weight/boost for this category',
        '4. Add synonyms (e.g., "office chair" = "work chair")',
        '5. Re-rank and test',
      ],
      'high_refinement_critical': [
        '1. Add filters: Brand, Price, Size, Color, etc.',
        '2. Implement faceted search UI',
        '3. Improve product attribute tagging',
        '4. Add search suggestions/auto-complete',
      ],
      'poor_ranking_critical': [
        '1. Audit ranking algorithm for this category',
        '2. Check if popular products are ranked correctly',
        '3. Verify product boosting/signals',
        '4. A/B test new ranking formula',
      ],
    };

    return notes[trigger.rule_id] || [
      '1. Analyze user behavior for this query',
      '2. Identify specific issues',
      '3. Implement targeted fix',
      '4. Monitor improvement',
    ];
  }

  /**
   * Generate summary of all recommendations
   */
  generateRecommendationSummary() {
    const summary = {
      total_recommendations: this.recommendations.length,
      by_priority: {
        CRITICAL: this.recommendations.filter(r => r.priority === 'CRITICAL').length,
        HIGH: this.recommendations.filter(r => r.priority === 'HIGH').length,
        MEDIUM: this.recommendations.filter(r => r.priority === 'MEDIUM').length,
        LOW: this.recommendations.filter(r => r.priority === 'LOW').length,
      },
      by_action: {},
      total_effort_hours: 0,
      top_opportunities: [],
    };

    // Count by action type
    for (const rec of this.recommendations) {
      summary.by_action[rec.action_type] =
        (summary.by_action[rec.action_type] || 0) + 1;
      summary.total_effort_hours += rec.estimated_hours || 0;
    }

    // Top opportunities sorted by impact
    summary.top_opportunities = this.recommendations
      .slice(0, 5)
      .map(r => ({
        query: r.query,
        impact_score: r.estimated_impact,
        priority: r.priority,
        action: r.action_type,
      }));

    return summary;
  }

  /**
   * Get recommendation by priority level
   */
  getRecommendationsByPriority(priority) {
    return this.recommendations.filter(r => r.priority === priority);
  }

  /**
   * Get recommendation by action type
   */
  getRecommendationsByActionType(actionType) {
    return this.recommendations.filter(r => r.action_type === actionType);
  }

  /**
   * Get top N recommendations by impact
   */
  getTopRecommendations(limit = 10) {
    return this.recommendations.slice(0, limit);
  }

  /**
   * Get dashboard-ready grouped recommendations
   */
  getDashboardGrouped() {
    return {
      critical_actions: this.getRecommendationsByPriority('CRITICAL'),
      high_priority: this.getRecommendationsByPriority('HIGH'),
      medium_priority: this.getRecommendationsByPriority('MEDIUM'),
      nice_to_have: this.getRecommendationsByPriority('LOW'),
    };
  }
}

/**
 * Utility: Create and run recommendation engine
 */
export function createRecommendationEngine(config = {}) {
  return new RecommendationEngine(config);
}

/**
 * Utility: Generate single recommendation from rule data
 */
export function generateSingleRecommendation(trigger) {
  const engine = new RecommendationEngine();
  return engine.generateRecommendationForQuery(trigger.query, [trigger]);
}
