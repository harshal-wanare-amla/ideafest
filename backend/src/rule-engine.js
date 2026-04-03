/**
 * RULE-BASED AI SEARCH INTELLIGENCE ENGINE
 * Rule Engine - Core Evaluation Logic
 * 
 * Processes analytics data and evaluates against configured rules
 * Returns list of triggered rules with supporting data
 */

import { RULES_CONFIG, COMBO_RULES, ACTION_TEMPLATES, PRIORITY_LEVELS } from './rules-config.js';

/**
 * Main Rule Engine: Evaluates all rules against query data
 * 
 * @param {Array} queriesData - Array of query objects with metrics
 * @returns {Object} - Triggered rules with statistics
 * 
 * Example input:
 * [
 *   {
 *     query: "laptop bags",
 *     total_searches: 124,
 *     clicks: 48,
 *     ctr: 0.387,
 *     results_count_avg: 89,
 *     zero_result_count: 0,
 *     refinement_rate: 0.065,
 *     avg_click_position: 2.3
 *   }
 * ]
 */
export class RuleEngine {
  constructor() {
    this.rules = RULES_CONFIG.filter(r => r.enabled);
    this.comboRules = COMBO_RULES.filter(r => r.enabled);
    this.triggeredRules = [];
    this.stats = {
      total_queries_evaluated: 0,
      total_rules_checked: 0,
      total_triggers: 0,
      by_priority: {},
      by_action_type: {},
    };
  }

