/**
 * RULE-BASED AI SEARCH INTELLIGENCE ENGINE
 * Rule Configuration File
 * 
 * Defines all configurable rules for search analytics evaluation
 * Each rule triggers when its condition is met against search data
 */

/**
 * Complete Rule Set for Search Analytics
 * 
 * Rule Structure:
 * {
 *   rule_id: string (unique identifier)
 *   rule_name: string (display name)
 *   metric: string (which metric to evaluate)
 *   operator: ">" | "<" | ">=" | "<=" | "==" (comparison operator)
 *   threshold: number (threshold value)
 *   action_type: string (type of action to recommend)
 *   priority: "HIGH" | "MEDIUM" | "LOW"
 *   min_searches: number (minimum search volume to trigger)
 *   description: string (what this rule detects)
 *   enabled: boolean (is this rule active)
 * }
 */
export const RULES_CONFIG = [
  // ==========================================
  // ZERO RESULT OPPORTUNITIES (Critical)
  // ==========================================
  {
    rule_id: 'zero_result_high_volume',
    rule_name: 'Zero Result Opportunity - High Volume',
    metric: 'zero_result_count',
    operator: '>=',
    threshold: 20,
    action_type: 'ADD_TO_INVENTORY',
    priority: 'HIGH',
    min_searches: 20,
    description: 'Users searching for products with 0 results - inventory gap',
    enabled: true,
    revenue_multiplier: 150, // $150 per potential click
  },

  {
    rule_id: 'zero_result_critical',
    rule_name: 'Zero Result Opportunity - Critical',
    metric: 'zero_result_count',
    operator: '>=',
    threshold: 50,
    action_type: 'ADD_TO_INVENTORY',
    priority: 'HIGH',
    min_searches: 50,
    description: 'Critical: Large volume returning zero results',
    enabled: true,
    revenue_multiplier: 150,
  },

  // ==========================================
  // LOW CTR ISSUES (Ranking/Relevance Problems)
  // ==========================================
  {
    rule_id: 'low_ctr_critical',
    rule_name: 'Critical Low CTR',
    metric: 'ctr',
    operator: '<',
    threshold: 0.05, // 5% CTR
    action_type: 'IMPROVE_RANKING',
    priority: 'HIGH',
    min_searches: 50,
    description: 'Results not relevant - users not clicking despite high volume',
    enabled: true,
    revenue_multiplier: 150,
  },

  {
    rule_id: 'low_ctr_warning',
    rule_name: 'Low CTR Warning',
    metric: 'ctr',
    operator: '<',
    threshold: 0.15, // 15% CTR
    action_type: 'IMPROVE_RANKING',
    priority: 'MEDIUM',
    min_searches: 30,
    description: 'Below-average engagement with search results',
    enabled: true,
    revenue_multiplier: 150,
  },

  // ==========================================
  // HIGH REFINEMENT RATE (User Confusion)
  // ==========================================
  {
    rule_id: 'high_refinement_critical',
    rule_name: 'Critical High Refinement Rate',
    metric: 'refinement_rate',
    operator: '>',
    threshold: 0.4, // 40% refinement rate
    action_type: 'ADD_FILTERS_IMPROVE_RELEVANCE',
    priority: 'HIGH',
    min_searches: 20,
    description: 'Users refining searches frequently - results not matching intent',
    enabled: true,
    revenue_multiplier: 100,
  },

  {
    rule_id: 'high_refinement_warning',
    rule_name: 'High Refinement Rate',
    metric: 'refinement_rate',
    operator: '>',
    threshold: 0.25, // 25% refinement rate
    action_type: 'ADD_FILTERS_IMPROVE_RELEVANCE',
    priority: 'MEDIUM',
    min_searches: 15,
    description: 'Moderate refinement rate - potential clarity issues',
    enabled: true,
    revenue_multiplier: 100,
  },

  // ==========================================
  // POOR RANKING (Click Position Analysis)
  // ==========================================
  {
    rule_id: 'poor_ranking_critical',
    rule_name: 'Critical Poor Ranking',
    metric: 'avg_click_position',
    operator: '>',
    threshold: 6, // Users clicking at position 6+
    action_type: 'FIX_RANKING_ALGORITHM',
    priority: 'HIGH',
    min_searches: 30,
    description: 'Users clicking deep in results - top results not relevant',
    enabled: true,
    revenue_multiplier: 120,
  },

  {
    rule_id: 'poor_ranking_warning',
    rule_name: 'Poor Ranking Warning',
    metric: 'avg_click_position',
    operator: '>',
    threshold: 4,
    action_type: 'FIX_RANKING_ALGORITHM',
    priority: 'MEDIUM',
    min_searches: 20,
    description: 'Average click position higher than expected',
    enabled: true,
    revenue_multiplier: 120,
  },

  // ==========================================
  // HIGH VOLUME QUERIES (Trending Detection)
  // ==========================================
  {
    rule_id: 'high_volume_strong_ctr',
    rule_name: 'High Volume Strong CTR - Winner',
    metric: 'total_searches',
    operator: '>=',
    threshold: 150,
    // Note: This rule also checks CTR > 40% in engine
    action_type: 'MAINTAIN_EXCELLENCE',
    priority: 'LOW',
    min_searches: 150,
    description: 'Top performer - high volume with strong engagement (trending)',
    enabled: true,
    revenue_multiplier: 150,
  },

  // ==========================================
  // NICHE PRODUCTS (Small Volume, Low Engagement)
  // ==========================================
  {
    rule_id: 'niche_product_low_engagement',
    rule_name: 'Niche Product - Low Engagement',
    metric: 'total_searches',
    operator: '<=',
    threshold: 50,
    // Note: Must have CTR < 20% in engine
    action_type: 'EXPAND_CATALOG_OR_FEATURE',
    priority: 'MEDIUM',
    min_searches: 10,
    description: 'Niche query with limited volume and low engagement',
    enabled: true,
    revenue_multiplier: 100,
  },

  // ==========================================
  // LOW RESULTS RETURNED (Insufficient Inventory)
  // ==========================================
  {
    rule_id: 'low_results_available',
    rule_name: 'Insufficient Search Results',
    metric: 'results_count_avg',
    operator: '<',
    threshold: 5, // Less than 5 results on average
    action_type: 'EXPAND_INVENTORY',
    priority: 'MEDIUM',
    min_searches: 20,
    description: 'Query returns very few results - need more inventory',
    enabled: true,
    revenue_multiplier: 150,
  },

  // ==========================================
  // SCROLL DEPTH ANALYSIS (Engagement Signal)
  // ==========================================
  {
    rule_id: 'low_scroll_depth',
    rule_name: 'Low Scroll Depth',
    metric: 'scroll_depth',
    operator: '<',
    threshold: 0.3, // Users not scrolling past 30%
    action_type: 'IMPROVE_TOP_RESULTS_QUALITY',
    priority: 'MEDIUM',
    min_searches: 25,
    description: 'Users not scrolling - top results may be poor quality',
    enabled: true,
    revenue_multiplier: 100,
  },

  // ==========================================
  // TIME SPENT ANALYSIS (Interest Signal)
  // ==========================================
  {
    rule_id: 'low_time_spent',
    rule_name: 'Low Time Spent',
    metric: 'avg_time_spent',
    operator: '<',
    threshold: 3, // Less than 3 seconds
    action_type: 'IMPROVE_RESULT_RELEVANCE',
    priority: 'LOW',
    min_searches: 20,
    description: 'Users leaving quickly - page may not be relevant',
    enabled: false, // Disabled - not all clients track this
  },
];

