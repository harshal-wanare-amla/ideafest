/**
 * RULE CONFIGURATION API
 * Manages threshold rules configuration and persistence
 */

import { RULES_CONFIG } from './rules-config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_STORAGE_PATH = path.join(__dirname, 'rules-config-user.json');

/**
 * In-memory storage for current rules
 * Falls back to the imported RULES_CONFIG as defaults
 */
let currentRules = JSON.parse(JSON.stringify(RULES_CONFIG));

/**
 * Load rules from persistent storage if available
 */
export function loadRulesFromStorage() {
  try {
    if (fs.existsSync(CONFIG_STORAGE_PATH)) {
      const data = fs.readFileSync(CONFIG_STORAGE_PATH, 'utf-8');
      currentRules = JSON.parse(data);
      console.log('✅ Rules loaded from storage');
      return currentRules;
    }
  } catch (err) {
    console.error('⚠️ Error loading rules from storage:', err.message);
  }
  
  // Return default rules
  currentRules = JSON.parse(JSON.stringify(RULES_CONFIG));
  return currentRules;
}

/**
 * Save rules to persistent storage
 */
function saveRulesToStorage(rules) {
  try {
    fs.writeFileSync(CONFIG_STORAGE_PATH, JSON.stringify(rules, null, 2));
    console.log('✅ Rules saved to storage');
    return true;
  } catch (err) {
    console.error('❌ Error saving rules to storage:', err.message);
    return false;
  }
}

/**
 * Get current rules configuration
 */
export function getRulesConfig() {
  return JSON.parse(JSON.stringify(currentRules));
}

/**
 * Update rules configuration
 */
export function updateRulesConfig(rules) {
  if (!Array.isArray(rules)) {
    throw new Error('Rules must be an array');
  }

  // Validate each rule has required fields
  rules.forEach((rule, idx) => {
    if (!rule.rule_id || !rule.rule_name || rule.threshold === undefined) {
      throw new Error(`Rule ${idx} missing required fields`);
    }
  });

  currentRules = JSON.parse(JSON.stringify(rules));
  saveRulesToStorage(currentRules);
  return currentRules;
}

/**
 * Reset rules to defaults
 */
export function resetRulesConfig() {
  currentRules = JSON.parse(JSON.stringify(RULES_CONFIG));
  saveRulesToStorage(currentRules);
  return currentRules;
}

/**
 * Get statistics about current rules
 */
export function getRulesStats() {
  const stats = {
    total: currentRules.length,
    enabled: currentRules.filter(r => r.enabled).length,
    disabled: currentRules.filter(r => !r.enabled).length,
    by_priority: {
      HIGH: currentRules.filter(r => r.priority === 'HIGH').length,
      MEDIUM: currentRules.filter(r => r.priority === 'MEDIUM').length,
      LOW: currentRules.filter(r => r.priority === 'LOW').length,
    },
    by_metric: {},
  };

  // Count by metric
  currentRules.forEach(rule => {
    stats.by_metric[rule.metric] = (stats.by_metric[rule.metric] || 0) + 1;
  });

  return stats;
}

/**
 * Get a specific rule by ID
 */
export function getRuleById(ruleId) {
  return currentRules.find(r => r.rule_id === ruleId);
}

/**
 * Update a specific rule
 */
export function updateRule(ruleId, updates) {
  const ruleIndex = currentRules.findIndex(r => r.rule_id === ruleId);
  
  if (ruleIndex === -1) {
    throw new Error(`Rule ${ruleId} not found`);
  }

  // Merge updates with existing rule
  currentRules[ruleIndex] = { ...currentRules[ruleIndex], ...updates };
  
  saveRulesToStorage(currentRules);
  return currentRules[ruleIndex];
}

/**
 * Enable/disable a rule
 */
export function toggleRuleStatus(ruleId) {
  const rule = getRuleById(ruleId);
  
  if (!rule) {
    throw new Error(`Rule ${ruleId} not found`);
  }

  rule.enabled = !rule.enabled;
  saveRulesToStorage(currentRules);
  return rule;
}

/**
 * Get rules by priority
 */
export function getRulesByPriority(priority) {
  return currentRules.filter(r => r.priority === priority);
}

/**
 * Get rules by metric
 */
export function getRulesByMetric(metric) {
  return currentRules.filter(r => r.metric === metric);
}

/**
 * Get only enabled rules
 */
export function getEnabledRules() {
  return currentRules.filter(r => r.enabled);
}