  /**
   * Evaluate all rules against queries
   */
  evaluateRules(queriesData) {
    console.log(`\n🔍 RULE ENGINE: Evaluating ${queriesData.length} queries against ${this.rules.length} rules`);

    this.stats.total_queries_evaluated = queriesData.length;
    this.stats.total_rules_checked = this.rules.length * queriesData.length;
    this.triggeredRules = [];

    // Evaluate each query against each rule
    for (const query of queriesData) {
      const queryTriggers = this.evaluateQueryAgainstAllRules(query);
      this.triggeredRules.push(...queryTriggers);
    }

    // Evaluate combo rules (multiple conditions)
    const comboTriggers = this.evaluateComboRules(queriesData);
    this.triggeredRules.push(...comboTriggers);

    // Calculate statistics
    this.calculateStats();

    // Sort by priority and magnitude
    this.triggeredRules.sort((a, b) => {
      const priorityDiff = PRIORITY_LEVELS[a.priority] - PRIORITY_LEVELS[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.severity_score - a.severity_score;
    });

    console.log(`✅ Rule evaluation complete: ${this.triggeredRules.length} rules triggered`);

    return {
      triggered_rules: this.triggeredRules,
      stats: this.stats,
      summary: this.generateSummary(),
    };
  }

  /**
   * Evaluate single query against all rules
   */
  evaluateQueryAgainstAllRules(query) {
    const triggers = [];

    // Normalize CTR if needed
    if (!query.ctr && query.total_searches > 0) {
      query.ctr = query.clicks / query.total_searches;
    }

    for (const rule of this.rules) {
      // Check minimum search threshold
      if (query.total_searches < rule.min_searches) {
        continue;
      }

      // Get metric value from query
      const metricValue = this.getMetricValue(query, rule.metric);

      // Evaluate rule condition
      if (this.evaluateCondition(metricValue, rule.operator, rule.threshold)) {
        // Calculate severity score (0-100)
        const severityScore = this.calculateSeverityScore(query, rule, metricValue);

        triggers.push({
          query: query.query,
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          rule_priority: rule.priority,
          metric: rule.metric,
          metric_value: metricValue,
          threshold: rule.threshold,
          operator: rule.operator,
          action_type: rule.action_type,
          priority: rule.priority,
          severity_score: severityScore,
          // Supporting data
          query_stats: {
            total_searches: query.total_searches,
            clicks: query.clicks || 0,
            ctr: (query.ctr * 100).toFixed(1) + '%',
            avg_click_position: (query.avg_click_position || 0).toFixed(1),
            zero_results: query.zero_result_count || 0,
            refinement_rate: ((query.refinement_rate || 0) * 100).toFixed(1) + '%',
            results_available: query.results_count_avg || 0,
          },
        });
      }
    }

    return triggers;
  }

  /**
   * Evaluate combo rules (multiple conditions)
   */
  evaluateComboRules(queriesData) {
    const triggers = [];

    for (const comboRule of this.comboRules) {
      for (const query of queriesData) {
        // Check all conditions in combo rule
        let allConditionsMet = true;

        for (const condition of comboRule.conditions) {
          const metricValue = this.getMetricValue(query, condition.metric);
          if (!this.evaluateCondition(metricValue, condition.operator, condition.threshold)) {
            allConditionsMet = false;
            break;
          }
        }

        // If all conditions met, trigger combo rule
        if (allConditionsMet) {
          triggers.push({
            query: query.query,
            rule_id: comboRule.rule_id,
            rule_name: comboRule.name,
            rule_priority: comboRule.priority,
            is_combo_rule: true,
            conditions_met: comboRule.conditions.length,
            action_type: comboRule.action,
            priority: comboRule.priority,
            severity_score: 95, // Combo rules are more severe
            query_stats: {
              total_searches: query.total_searches,
              clicks: query.clicks || 0,
              ctr: (query.ctr * 100).toFixed(1) + '%',
              zero_results: query.zero_result_count || 0,
              refinement_rate: ((query.refinement_rate || 0) * 100).toFixed(1) + '%',
            },
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Get metric value from query object
   * Handles different naming conventions
   */
  getMetricValue(query, metric) {
    const metricMap = {
      'total_searches': query.total_searches || query.searches || 0,
      'clicks': query.clicks || 0,
      'ctr': query.ctr || (query.clicks / query.total_searches) || 0,
      'results_count_avg': query.results_count_avg || query.avg_results || 0,
      'zero_result_count': query.zero_result_count || query.zero_results || 0,
      'refinement_rate': query.refinement_rate || 0,
      'avg_click_position': query.avg_click_position || 0,
      'scroll_depth': query.scroll_depth || 0,
      'avg_time_spent': query.avg_time_spent || 0,
    };

    return metricMap[metric] || 0;
  }

  /**
   * Evaluate single condition: value operator threshold
   */
  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Calculate severity score (0-100)
   * Based on how much the metric exceeds/falls short of threshold
   * And the search volume involved
   */
  calculateSeverityScore(query, rule, metricValue) {
    let baseScore = 50;

    // Factor 1: How extreme is the metric violation
    const threshold = rule.threshold;
    let deviation = 0;

    if (rule.operator === '<') {
      // Lower is worse
      deviation = (threshold - metricValue) / threshold;
    } else if (rule.operator === '>') {
      // Higher is worse
      deviation = (metricValue - threshold) / threshold;
    } else if (rule.operator === '>=') {
      // Volume-based
      deviation = (metricValue - threshold) / Math.max(threshold, 1);
    }

    const deviationScore = Math.min(deviation * 30, 30); // 0-30 points

    // Factor 2: Search volume (higher volume = higher severity)
    const volumeScore = Math.min((query.total_searches / 200) * 20, 20); // 0-20 points

    // Factor 3: Revenue impact (if available)
    const revenueScore = rule.revenue_multiplier ? 10 : 0; // 0-10 points

    baseScore += deviationScore + volumeScore + revenueScore;

    return Math.min(baseScore, 100);
  }

  /**
   * Calculate statistics about triggered rules
   */
  calculateStats() {
    this.stats.total_triggers = this.triggeredRules.length;
    this.stats.by_priority = {
      CRITICAL: this.triggeredRules.filter(t => t.priority === 'CRITICAL').length,
      HIGH: this.triggeredRules.filter(t => t.priority === 'HIGH').length,
      MEDIUM: this.triggeredRules.filter(t => t.priority === 'MEDIUM').length,
      LOW: this.triggeredRules.filter(t => t.priority === 'LOW').length,
    };

    this.stats.by_action_type = {};
    for (const trigger of this.triggeredRules) {
      const action = trigger.action_type;
      this.stats.by_action_type[action] = (this.stats.by_action_type[action] || 0) + 1;
    }
  }

  /**
   * Generate summary of rule evaluation
   */
  generateSummary() {
    const highPriority = this.triggeredRules.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL');
    const totalSearchesAtRisk = highPriority.reduce(
      (sum, t) => sum + (t.query_stats?.total_searches || 0),
      0
    );

    return {
      total_triggers: this.triggeredRules.length,
      critical_issues: this.stats.by_priority.CRITICAL,
      high_priority_issues: this.stats.by_priority.HIGH,
      searches_at_risk: totalSearchesAtRisk,
      percentage_of_total_searches: this.stats.total_queries_evaluated > 0 
        ? ((totalSearchesAtRisk / this.stats.total_queries_evaluated) * 100).toFixed(1)
        : 0,
      top_action_types: Object.entries(this.stats.by_action_type)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count })),
    };
  }

  /**
   * Get triggered rules grouped by priority
   */
  getTriggeredRulesByPriority() {
    const grouped = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };

    for (const trigger of this.triggeredRules) {
      grouped[trigger.priority]?.push(trigger);
    }

    return grouped;
  }

  /**
   * Get triggered rules grouped by action type
   */
  getTriggeredRulesByActionType() {
    const grouped = {};

    for (const trigger of this.triggeredRules) {
      const action = trigger.action_type;
      if (!grouped[action]) {
        grouped[action] = [];
      }
      grouped[action].push(trigger);
    }

    return grouped;
  }

  /**
   * Get top N triggered rules by severity
   */
  getTopTriggeredRules(limit = 10) {
    return this.triggeredRules.slice(0, limit);
  }
}

/**
 * Utility: Batch evaluate multiple query datasets
 */
export function evaluateMultipleDatasets(datasetsArray) {
  const engine = new RuleEngine();
  const allResults = [];

  for (const dataset of datasetsArray) {
    const result = engine.evaluateRules(dataset.data);
    allResults.push({
      dataset_name: dataset.name,
      timestamp: dataset.timestamp,
      ...result,
    });
  }

  return allResults;
}

/**
 * Utility: Get rule performance metrics
 */
export function getRulePerformanceMetrics(engine) {
  return {
    rules_evaluated: engine.stats.total_rules_checked,
    rules_triggered: engine.stats.total_triggers,
    trigger_rate: engine.stats.total_rules_checked > 0 
      ? ((engine.stats.total_triggers / engine.stats.total_rules_checked) * 100).toFixed(2)
      : 0,
    average_severity: engine.triggeredRules.length > 0
      ? (engine.triggeredRules.reduce((sum, t) => sum + t.severity_score, 0) / engine.triggeredRules.length).toFixed(1)
      : 0,
  };
}