/**
 * Severity Matrix: Combination rules
 * Triggered when multiple conditions are met simultaneously
 * 
 * Indicates critical business impact
 */
export const COMBO_RULES = [
  {
    rule_id: 'combo_zero_results_high_volume',
    name: 'CRITICAL: Zero Results + High Volume',
    conditions: [
      { metric: 'zero_result_count', operator: '>=', threshold: 50 },
      { metric: 'total_searches', operator: '>=', threshold: 100 },
    ],
    action: 'EMERGENCY_ADD_INVENTORY',
    priority: 'CRITICAL',
    enabled: true,
  },

  {
    rule_id: 'combo_low_ctr_high_refinement',
    name: 'CRITICAL: Low CTR + High Refinement',
    conditions: [
      { metric: 'ctr', operator: '<', threshold: 0.1 },
      { metric: 'refinement_rate', operator: '>', threshold: 0.3 },
      { metric: 'total_searches', operator: '>=', threshold: 50 },
    ],
    action: 'COMPREHENSIVE_FIX',
    priority: 'HIGH',
    enabled: true,
  },

  {
    rule_id: 'combo_poor_ranking_volume',
    name: 'Poor Ranking with High Volume Loss',
    conditions: [
      { metric: 'avg_click_position', operator: '>', threshold: 5 },
      { metric: 'total_searches', operator: '>=', threshold: 80 },
      { metric: 'ctr', operator: '<', threshold: 0.2 },
    ],
    action: 'RANKING_ENGINE_REVIEW',
    priority: 'HIGH',
    enabled: true,
  },
];

/**
 * Rule Priority Levels (for dashboard sorting)
 */
export const PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

/**
 * Action Type Mappings
 * Each action type includes:
 * - description: what needs to be done
 * - effort: time required (LOW, MEDIUM, HIGH)
 * - implementation_category: group for dashboard
 */
export const ACTION_TEMPLATES = {
  ADD_TO_INVENTORY: {
    description: 'Add products to inventory for this category',
    effort: 'MEDIUM',
    category: 'Content/Inventory',
    estimated_hours: 4,
    impact: 'HIGH'
  },

  IMPROVE_RANKING: {
    description: 'Adjust ranking algorithm or boost relevance for this query',
    effort: 'LOW',
    category: 'Ranking/Algorithm',
    estimated_hours: 2,
    impact: 'HIGH'
  },

  ADD_FILTERS_IMPROVE_RELEVANCE: {
    description: 'Add filters to help users narrow results or improve relevance',
    effort: 'MEDIUM',
    category: 'UX/Filters',
    estimated_hours: 3,
    impact: 'MEDIUM'
  },

  FIX_RANKING_ALGORITHM: {
    description: 'Review and fix ranking algorithm - top results not matching intent',
    effort: 'HIGH',
    category: 'Ranking/Algorithm',
    estimated_hours: 6,
    impact: 'HIGH'
  },

  EXPAND_INVENTORY: {
    description: 'Expand inventory in this category',
    effort: 'MEDIUM',
    category: 'Content/Inventory',
    estimated_hours: 5,
    impact: 'MEDIUM'
  },

  MAINTAIN_EXCELLENCE: {
    description: 'Maintain current excellence - ensure inventory and ranking stay optimal',
    effort: 'LOW',
    category: 'Maintenance',
    estimated_hours: 1,
    impact: 'MEDIUM'
  },

  EXPAND_CATALOG_OR_FEATURE: {
    description: 'Expand catalog or feature this niche product prominently',
    effort: 'MEDIUM',
    category: 'Content/Inventory',
    estimated_hours: 3,
    impact: 'LOW'
  },

  IMPROVE_TOP_RESULTS_QUALITY: {
    description: 'Improve quality of top results - users not scrolling',
    effort: 'MEDIUM',
    category: 'Ranking/Algorithm',
    estimated_hours: 4,
    impact: 'MEDIUM'
  },

  IMPROVE_RESULT_RELEVANCE: {
    description: 'Improve overall result relevance for this query',
    effort: 'MEDIUM',
    category: 'Ranking/Algorithm',
    estimated_hours: 3,
    impact: 'MEDIUM'
  },

  COMPREHENSIVE_FIX: {
    description: 'Comprehensive fix: improve ranking + add inventory + optimize filters',
    effort: 'HIGH',
    category: 'Holistic',
    estimated_hours: 8,
    impact: 'HIGH'
  },

  EMERGENCY_ADD_INVENTORY: {
    description: '🚨 EMERGENCY: Add this product category immediately',
    effort: 'MEDIUM',
    category: 'Content/Inventory',
    estimated_hours: 4,
    impact: 'CRITICAL'
  },

  RANKING_ENGINE_REVIEW: {
    description: 'Schedule urgent review of ranking engine performance',
    effort: 'HIGH',
    category: 'Ranking/Algorithm',
    estimated_hours: 8,
    impact: 'HIGH'
  },
};

/**
 * Threshold Configuration Per Category
 * Can be customized per business need
 */
export const CATEGORY_THRESHOLDS = {
  HIGH_VOLUME: 150,        // queries above this are "trending"
  MEDIUM_VOLUME: 50,       // queries between 50-150
  LOW_VOLUME: 10,          // niche queries below 50
  CRITICAL_CTR: 0.05,      // 5% CTR threshold
  POOR_CTR: 0.15,          // 15% CTR threshold
  GOOD_CTR: 0.40,          // 40% CTR threshold
  EXCELLENT_CTR: 0.50,     // 50% CTR threshold
};

/**
 * Get all enabled rules
 */
export function getEnabledRules() {
  return RULES_CONFIG.filter(rule => rule.enabled);
}

/**
 * Get rule by ID
 */
export function getRuleById(ruleId) {
  return RULES_CONFIG.find(rule => rule.rule_id === ruleId);
}

/**
 * Get rules by priority
 */
export function getRulesByPriority(priority) {
  return RULES_CONFIG.filter(rule => rule.priority === priority && rule.enabled);
}

/**
 * Get rules by action type
 */
export function getRulesByActionType(actionType) {
  return RULES_CONFIG.filter(rule => rule.action_type === actionType && rule.enabled);
}
