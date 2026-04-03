import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { Client } from '@elastic/elasticsearch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { analyzeSearchAnalytics } from './analytics-insights.js';
import { generateSearchIntelligence } from './search-intelligence.js';
import { setupSearchInsightsAPI } from './search-insights-api.js';
import { killProcessOnPort, waitForPortAvailable } from './port-manager.js';
import { 
  loadRulesFromStorage, 
  getRulesConfig, 
  updateRulesConfig, 
  resetRulesConfig,
  getRulesStats,
  toggleRuleStatus,
  updateRule
} from './rules-api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const SEED_DATA_FOLDER = process.env.SEED_DATA_FOLDER || 'data';
const SEED_ID_FIELD = process.env.SEED_DATA_ID_FIELD || 'product_id';
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY || '').split(',').filter(key => key.trim());
const DEBUG = process.env.DEBUG === 'true';

// Get root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');
const SEED_FOLDER_PATH = path.join(ROOT_DIR, SEED_DATA_FOLDER);

// Initialize Elasticsearch client
const esClient = new Client({ node: ES_NODE });
const ES_INDEX = process.env.ELASTICSEARCH_INDEX || 'products';
const METADATA_INDEX = 'metadata_store';

// ============================================
// GEMINI API KEY ROTATION SYSTEM
// ============================================
let currentKeyIndex = 0;
let geminiClients = [];

if (GEMINI_API_KEYS.length > 0) {
  geminiClients = GEMINI_API_KEYS.map(key => new GoogleGenerativeAI(key.trim()));
  console.log(`✓ Gemini API initialized with ${geminiClients.length} key(s)`);
} else {
  console.warn('⚠ GEMINI_API_KEY not configured - AI search disabled');
}

/**
 * Get current Gemini client (with automatic rotation on quota errors)
 */
function getGeminiClient() {
  if (geminiClients.length === 0) return null;
  return geminiClients[currentKeyIndex];
}

/**
 * Rotate to next API key on quota error
 */
function rotateGeminiKey() {
  if (geminiClients.length <= 1) return false;
  const previousKey = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % geminiClients.length;
  console.log(`🔄 Rotated Gemini API key: ${previousKey} → ${currentKeyIndex}`);
  return true;
}

/**
 * Make Gemini API call with automatic fallback to next key on quota error
 */
async function callGeminiWithRotation(apiCall) {
  const maxRetries = geminiClients.length;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const genAI = getGeminiClient();
      if (!genAI) {
        throw new Error('No Gemini API keys configured');
      }
      return await apiCall(genAI);
    } catch (error) {
      lastError = error;
      const errorMessage = error.message || '';
      const isQuotaError = errorMessage.includes('quota') || 
                          errorMessage.includes('RESOURCE_EXHAUSTED') ||
                          errorMessage.includes('429');

      if (isQuotaError && attempt < maxRetries - 1) {
        console.warn(`⚠️ Key ${currentKeyIndex} quota exceeded, rotating...`);
        rotateGeminiKey();
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted');
}

// Initialize legacy genAI variable for backward compatibility
const genAI = geminiClients.length > 0 ? getGeminiClient() : null;

// ============================================
// STRUCTURED LOGGING (CRITICAL for observability)
// ============================================
const StructuredLogger = {
  log: (level, event, data = {}, duration = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data,
      ...(duration && { duration_ms: duration }),
      node_env: process.env.NODE_ENV || 'development',
    };
    console.log(JSON.stringify(logEntry));
  },
  error: (event, error, data = {}) => {
    StructuredLogger.log('ERROR', event, {
      error_message: error?.message || String(error),
      error_type: error?.constructor?.name,
      ...data,
    });
  },
  info: (event, data = {}) => StructuredLogger.log('INFO', event, data),
  warn: (event, data = {}) => StructuredLogger.log('WARN', event, data),
};

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// GEMINI RATE LIMITING (CRITICAL for reliability)
// ============================================
const GEMINI_RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 60,
  CURRENT_USAGE: { count: 0, resetTime: Date.now() + 60000 },
};

function checkGeminiRateLimit() {
  const now = Date.now();
  if (now > GEMINI_RATE_LIMITS.CURRENT_USAGE.resetTime) {
    GEMINI_RATE_LIMITS.CURRENT_USAGE = { count: 0, resetTime: now + 60000 };
  }
  
  if (GEMINI_RATE_LIMITS.CURRENT_USAGE.count >= GEMINI_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE) {
    const waitTime = GEMINI_RATE_LIMITS.CURRENT_USAGE.resetTime - now;
    throw new Error(`Gemini API rate limited. Retry after ${waitTime}ms`);
  }
  
  GEMINI_RATE_LIMITS.CURRENT_USAGE.count++;
}

/**
 * Call Gemini API with exponential backoff retry logic + key rotation
 * CRITICAL: Handles rate limiting (429 errors) gracefully
 * Falls back to next API key on quota exhaustion
 */
async function callGeminiWithRetry(prompt, maxRetries = 3) {
  checkGeminiRateLimit();
  
  const totalAttempts = maxRetries * (geminiClients.length || 1);
  let lastError = null;
  
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const clientIndex = Math.floor(attempt / maxRetries);
      
      // If we've exhausted current key, try next one
      if (clientIndex > 0 && clientIndex < geminiClients.length) {
        if (attempt % maxRetries === 0) {
          rotateGeminiKey();
          console.log(`🔄 Rotating to key ${currentKeyIndex} due to quota exhaustion`);
        }
      }
      
      const genAIClient = getGeminiClient();
      if (!genAIClient) {
        throw new Error('No Gemini API keys configured');
      }
      
      const model = genAIClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;
      
      const is429 = error?.message?.includes('429') || error?.status === 429;
      const isRateLimited = error?.message?.includes('rate') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if ((is429 || isRateLimited) && attempt < totalAttempts - 1) {
        // Exponential backoff: 2s, 4s, 8s
        const withinKeyAttempt = attempt % maxRetries;
        const waitTime = 2000 * Math.pow(2, withinKeyAttempt);
        
        StructuredLogger.warn('gemini_rate_limited', {
          attempt: attempt + 1,
          total_attempts: totalAttempts,
          key_index: currentKeyIndex,
          wait_ms: waitTime,
          error: error?.message,
        });
        
        // Check if we need to try next key
        if (withinKeyAttempt === maxRetries - 1 && currentKeyIndex < geminiClients.length - 1) {
          console.warn(`⚠️ Key ${currentKeyIndex} exhausted, will try next key...`);
        }
        
        await new Promise(r => setTimeout(r, waitTime));
        checkGeminiRateLimit();
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('All Gemini API keys exhausted');
}

// ============================================
// GEMINI CACHE (2-minute TTL)
// ============================================
const geminiCache = new Map(); // Simple in-memory cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes in milliseconds

/**
 * Generate cache key from search parameters
 */
function generateGeminiCacheKey(query, minPrice, maxPrice, color, category, spec) {
  // Create a consistent key from all search parameters
  return `gemini:${query}|${minPrice || ''}|${maxPrice || ''}|${color || ''}|${category || ''}|${JSON.stringify(spec || {})}`;
}

/**
 * Get cached Gemini response if available and not expired
 */
function getCachedGeminiResponse(cacheKey) {
  const cached = geminiCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    // Cache expired, remove it
    geminiCache.delete(cacheKey);
    return null;
  }
  
  console.log('✅ CACHE HIT: Using cached Gemini response');
  return cached.data;
}

/**
 * Store Gemini response in cache
 */
function cacheGeminiResponse(cacheKey, data) {
  geminiCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  console.log('💾 CACHE STORED: Gemini response cached for 2 minutes');
}

// ============================================
// SYNONYM MANAGEMENT (Elasticsearch Storage)
// ============================================

/**
 * Ensure metadata index exists
 */
async function ensureMetadataIndex() {
  try {
    const exists = await esClient.indices.exists({ index: METADATA_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: METADATA_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              type: { type: 'keyword' },
              data: { type: 'text' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
            },
          },
        },
      });
      console.log(`✓ Created metadata index: ${METADATA_INDEX}`);
    }
  } catch (error) {
    console.error('Error ensuring metadata index:', error.message);
  }
}

/**
 * Load applied synonyms from Elasticsearch
 */
async function loadAppliedSynonyms() {
  try {
    await ensureMetadataIndex();
    
    const response = await esClient.search({
      index: METADATA_INDEX,
      body: {
        query: {
          term: { type: 'applied_synonyms' },
        },
      },
    });

    if (response.hits.hits.length > 0) {
      const doc = response.hits.hits[0]._source;
      const synonyms = doc.synonyms || [];
      console.log(`📂 Loaded ${synonyms.length} previously applied synonym rules from ES`);
      return synonyms;
    }
  } catch (error) {
    console.warn('Could not load applied synonyms from ES:', error.message);
  }
  return [];
}

/**
 * Save applied synonyms to Elasticsearch
 */
async function saveAppliedSynonyms(synonyms) {
  try {
    await ensureMetadataIndex();
    
    const uniqueSynonyms = [...new Set(synonyms)]; // Remove duplicates

    await esClient.index({
      index: METADATA_INDEX,
      id: 'applied_synonyms',
      body: {
        type: 'applied_synonyms',
        synonyms: uniqueSynonyms,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log(`💾 Applied ${uniqueSynonyms.length} total synonym rules to ES (${METADATA_INDEX})`);
    return uniqueSynonyms;
  } catch (error) {
    console.error('Failed to save applied synonyms to ES:', error.message);
    return synonyms;
  }
}

/**
 * Merge new synonyms with existing ones (no duplicates)
 */
async function mergeSynonyms(newSynonyms) {
  const existingSynonyms = await loadAppliedSynonyms();
  const merged = [...new Set([...existingSynonyms, ...newSynonyms])];
  console.log(`🔀 Merged ${newSynonyms.length} new synonyms with ${existingSynonyms.length} existing synonyms`);
  console.log(`📊 Total synonyms now: ${merged.length}`);
  return merged;
}

// ============================================
// IMAGE HANDLER
// ============================================
const DEFAULT_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x300?text=Image+Not+Available';

/**
 * Get valid image URL or return placeholder
 */
function getValidImageUrl(imageUrl) {
  // If image is missing, empty, or looks invalid, return placeholder
  if (!imageUrl || imageUrl.trim().length === 0) {
    return DEFAULT_PLACEHOLDER_IMAGE;
  }
  return String(imageUrl).trim();
}

// ============================================
// COMMON HELPER: Build Elasticsearch Query
// ============================================
// Source of truth for ES query building - used by both /search and /ai-search
function buildElasticsearchQuery({
  searchQuery,
  pageNum,
  pageSize,
  sortBy,
  minPrice,
  maxPrice,
  color,
  category,
  specFilters,
}) {
  const from = (pageNum - 1) * pageSize;

  // Build filter array (traditional search approach)
  const filters = [];

  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.gte = parseFloat(minPrice);
    if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
    filters.push({ range: { price: priceFilter } });
  }

  if (color) {
    filters.push({ term: { color: color } });
  }

  if (category) {
    filters.push({ term: { category: category } });
  }

  // Add nested specification filters (using terms for multiple values)
  if (specFilters && Array.isArray(specFilters) && specFilters.length > 0) {
    specFilters.forEach(specFilter => {
      filters.push({
        nested: {
          path: 'specifications',
          query: {
            bool: {
              must: [
                { term: { 'specifications.name': specFilter.name } },
                { terms: { 'specifications.value': specFilter.values } },
              ],
            },
          },
        },
      });
    });
  }

  // Build Elasticsearch query
  const esQuery = {
    index: ES_INDEX,
    body: {
      size: pageSize,
      from,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: searchQuery,
                fields: ['name^3', 'description^1.5'],
                type: 'best_fields',
                operator: 'or',
                minimum_should_match: '75%'
              },
            },
          ],
          filter: filters,
        },
      },
      aggs: {
        colors: {
          terms: {
            field: 'color',
            size: 100,
          },
        },
        categories: {
          terms: {
            field: 'category',
            size: 100,
          },
        },
        specifications: {
          nested: {
            path: 'specifications',
          },
          aggs: {
            spec_names: {
              terms: {
                field: 'specifications.name',
                size: 7,
              },
              aggs: {
                spec_values: {
                  terms: {
                    field: 'specifications.value',
                    size: 10,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  // Add sort if provided
  if (sortBy && sortBy.length > 0) {
    esQuery.body.sort = sortBy;
  }

  return { esQuery, filters };
}

// ============================================
// SEARCH TRACKING & ANALYTICS
// ============================================

/**
 * Validate analytics data before processing
 * @throws Error if data is invalid
 */
function validateAnalyticsData(data) {
  if (!data) {
    throw new Error('Analytics data is required');
  }
  
  // Validate total_searches
  const searches = parseInt(data.total_searches) || 0;
  if (searches < 0 || !Number.isFinite(searches)) {
    throw new Error(`total_searches must be non-negative integer, got: ${data.total_searches}`);
  }
  
  // Validate clicks
  const clicks = parseInt(data.clicks) || 0;
  if (clicks < 0 || !Number.isFinite(clicks)) {
    throw new Error(`clicks must be non-negative integer, got: ${data.clicks}`);
  }
  
  // Clicks cannot exceed searches (critical validation)
  if (clicks > searches) {
    throw new Error(`clicks (${clicks}) cannot exceed total_searches (${searches})`);
  }
  
  // Validate zero_result_count
  const zeroResults = parseInt(data.zero_result_count) || 0;
  if (zeroResults < 0 || !Number.isFinite(zeroResults)) {
    throw new Error(`zero_result_count must be non-negative integer, got: ${data.zero_result_count}`);
  }
  
  // Validate refinement_count
  const refinements = parseInt(data.refinement_count) || 0;
  if (refinements < 0 || !Number.isFinite(refinements)) {
    throw new Error(`refinement_count must be non-negative integer, got: ${data.refinement_count}`);
  }
  
  // Validate results_count_avg
  const resultsAvg = parseFloat(data.results_count_avg) || 0;
  if (resultsAvg < 0 || !Number.isFinite(resultsAvg)) {
    throw new Error(`results_count_avg must be non-negative number, got: ${data.results_count_avg}`);
  }
  
  console.log('✅ Analytics data validation passed');
  return true;
}

/**
 * Upsert analytics record for a query
 * Creates or updates aggregated analytics data in Elasticsearch
 */
async function upsertAnalytics(analyticsData) {
  try {
    // CRITICAL: Validate all input data
    validateAnalyticsData(analyticsData);
    
    const analyticsIndex = `${ES_INDEX}-analytics`;
    
    // Create unique ID based on query
    const docId = `${analyticsData.query.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    
    // Get existing record
    let existingRecord;
    try {
      const existing = await esClient.get({
        index: analyticsIndex,
        id: docId,
      });
      existingRecord = existing._source;
    } catch (error) {
      existingRecord = null;
    }

    // Update or create record
    const updatedRecord = {
      query: analyticsData.query,
      total_searches: (existingRecord?.total_searches || 0) + (analyticsData.total_searches || 0),
      clicks: (existingRecord?.clicks || 0) + (analyticsData.clicks || 0),
      zero_result_count: (existingRecord?.zero_result_count || 0) + (analyticsData.zero_result_count || 0),
      avg_click_position: analyticsData.avg_click_position || existingRecord?.avg_click_position || 0,
      refinement_count: (existingRecord?.refinement_count || 0) + (analyticsData.refinement_count || 0),
      results_count_avg: analyticsData.results_count_avg || existingRecord?.results_count_avg || 0,
      timestamps: [
        ...(existingRecord?.timestamps || []),
        new Date().toISOString(),
      ].slice(-100), // Keep last 100 timestamps
    };

    // Calculate derived metrics
    updatedRecord.refinement_rate = updatedRecord.refinement_count / Math.max(updatedRecord.total_searches, 1);
    updatedRecord.ctr = (updatedRecord.clicks / Math.max(updatedRecord.total_searches, 1)) * 100;

    // Upsert into Elasticsearch
    await esClient.index({
      index: analyticsIndex,
      id: docId,
      body: updatedRecord,
    });

    console.log(`✓ Analytics updated for query: "${analyticsData.query}"`);
    return updatedRecord;
  } catch (error) {
    console.error('⚠️ Failed to upsert analytics:', error.message);
    // Don't throw - tracking should not break search
  }
}

/**
 * Track a search query
 */
async function trackSearch(query, resultsCount, isZeroResult, engine = 'traditional') {
  try {
    // CRITICAL: Validate inputs
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.error('❌ Track search validation failed: query must be non-empty string');
      return; // Silently fail - tracking shouldn't break search
    }
    
    const parsedResultsCount = parseInt(resultsCount) || 0;
    if (parsedResultsCount < 0) {
      console.error(`❌ Track search validation failed: resultsCount must be non-negative (got: ${resultsCount})`);
      return;
    }
    
    if (typeof isZeroResult !== 'boolean') {
      console.error(`❌ Track search validation failed: isZeroResult must be boolean (got: ${typeof isZeroResult})`);
      return;
    }
    
    await upsertAnalytics({
      query: query.toLowerCase().trim(),
      total_searches: 1,
      clicks: 0,
      zero_result_count: isZeroResult ? 1 : 0,
      results_count_avg: parsedResultsCount,
      refinement_count: 0,
    });
  } catch (error) {
    console.error('Error tracking search:', error.message);
  }
}

/**
 * Track a product click
 */
async function trackClick(query, productId, clickPosition) {
  try {
    // CRITICAL: Validate inputs
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.error('❌ Track click validation failed: query must be non-empty string');
      return;
    }
    
    if (!productId || typeof productId !== 'string') {
      console.error('❌ Track click validation failed: productId must be non-empty string');
      return;
    }
    
    const parsedPosition = parseInt(clickPosition) || 0;
    if (parsedPosition < 0) {
      console.error(`❌ Track click validation failed: clickPosition must be non-negative (got: ${clickPosition})`);
      return;
    }
    
    const analyticsIndex = `${ES_INDEX}-analytics`;
    const docId = `${query.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    // Get existing record to update click count and position
    let existingRecord;
    try {
      const existing = await esClient.get({
        index: analyticsIndex,
        id: docId,
      });
      existingRecord = existing._source;
    } catch (error) {
      existingRecord = null;
    }

    if (existingRecord) {
      // Ensure integer values
      const existingClicks = parseInt(existingRecord.clicks) || 0;
      const existingPosition = parseFloat(existingRecord.avg_click_position) || 0;
      const existingSearches = parseInt(existingRecord.total_searches) || 1;
      
      // Check that clicks won't exceed searches
      if (existingClicks + 1 > existingSearches) {
        console.error(`❌ Data integrity check failed: clicks (${existingClicks + 1}) would exceed searches (${existingSearches})`);
        return;
      }
      
      // Calculate new average position
      const newAvgPosition = (existingPosition * existingClicks + parsedPosition) / (existingClicks + 1);

      const updatedRecord = {
        ...existingRecord,
        clicks: existingClicks + 1,
        avg_click_position: newAvgPosition,
        // CRITICAL FIX: Cap CTR at maximum 100%
        ctr: Math.min(((existingClicks + 1) / Math.max(existingSearches, 1)) * 100, 100),
      };

      await esClient.index({
        index: analyticsIndex,
        id: docId,
        body: updatedRecord,
      });

      console.log(`✓ Click tracked: "${query}" - Position ${clickPosition}`);
    }
  } catch (error) {
    console.error('Error tracking click:', error.message);
  }
}

/**
 * Track search refinement (when user searches again or changes filters)
 */
async function trackRefinement(originalQuery, newQuery, filterChanges = null) {
  try {
    // CRITICAL: Validate inputs
    if (!originalQuery || typeof originalQuery !== 'string' || originalQuery.trim().length === 0) {
      console.error('❌ Track refinement validation failed: originalQuery must be non-empty string');
      return;
    }
    
    if (!newQuery || typeof newQuery !== 'string' || newQuery.trim().length === 0) {
      console.error('❌ Track refinement validation failed: newQuery must be non-empty string');
      return;
    }
    
    const analyticsIndex = `${ES_INDEX}-analytics`;
    const docId = `${originalQuery.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    // Get existing record
    let existingRecord;
    try {
      const existing = await esClient.get({
        index: analyticsIndex,
        id: docId,
      });
      existingRecord = existing._source;
    } catch (error) {
      existingRecord = null;
    }

    if (existingRecord) {
      const updatedRecord = {
        ...existingRecord,
        refinement_count: (parseInt(existingRecord.refinement_count) || 0) + 1,
        refinement_details: [
          ...(existingRecord.refinement_details || []),
          {
            timestamp: new Date().toISOString(),
            new_query: newQuery,
            filter_changes: filterChanges,
          },
        ].slice(-50), // Keep last 50 refinements
      };

      updatedRecord.refinement_rate = updatedRecord.refinement_count / Math.max(updatedRecord.total_searches, 1);

      await esClient.index({
        index: analyticsIndex,
        id: docId,
        body: updatedRecord,
      });

      console.log(`✓ Refinement tracked: "${originalQuery}" → "${newQuery}"`);
    }
  } catch (error) {
    console.error('Error tracking refinement:', error.message);
  }
}

// ============================================
// ZERO RESULT RECOVERY
// ============================================

/**
 * Zero Result Recovery - Attempts to find results when initial search returns 0 hits
 * Strategy: Remove filters progressively, expand price range, rewrite query, fallback
 */
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Seed data endpoint - POST only, loads all CSVs from folder into Elasticsearch
// Uses product_id as unique identifier - prevents duplicates on multiple seed runs
app.post('/seed', async (req, res) => {
  try {
    console.log('\n🌱 === SEED ENDPOINT CALLED ===');
    console.log('Index:', ES_INDEX);
    console.log('Folder:', SEED_FOLDER_PATH);
    console.log('ID Field:', SEED_ID_FIELD);
    
    // Check if folder exists
    if (!fs.existsSync(SEED_FOLDER_PATH)) {
      return res.status(400).json({
        error: 'Seed folder not found',
        path: SEED_FOLDER_PATH,
        message: `Please create folder and place CSV files at: ${SEED_FOLDER_PATH}`,
      });
    }

    console.log(`🌱 Seeding data from folder: ${SEED_FOLDER_PATH}`);
    console.log(`📌 Using '${SEED_ID_FIELD}' as unique document ID`);

    // Get all CSV files from folder
    const files = fs.readdirSync(SEED_FOLDER_PATH)
      .filter(f => f.toLowerCase().endsWith('.csv'));

    if (files.length === 0) {
      return res.status(400).json({
        error: 'No CSV files found',
        path: SEED_FOLDER_PATH,
        message: `No .csv files found in: ${SEED_FOLDER_PATH}`,
      });
    }

    console.log(`📂 Found ${files.length} CSV file(s): ${files.join(', ')}`);

    // Step 1: Create index (or use existing)
    const indexExists = await esClient.indices.exists({ index: ES_INDEX });
    
    if (!indexExists) {
      // Create index with custom analyzer for improved search relevance
      await esClient.indices.create({
        index: ES_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                product_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop', 'porter_stem'],
                },
                custom_search_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'stop',
                    'porter_stem',
                    'synonym_graph_filter',
                  ],
                },
              },
              filter: {
                synonym_graph_filter: {
                  type: 'synonym_graph',
                  synonyms: [],
                  lenient: true,
                },
              },
            },
          },
          mappings: {
            properties: {
              [SEED_ID_FIELD]: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'product_analyzer',
                search_analyzer: 'custom_search_analyzer',
                fields: {
                  keyword: { type: 'keyword' }, // for exact matching if needed
                },
              },
              description: {
                type: 'text',
                analyzer: 'product_analyzer',
                search_analyzer: 'custom_search_analyzer',
              },
              price: {
                type: 'float',
              },
              image: {
                type: 'keyword',
              },
              color: {
                type: 'keyword',
              },
              category: {
                type: 'keyword',
              },
              rating: {
                type: 'float',
              },
              ratings_count: {
                type: 'integer',
              },
              specifications: {
                type: 'nested',
                properties: {
                  name: {
                    type: 'keyword',
                  },
                  value: {
                    type: 'keyword',
                  },
                },
              },
            },
            dynamic: false,
          },
        },
      });
      console.log(`✓ Created new index with custom analyzer: ${ES_INDEX}`);
    } else {
      console.log(`✓ Using existing index: ${ES_INDEX}`);
    }

    // Step 2: Read all CSV files and collect documents
    const allDocuments = [];
    let totalRows = 0;
    let skippedCount = 0;

    for (const file of files) {
      const filePath = path.join(SEED_FOLDER_PATH, file);
      console.log(`\n📄 Processing: ${file}`);

      const { documents: docs, rowCount: fileRowCount } = await new Promise((resolve, reject) => {
        const fileDocuments = [];
        let fileRowCount = 0;

        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            fileRowCount++;
            
            // Get unique ID from the configured field
            const documentId = row[SEED_ID_FIELD];

            if (!documentId) {
              console.warn(`⚠ Row ${fileRowCount} missing '${SEED_ID_FIELD}' - skipping`);
              skippedCount++;
              return;
            }

            // Include all fields from CSV initially (for processing/mapping)
            const doc = {};
            for (const [key, value] of Object.entries(row)) {
              // Auto-detect and convert types
              if (value === '' || value === null) {
                continue; // Skip empty fields
              } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
                // Try to parse as number
                doc[key] = parseFloat(value);
              } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                // Parse booleans
                doc[key] = value.toLowerCase() === 'true';
              } else {
                // Keep as string (trimmed)
                doc[key] = value.toString().trim();
              }
            }

            // Field mapping - normalize common field names
            // Map title → name if name doesn't exist
            if (!doc.name && doc.title) {
              doc.name = doc.title;
            }
            // Map product_description → description if description doesn't exist
            if (!doc.description && doc.product_description) {
              doc.description = doc.product_description;
            }

            // Price handling: prefer initial_price, fallback to final_price, then price
            let price = null;
            if (doc.initial_price && !isNaN(parseFloat(doc.initial_price))) {
              price = parseFloat(doc.initial_price);
            } else if (doc.final_price && !isNaN(parseFloat(doc.final_price))) {
              // Remove currency symbols and commas from final_price (e.g., "₹3,995.00" → 3995)
              const priceStr = String(doc.final_price)
                .replace(/[^\d.,]/g, '') // Remove non-numeric except . and ,
                .replace(/,/g, ''); // Remove commas
              price = parseFloat(priceStr);
            } else if (doc.price && !isNaN(parseFloat(doc.price))) {
              price = parseFloat(doc.price);
            }

            if (!price || isNaN(price)) {
              price = Math.floor(Math.random() * 4500) + 500; // Random between 500-5000
            }
            doc.price = price;

            // Image handling: take first image from comma-separated list
            if (doc.images && typeof doc.images === 'string') {
              const imageArray = doc.images.split(',');
              doc.image = imageArray[0].trim(); // Take first, trim whitespace
              // Keep images array for reference if needed
              doc.images_all = imageArray;
            } else if (doc.image) {
              // Already a single image
              // Keep as is
            }

            // Extract color from title or description if available
            if (!doc.color) {
              // Include multi-word colors and sort by length (longer first) to prefer specific matches
              const colorKeywords = ['navy blue', 'light blue', 'dark blue', 'sky blue', 'royal blue', 'cream', 'off white', 'dark gray', 'light gray', 'dark grey', 'light grey', 'navy', 'blue', 'red', 'black', 'white', 'green', 'gray', 'grey', 'silver', 'gold', 'yellow', 'purple', 'pink', 'brown', 'orange', 'beige', 'maroon', 'teal', 'turquoise', 'cyan', 'magenta'].sort((a, b) => b.length - a.length);
              let foundColor = null;

              // Helper function to safely escape regex special characters
              const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // Check title first using word boundary regex to avoid matching partial words
              if (doc.title) {
                const titleLower = doc.title.toLowerCase();
                foundColor = colorKeywords.find(color => {
                  // Create regex with word boundaries to match complete words only
                  // Escape special characters in case they exist in color name
                  const escapedColor = escapeRegex(color);
                  const regex = new RegExp(`\\b${escapedColor}\\b`);
                  return regex.test(titleLower);
                });
              }

              // Check description if not found in title
              if (!foundColor && doc.description) {
                const descriptionLower = doc.description.toLowerCase();
                foundColor = colorKeywords.find(color => {
                  // Create regex with word boundaries to match complete words only
                  // Escape special characters in case they exist in color name
                  const escapedColor = escapeRegex(color);
                  const regex = new RegExp(`\\b${escapedColor}\\b`);
                  return regex.test(descriptionLower);
                });
              }

              if (foundColor) {
                // Capitalize properly: "navy blue" -> "Navy Blue", "navy" -> "Navy"
                doc.color = foundColor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              } else {
                doc.color = null; // Set to null if no color found
              }
            }

            // Ensure category exists
            if (!doc.category) {
              doc.category = 'Uncategorized';
            }

            // Handle rating field - ensure numeric
            if (doc.rating && !isNaN(parseFloat(doc.rating))) {
              doc.rating = parseFloat(doc.rating);
            } else {
              doc.rating = 0;
            }

            // Handle ratings_count field - ensure numeric
            if (doc.ratings_count && !isNaN(parseInt(doc.ratings_count))) {
              doc.ratings_count = parseInt(doc.ratings_count);
            } else {
              doc.ratings_count = 0;
            }

            // Parse and transform product_specifications into nested array
            doc.specifications = [];
            if (doc.product_specifications) {
              try {
                // Try to parse if it's a JSON string
                let specsData = doc.product_specifications;
                if (typeof specsData === 'string') {
                  specsData = JSON.parse(specsData);
                }

                // Handle different formats: array or object
                if (Array.isArray(specsData)) {
                  // Handle format: {specification_name, specification_value} or {name, value}
                  doc.specifications = specsData
                    .filter(s => {
                      const name = s.specification_name || s.name;
                      const value = s.specification_value || s.value;
                      return name && value && String(value).toLowerCase() !== 'na'; // Filter out 'NA' values
                    })
                    .map(s => ({
                      name: String(s.specification_name || s.name).toLowerCase().trim(),
                      value: String(s.specification_value || s.value).toLowerCase().trim(),
                    }));
                } else if (typeof specsData === 'object' && specsData !== null) {
                  // Object with key-value pairs
                  doc.specifications = Object.entries(specsData)
                    .filter(([key, value]) => String(value).toLowerCase() !== 'na')
                    .map(([key, value]) => ({
                      name: String(key).toLowerCase().trim(),
                      value: String(value).toLowerCase().trim(),
                    }));
                }
              } catch (e) {
                // If parsing fails, treat as empty specifications
                console.warn(`⚠ Failed to parse specifications for product ${documentId}:`, e.message);
                doc.specifications = [];
              }
            }

            // Remove fields not needed in index (after mapping is complete)
            const fieldsToRemove = [
              'title',                      // Mapped to 'name'
              'product_description',         // Mapped to 'description'
              'images',                      // Mapped to 'image'
              'images_all',                  // Processed array not needed
              'sizes',                       // Not in response format
              'product_details',
              'amount_of_stars',
              'delivery_options',
              'videos',
              'variations',
              'breadcrumbs',
              'product_specifications',      // Transformed to 'specifications'
              'initial_price',              // Source for mapping, only 'price' stored
              'final_price',                // Not needed in index
              'currency',                   // Not needed in index
            ];
            fieldsToRemove.forEach(field => delete doc[field]);

            fileDocuments.push({
              id: documentId,
              doc: doc,
            });
          })
          .on('end', () => {
            console.log(`  ✓ Read ${fileRowCount} rows, keeping ${fileDocuments.length}`);
            resolve({ documents: fileDocuments, rowCount: fileRowCount });
          })
          .on('error', reject);
      });

      allDocuments.push(...docs);
      totalRows += fileRowCount;
    }

    if (allDocuments.length === 0) {
      return res.status(400).json({
        error: 'No valid documents found',
        message: `Ensure CSV has '${SEED_ID_FIELD}' column and other data columns`,
      });
    }

    // Step 3: Bulk insert/update using product_id as unique ID
    // Using 'index' operation: updates if ID exists, inserts if new
    const bulkOps = [];
    allDocuments.forEach(({ id, doc }) => {
      bulkOps.push({ index: { _index: ES_INDEX, _id: String(id) } });
      bulkOps.push(doc);
    });

    console.log(`\n💾 Bulk indexing ${allDocuments.length} documents...`);
    const bulkResponse = await esClient.bulk({
      body: bulkOps,
    });

    // Count successful operations
    const successful = bulkResponse.items.filter(item => !item.index?.error).length;
    const failed = bulkResponse.items.filter(item => item.index?.error).length;

    console.log(`✓ Bulk operation complete`);
    console.log(`  - Successful: ${successful}`);
    if (failed > 0) {
      console.log(`  - Failed: ${failed}`);
      // Log first error for debugging
      const firstError = bulkResponse.items.find(item => item.index?.error);
      if (firstError) {
        console.log(`  - Sample error:`, JSON.stringify(firstError.index.error, null, 2));
      }
    }

    res.json({
      success: true,
      message: 'Data seeded successfully',
      index: ES_INDEX,
      idField: SEED_ID_FIELD,
      filesProcessed: files.length,
      totalRows: totalRows,
      documentsIndexed: allDocuments.length,
      skipped: skippedCount,
      successful: successful,
      failed: failed,
      note: 'Documents with duplicate product_id will be updated instead of duplicated',
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      error: 'Seed process failed',
      message: error.message,
    });
  }
});

// AI-powered natural language search endpoint
app.post('/ai-search', async (req, res) => {
  try {
    // Accept both query and manual filter parameters
    const { 
      query: naturalLanguageQuery, 
      page = 1,
      sort,
      minPrice,
      maxPrice,
      color,
      category,
      spec,
      enableRecovery
    } = req.body;

    // Explicitly convert enableRecovery to boolean (handle string "true"/"false" and null)
    const enableRecoveryFlag = enableRecovery === true || enableRecovery === 'true';
    console.log('📥 Request enableRecovery:', enableRecovery, '→ Converted to:', enableRecoveryFlag);

    if (!naturalLanguageQuery || naturalLanguageQuery.trim().length === 0) {
      return res.status(400).json({
        error: 'Natural language query is required',
        results: [],
        total: 0,
      });
    }

    // Check if Gemini is configured
    if (geminiClients.length === 0) {
      return res.status(503).json({
        error: 'AI search not available',
        message: 'GEMINI_API_KEY not configured',
        results: [],
        total: 0,
      });
    }

    console.log('\n🤖 === AI SEARCH ENDPOINT CALLED ===');
    console.log('Natural language query:', naturalLanguageQuery);
    console.log('Recovery flag:', enableRecoveryFlag, `(type: ${typeof enableRecoveryFlag})`);
    if (minPrice || maxPrice || color || category || spec) {
      console.log('Manual filters applied:');
      if (minPrice) console.log('  - Min Price:', minPrice);
      if (maxPrice) console.log('  - Max Price:', maxPrice);
      if (color) console.log('  - Color:', color);
      if (category) console.log('  - Category:', category);
      if (spec) console.log('  - Spec:', spec);
    }

    // Generate cache key and check for cached Gemini response
    const cacheKey = generateGeminiCacheKey(naturalLanguageQuery, minPrice, maxPrice, color, category, spec);
    const cachedResponse = getCachedGeminiResponse(cacheKey);
    
    let parsedResponse;
    
    // If we have cached response, use it
    let geminiFromCache = false;
    if (cachedResponse) {
      parsedResponse = cachedResponse;
      geminiFromCache = true;
    } else {
      // Call Gemini API to extract structured search parameters WITH PARSING RULES
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are an ecommerce search query parser expert.

Convert the user query into structured JSON following STRICT PARSING RULES.

USER QUERY: "${naturalLanguageQuery}"

-----------------------------------
STRICT PARSING RULES (FOLLOW EXACTLY)
-----------------------------------

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "query": string,
  "filters": {
    "color": string|null,
    "category": string|null,
    "min_price": number|null,
    "max_price": number|null,
    "specifications": [
      { "name": string, "value": string }
    ]
  },
  "sort": {
    "field": string|null,
    "order": "asc"|"desc"|null
  }
}

-----------------------------------
RULE 1 - QUERY (MAIN INTENT):
Extract the main product term. Keep it simple and generic.
Examples:
- "blue leather backpack" → "backpack"
- "cheap running shoes" → "shoes"
- If no product mentioned or unclear → return null

-----------------------------------
RULE 2 - CATEGORY DETECTION (TOP 20):
IMPORTANT: Only extract category if EXPLICITLY mentioned in query.
Do NOT auto-detect category from product name alone.
Return null unless user says words like "category", "from", "in", "section", etc.

Valid explicit mentions:
- "shoes in the footwear category" → "shoes" 
- "bags from backpacks section" → "backpacks"
- "show me shoes category" → "shoes"
- "electronics category" → "electronics"

Invalid implicit detection (return null):
- "shoes" → null (not explicit)
- "blue shoes" → null (not explicit)
- "top rated shoes" → null (not explicit)

Categories (20 most common):
backpacks, handbags, shoes, clothing, watches, headphones, jeans, accessories, sweatshirts, sarees, kurtas, wallets, belts, sunglasses, caps, scarves, tops, shorts, clutches, electronics

-----------------------------------
RULE 3 - PRICE HANDLING:
- "under 2000", "below 2000", "less than 2000" → max_price = 2000
- "above 2000", "more than 2000" → min_price = 2000
- "between 2000 to 3000", "2000-3000" → min_price = 2000, max_price = 3000
- "cheap", "budget" → max_price = 2000
- "affordable" → max_price = 2500
- "expensive" → min_price = 5000
- "premium", "luxury" → min_price = 8000

-----------------------------------
RULE 4 - COLOR:
Extract color if present. Capitalize first letter.
Examples:
- "blue bag" → "Blue"
- "navy blue backpack" → "Navy Blue"
- "dark blue" → "Dark Blue"

Available colors: blue, red, black, white, green, yellow, pink, brown, gray, navy, silver, gold, purple, orange, beige

-----------------------------------
RULE 5 - BRAND (TOP 5):
Extract brand if mentioned. Add to specifications as: { "name": "Brand", "value": "BrandName" }

Top 5 brands:
- sony, sony headphones, sony camera
- apple, iphone, ipad, airpods, macbook
- lg, lg tv, lg phone, lg appliance
- samsung, samsung phone, samsung tv, samsung galaxy
- hp, hp laptop, hp computer

Brand mapping:
- "sony" → { "name": "Brand", "value": "Sony" }
- "apple", "iphone", "ipad" → { "name": "Brand", "value": "Apple" }
- "lg" → { "name": "Brand", "value": "LG" }
- "samsung", "galaxy" → { "name": "Brand", "value": "Samsung" }
- "hp", "hewlett" → { "name": "Brand", "value": "HP" }

-----------------------------------
RULE 6 - SPECIFICATIONS:
Map attributes to structured format:
- "leather" → { "name": "Material", "value": "Leather" }
- "cotton" → { "name": "Material", "value": "Cotton" }
- "casual" → { "name": "Occasion", "value": "Casual" }
- "formal" → { "name": "Occasion", "value": "Formal" }
- "waterproof" → { "name": "Water Resistance", "value": "Yes" }
- "slim fit" → { "name": "Fit", "value": "Slim Fit" }
- "striped" → { "name": "Pattern", "value": "Striped" }

Extract ALL matching specifications (including brand if detected).
NOTE: Brand is automatically added as a specification, don't duplicate it.

-----------------------------------
RULE 7 - SORTING:
- "lowest price", "cheap first" → { "field": "price", "order": "asc" }
- "highest price", "expensive first" → { "field": "price", "order": "desc" }
- "top rated", "best rated", "highest rated" → { "field": "rating", "order": "desc" }
- "most reviewed", "top reviewed" → { "field": "ratings_count", "order": "desc" }

-----------------------------------
RULE 8 - DEFAULTS:
- If value not found → return null
- specifications → empty array if none
- sort → { "field": null, "order": null } if no sort intent

-----------------------------------
EXAMPLES:

Input: "top rated blue leather backpacks under 3000"
Output:
{
  "query": "backpacks",
  "filters": {
    "color": "Blue",
    "category": null,
    "min_price": null,
    "max_price": 3000,
    "specifications": [
      { "name": "Material", "value": "Leather" }
    ]
  },
  "sort": {
    "field": "rating",
    "order": "desc"
  }
}

Input: "sony headphones under 5000"
Output:
{
  "query": "headphones",
  "filters": {
    "color": null,
    "category": null,
    "min_price": null,
    "max_price": 5000,
    "specifications": [
      { "name": "Brand", "value": "Sony" }
    ]
  },
  "sort": {
    "field": null,
    "order": null
  }
}

Input: "cheap red handbags lowest price"
Output:
{
  "query": "handbags",
  "filters": {
    "color": "Red",
    "category": null,
    "min_price": null,
    "max_price": 2000,
    "specifications": []
  },
  "sort": {
    "field": "price",
    "order": "asc"
  }
}

Input: "shoes in the shoes category"
Output:
{
  "query": "shoes",
  "filters": {
    "color": null,
    "category": "shoes",
    "min_price": null,
    "max_price": null,
    "specifications": []
  },
  "sort": {
    "field": null,
    "order": null
  }
}

-----------------------------------
IMPORTANT INSTRUCTIONS:
- Return ONLY valid JSON
- NO explanation text
- NO markdown code blocks
- NO extra commentary
- Follow all rules EXACTLY
- Capitalize colors and specifications values
- Use lowercase for category names

Now parse the user query following these rules EXACTLY.`;

      if (DEBUG) {
        console.log('\n📤 GEMINI REQUEST:');
        console.log('Model: gemini-2.5-flash');
        console.log('Prompt:\n', prompt);
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      if (DEBUG) {
        console.log('\n📥 GEMINI RESPONSE:');
        console.log('Full Response:\n', responseText);
      } else {
        console.log('Gemini response:', responseText.substring(0, 200) + '...');
      }

      // Parse the response (remove potential markdown code blocks)
      try {
        // Remove markdown code blocks if present
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
        }
        parsedResponse = JSON.parse(jsonText);
        
        // Cache the parsed response for future identical queries
        cacheGeminiResponse(cacheKey, parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError.message);
        return res.status(400).json({
          error: 'AI parsing failed',
          message: 'Could not parse AI response',
          results: [],
          total: 0,
        });
      }
    }

    console.log('Parsed filters:', JSON.stringify(parsedResponse?.filters || {}, null, 2));

    // Use Gemini-parsed values, with manual filters as overrides
    // If Gemini fails to identify query term, use the original user input instead of defaulting to "product"
    const searchQuery = parsedResponse?.query && parsedResponse.query.trim() ? parsedResponse.query : naturalLanguageQuery;
    const color_final = color || parsedResponse?.filters?.color;
    const category_final = category || parsedResponse?.filters?.category;
    const minPrice_final = minPrice || parsedResponse?.filters?.min_price;
    const maxPrice_final = maxPrice || parsedResponse?.filters?.max_price;
    const specs_final = parsedResponse?.filters?.specifications || [];

    // Calculate pagination  
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = 40;

    // Extract sort from manual parameter first, then fallback to AI-detected sort
    let sortBy = [];
    
    // Priority 1: If Gemini AI detected a sort intent in the natural language query, use that
    if (parsedResponse?.sort?.field && parsedResponse?.sort?.order) {
      const sortField = parsedResponse.sort.field.toLowerCase();
      const sortOrder = parsedResponse.sort.order.toLowerCase();
      
      if (sortField === 'price') {
        sortBy = [{ price: { order: sortOrder } }];
      } else if (sortField === 'rating') {
        sortBy = [{ rating: { order: sortOrder } }];
      } else if (sortField === 'ratings_count') {
        sortBy = [{ ratings_count: { order: sortOrder } }];
      }
      
      if (sortBy.length > 0) {
        console.log('🎯 AI-DETECTED SORT (HIGH PRIORITY):', sortField, sortOrder);
      }
    } 
    // Priority 2: If no AI sort detected, use manual sort from dropdown
    else if (sort && sort !== 'relevance') {
      console.log('🔄 Manual sort (fallback):', sort);
      
      if (sort === 'price_asc') {
        sortBy = [{ price: { order: 'asc' } }];
      } else if (sort === 'price_desc') {
        sortBy = [{ price: { order: 'desc' } }];
      } else if (sort === 'rating_desc') {
        sortBy = [{ rating: { order: 'desc' } }];
      } else if (sort === 'ratings_count_desc') {
        sortBy = [{ ratings_count: { order: 'desc' } }];
      }
      
      if (sortBy.length > 0) {
        console.log('🔄 Manual sorting applied:', sort);
      }
    }

    // Build Elasticsearch query using SAME builder as /search endpoint
    // Convert specs_final format to specFilters format
    const specFilters = specs_final && Array.isArray(specs_final) 
      ? specs_final.map(spec => ({
          name: String(spec.name).toLowerCase().trim(),
          values: [String(spec.value).toLowerCase().trim()]
        }))
      : [];

    const { esQuery, filters: constructedFilters } = buildElasticsearchQuery({
      searchQuery,
      pageNum,
      pageSize,
      sortBy,
      minPrice: minPrice_final,
      maxPrice: maxPrice_final,
      color: color_final,
      category: category_final,
      specFilters,
    });

    // Log query in DEBUG mode
    if (DEBUG) {
      console.log('\n🔍 ELASTICSEARCH QUERY (AI Search - using shared builder):');
      console.log('Index:', ES_INDEX);
      console.log('Query:', JSON.stringify(esQuery.body.query, null, 2));
      console.log('Filters applied:');
      if (color_final) console.log('  - Color:', color_final);
      if (category_final) console.log('  - Category:', category_final);
      if (minPrice_final || maxPrice_final) console.log('  - Price range:', `${minPrice_final || 0} - ${maxPrice_final || 'unlimited'}`);
      if (specs_final && Array.isArray(specs_final) && specs_final.length > 0) console.log('  - Specifications:', specs_final);
      console.log('Page:', pageNum, 'From:', (pageNum - 1) * pageSize, 'Size:', pageSize);
      console.log('Complete ES Query Body:', JSON.stringify(esQuery.body, null, 2));
    }

    // Perform Elasticsearch search
    let searchResults = await esClient.search(esQuery);
    let totalHits = searchResults.hits.total.value || 0;
    let recovery = null;
    
    console.log(`\n📊 Elasticsearch Results: totalHits=${totalHits}, recovery=${enableRecoveryFlag}`);
    
    // ===== ZERO RESULT RECOVERY (Optional - when enableRecoveryFlag flag is true) =====
    if (enableRecoveryFlag && totalHits === 0) {
      console.log('🚨 ZERO RESULTS (AI Search) - Attempting recovery...');
      console.log(`📋 Recovery working on ${geminiFromCache ? 'CACHED Gemini response' : 'FRESH Gemini response'}`);
      const recoveryResult = await recoverFromZeroResults({
        originalQuery: searchQuery,
        filters: constructedFilters,
        esClient,
        pageNum,
        pageSize,
        sortBy,
      });
      
      // Convert facets from API format back to ES bucket format for processing
      const convertFacetsToBuckets = (facets) => {
        return {
          colors: {
            buckets: (facets.colors || []).map(f => ({ key: f.value, doc_count: f.count }))
          },
          categories: {
            buckets: (facets.categories || []).map(f => ({ key: f.value, doc_count: f.count }))
          },
          specifications: {
            spec_names: {
              buckets: (facets.specifications || []).map(spec => ({
                key: spec.name,
                spec_values: {
                  buckets: (spec.values || []).map(v => ({ key: v.value, doc_count: v.count }))
                }
              }))
            }
          }
        };
      };
      
      searchResults.hits.hits = [];
      searchResults.hits.total = { value: recoveryResult.total };
      searchResults.aggregations = convertFacetsToBuckets(recoveryResult.facets);
      
      recovery = recoveryResult.recovery;
      totalHits = recoveryResult.total;
      
      // Map recovery facets to Elasticsearch format for consistency
      recoveryResult.results.forEach(result => {
        searchResults.hits.hits.push({
          _id: result.id,
          _source: {
            name: result.name,
            price: result.price,
            image: result.image,
            color: result.color,
            category: result.category,
            rating: result.rating,
            ratings_count: result.ratings_count,
            description: result.description,
          }
        });
      });
    }

    // Extract and format results
    const results = searchResults.hits.hits.map((hit) => ({
      id: hit._id,
      name: hit._source.name,
      price: hit._source.price,
      image: getValidImageUrl(hit._source.image),
      color: hit._source.color,
      category: hit._source.category || 'Uncategorized',
      rating: hit._source.rating || 0,
      ratings_count: hit._source.ratings_count || 0,
      description: hit._source.description || '',
    }));

    // Format aggregations into facets
    const facets = {
      colors: searchResults.aggregations.colors.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      categories: searchResults.aggregations.categories.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      specifications: searchResults.aggregations.specifications ? searchResults.aggregations.specifications.spec_names.buckets.map((specBucket) => ({
        name: specBucket.key,
        values: specBucket.spec_values.buckets.map((valueBucket) => ({
          value: valueBucket.key,
          count: valueBucket.doc_count,
        })),
      })) : [],
    };

    const totalPages = Math.ceil(totalHits / pageSize);

    console.log('✅ AI Search Results:', results.length, 'products found');

    const response = {
      success: true,
      count: results.length,
      total: totalHits,
      page: pageNum,
      totalPages,
      pageSize,
      results,
      facets,
      aiInterpretation: parsedResponse?.interpretation || 'Search processed with AI rules parser',
      geminiCache: {
        cacheHit: geminiFromCache,
        status: geminiFromCache ? 'CACHED' : 'FRESH',
        message: geminiFromCache ? '✅ Using cached Gemini response (recovery still works on top)' : '🆕 Fresh Gemini parsing'
      },
      appliedFilters: {
        query: searchQuery,
        color: color_final || null,
        category: category_final || null,
        minPrice: minPrice_final || null,
        maxPrice: maxPrice_final || null,
        specifications: specs_final || [],
      },
      // Show what was ACTUALLY applied after recovery
      actuallyAppliedFilters: recovery ? {
        color: recovery.strategy.includes('color') ? null : (color_final || null),
        category: recovery.strategy.includes('category') ? null : (category_final || null),
        minPrice: recovery.strategy.includes('price') ? null : (minPrice_final || null),
        maxPrice: recovery.strategy.includes('price') ? null : (maxPrice_final || null),
        message: `⚠️ Recovery relaxed: ${recovery.appliedRemovals.join(', ')}`
      } : null,
    };

    // Add recovery info if recovery was triggered
    if (recovery) {
      response.recovery = recovery;
    }

    // Track search event
    await trackSearch(searchQuery, totalHits, totalHits === 0, 'ai-search');

    res.json(response);
  } catch (error) {
    console.error('⚠ AI search error, falling back to traditional search:', error.message);
    
    // Fallback to traditional search if AI fails
    try {
      const queryFromBody = req.body.query || '';
      const pageFromBody = req.body.page || 1;
      const sanitizedQuery = queryFromBody.trim().replace(/[<>]/g, '');
      
      const pageNum = Math.max(1, parseInt(pageFromBody) || 1);
      const pageSize = 40;
      const from = (pageNum - 1) * pageSize;

      const esQuery = {
        index: ES_INDEX,
        body: {
          size: pageSize,
          from,
          query: {
            multi_match: {
              query: sanitizedQuery,
              fields: ['name^2', 'description'],
              fuzziness: 'AUTO',
            },
          },
          aggs: {
            colors: {
              terms: {
                field: 'color',
                size: 100,
              },
            },
            categories: {
              terms: {
                field: 'category',
                size: 100,
              },
            },
            specifications: {
              nested: {
                path: 'specifications',
              },
              aggs: {
                spec_names: {
                  terms: {
                    field: 'specifications.name',
                    size: 7,
                  },
                  aggs: {
                    spec_values: {
                      terms: {
                        field: 'specifications.value',
                        size: 10,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const searchResults = await esClient.search(esQuery);
      
      const results = searchResults.hits.hits.map((hit) => ({
        id: hit._id,
        name: hit._source.name,
        price: hit._source.price,
        image: getValidImageUrl(hit._source.image),
        color: hit._source.color,
        category: hit._source.category || 'Uncategorized',
        rating: hit._source.rating || 0,
        ratings_count: hit._source.ratings_count || 0,
        description: hit._source.description || '',
      }));

      const facets = {
        colors: searchResults.aggregations.colors.buckets.map((bucket) => ({
          value: bucket.key,
          count: bucket.doc_count,
        })),
        categories: searchResults.aggregations.categories.buckets.map((bucket) => ({
          value: bucket.key,
          count: bucket.doc_count,
        })),
        specifications: searchResults.aggregations.specifications.spec_names.buckets.map((specBucket) => ({
          name: specBucket.key,
          values: specBucket.spec_values.buckets.map((valueBucket) => ({
            value: valueBucket.key,
            count: valueBucket.doc_count,
          })),
        })),
      };

      const totalHits = searchResults.hits.total.value || 0;
      const totalPages = Math.ceil(totalHits / pageSize);

      res.json({
        success: true,
        count: results.length,
        total: totalHits,
        page: pageNum,
        totalPages,
        pageSize,
        results,
        facets,
        aiInterpretation: `Standard search for: "${sanitizedQuery}"`,
        appliedFilters: {
          query: sanitizedQuery,
          color: null,
          category: null,
          minPrice: null,
          maxPrice: null,
          specifications: [],
        },
      });
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      res.status(500).json({
        error: 'Search failed',
        message: 'Both AI and traditional search unavailable',
        results: [],
        total: 0,
      });
    }
  }
});

// Search endpoint with pagination, sorting, and filtering
app.get('/search', async (req, res) => {
  try {
    console.log('\n🔎 === SEARCH ENDPOINT CALLED ===');
    console.log('Index:', ES_INDEX);
    const { q, page = 1, sort = 'relevance', minPrice, maxPrice, color, category, spec } = req.query;

    // Validate query parameter
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
        results: [],
        total: 0,
      });
    }

    // Sanitize input - remove special characters that could cause issues
    const sanitizedQuery = q.trim().replace(/[<>]/g, '');
    
    // Parse specification filters (format: spec=name:value or spec=name:value1,value2)
    const specFilters = [];
    if (spec) {
      const specArray = Array.isArray(spec) ? spec : [spec];
      specArray.forEach(specString => {
        const [specName, specValues] = specString.split(':');
        if (specName && specValues) {
          const values = specValues.split(',');
          specFilters.push({ name: specName.toLowerCase().trim(), values: values.map(v => v.toLowerCase().trim()) });
        }
      });
    }
    
    // Log incoming request
    console.log('\n📥 Search Request:');
    console.log('Query:', q);
    console.log('Sanitized:', sanitizedQuery);
    console.log('Page:', page);
    console.log('Sort:', sort);
    console.log('MinPrice:', minPrice, 'MaxPrice:', maxPrice);
    console.log('Color:', color);
    console.log('Category:', category);
    if (specFilters.length > 0) console.log('Specifications:', specFilters);
    console.log('---');
    
    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize =40;

    // Determine sort order
    let sortBy = [];
    if (sort === 'price_asc') {
      sortBy = [{ price: { order: 'asc' } }];
    } else if (sort === 'price_desc') {
      sortBy = [{ price: { order: 'desc' } }];
    } else if (sort === 'rating_desc') {
      sortBy = [{ rating: { order: 'desc' } }];
    } else if (sort === 'ratings_count_desc') {
      sortBy = [{ ratings_count: { order: 'desc' } }];
    }
    // 'relevance' is default (no explicit sort needed for _score)

    // Use common helper to build Elasticsearch query (source of truth)
    const { esQuery, filters } = buildElasticsearchQuery({
      searchQuery: sanitizedQuery,
      pageNum,
      pageSize,
      sortBy,
      minPrice,
      maxPrice,
      color,
      category,
      specFilters,
    });

    // Log Elasticsearch query for debugging (only in DEBUG mode)
    if (DEBUG) {
      console.log('\n🔍 ELASTICSEARCH QUERY (Traditional Search):');
      console.log('Index:', ES_INDEX);
      console.log('Query:', JSON.stringify(esQuery.body.query, null, 2));
      console.log('Filters:', JSON.stringify(filters, null, 2));
      console.log('Sort:', JSON.stringify(sortBy, null, 2));
      console.log('Complete ES Query Body:', JSON.stringify(esQuery.body, null, 2));
    }

    // Perform Elasticsearch search
    let searchResults = await esClient.search(esQuery);
    let totalHits = searchResults.hits.total.value || 0;
    
    // Log results
    console.log('✅ Elasticsearch Results:');
    console.log('Total hits:', totalHits);
    console.log('Returned results:', searchResults.hits.hits.length);
    console.log('📊 Aggregations:');
    console.log('Colors:', searchResults.aggregations.colors.buckets.length, 'buckets');
    console.log('Categories:', searchResults.aggregations.categories.buckets.length, 'buckets');
    console.log('---\n');

    // Extract and format results (Phase 1/2 spec + description for UI)
    const results = searchResults.hits.hits.map((hit) => ({
      id: hit._id,
      name: hit._source.name,
      price: hit._source.price,
      image: getValidImageUrl(hit._source.image),
      color: hit._source.color,
      category: hit._source.category || 'Uncategorized',
      rating: hit._source.rating || 0,
      ratings_count: hit._source.ratings_count || 0,
      description: hit._source.description || '',
    }));

    // Format aggregations into facets
    const facets = {
      colors: searchResults.aggregations.colors.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      categories: searchResults.aggregations.categories.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      specifications: searchResults.aggregations.specifications ? searchResults.aggregations.specifications.spec_names.buckets.map((specBucket) => ({
        name: specBucket.key,
        values: specBucket.spec_values.buckets.map((valueBucket) => ({
          value: valueBucket.key,
          count: valueBucket.doc_count,
        })),
      })) : [],
    };

    const totalPages = Math.ceil(totalHits / pageSize);

    const response = {
      success: true,
      count: results.length,
      total: totalHits,
      page: pageNum,
      totalPages,
      pageSize,
      results,
      facets,
    };

    // Track search event
    await trackSearch(sanitizedQuery, totalHits, totalHits === 0, 'traditional');

    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
      results: [],
      total: 0,
    });
  }
});

// Autocomplete endpoint - returns suggestions based on partial input
app.get('/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;

    console.log('\n🔤 === AUTOCOMPLETE ENDPOINT CALLED ===');
    console.log('Query:', q);

    // Return empty if query is too short
    if (!q || q.trim().length < 2) {
      console.log('Query too short, returning empty');
      return res.json({ success: true, suggestions: [] });
    }

    const sanitizedQuery = q.trim().replace(/[<>]/g, '');

    // Autocomplete query using match_phrase_prefix for partial matching
    const autocompleteQuery = {
      index: ES_INDEX,
      body: {
        size: 5,
        query: {
          bool: {
            should: [
              {
                match_phrase_prefix: {
                  name: {
                    query: sanitizedQuery,
                    boost: 2, // Prefer name matches
                  },
                },
              },
              {
                match_phrase_prefix: {
                  description: {
                    query: sanitizedQuery,
                  },
                },
              },
              {
                match: {
                  name: {
                    query: sanitizedQuery,
                    fuzziness: 'AUTO',
                    boost: 1.5,
                  },
                },
              },
            ],
          },
        },
        _source: ['product_id', 'name'], // Only return id and name
      },
    };

    console.log('Autocomplete query:', JSON.stringify(autocompleteQuery.body.query, null, 2));

    // Perform Elasticsearch search
    const autocompleteResults = await esClient.search(autocompleteQuery);

    // Extract suggestions
    const suggestions = autocompleteResults.hits.hits.map((hit) => ({
      id: hit._source.product_id,
      name: hit._source.name,
    }));

    console.log('✅ Autocomplete results:', suggestions.length);
    console.log('---\n');

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      error: 'Autocomplete failed',
      message: error.message,
      suggestions: [],
    });
  }
});

// Search analytics - simple in-memory tracking
let searchAnalytics = {};

// Track search endpoint
app.post('/search/analytics', express.json(), (req, res) => {
  try {
    const { query, resultsCount } = req.body;
    if (query) {
      const sanitized = query.toLowerCase().trim();
      searchAnalytics[sanitized] = (searchAnalytics[sanitized] || 0) + 1;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Analytics tracking failed' });
  }
});

// Get trending searches
app.get('/search/trending', (req, res) => {
  try {
    const trending = Object.entries(searchAnalytics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    res.json({ success: true, trending });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending searches' });
  }
});

// ============================================
// ZERO RESULT RECOVERY SYSTEM
// ============================================

/**
 * Attempt to recover from zero results by progressively relaxing filters
 */
async function recoverFromZeroResults({
  originalQuery,
  filters,
  esClient,
  pageNum = 1,
  pageSize = 40,
  sortBy = [],
}) {
  const recoveryAttempts = [];

  console.log('\n⚠️ ZERO RESULTS - TRIGGERING RECOVERY');
  console.log('📋 Original filters passed to recovery:', JSON.stringify(filters, null, 2));

  // STEP 1: Remove specifications filter
  if (filters.some(f => f.nested?.path === 'specifications')) {
    console.log('📌 Recovery Attempt 1: Removing specifications filter');
    const relaxedFilters1 = filters.filter(f => f.nested?.path !== 'specifications');
    console.log('   Filters after removal:', JSON.stringify(relaxedFilters1, null, 2));
    const result1 = await executeSearch(originalQuery, pageNum, pageSize, sortBy, relaxedFilters1);
    console.log('   Results found:', result1.total);
    
    if (result1.total > 0) {
      console.log('✅ Recovery Attempt 1 SUCCESS: Found', result1.total, 'products');
      return {
        results: result1.results,
        facets: result1.facets,
        total: result1.total,
        recovery: {
          triggered: true,
          strategy: 'removed_specifications',
          message: 'No exact match found. Showing similar results (specifications filter removed).',
          appliedRemovals: ['specifications']
        }
      };
    }
    recoveryAttempts.push('specifications');
  }

  // STEP 2: Remove color filter
  if (filters.some(f => f.term?.color)) {
    console.log('📌 Recovery Attempt 2: Removing color filter');
    console.log('   Checking filters for color:', filters.map(f => ({ hasColor: Boolean(f.term?.color), filter: f })));
    const relaxedFilters2 = filters.filter(f => !f.term?.color).filter(f => f.nested?.path !== 'specifications');
    console.log('   Filters after color removal:', JSON.stringify(relaxedFilters2, null, 2));
    const result2 = await executeSearch(originalQuery, pageNum, pageSize, sortBy, relaxedFilters2);
    console.log('   Results found:', result2.total);
    
    if (result2.total > 0) {
      console.log('✅ Recovery Attempt 2 SUCCESS: Found', result2.total, 'products');
      return {
        results: result2.results,
        facets: result2.facets,
        total: result2.total,
        recovery: {
          triggered: true,
          strategy: 'removed_color',
          message: 'No exact match found. Showing similar results (color filter removed).',
          appliedRemovals: recoveryAttempts.concat(['color'])
        }
      };
    }
    recoveryAttempts.push('color');
  }

  // STEP 3: Expand price range
  const priceFilter = filters.find(f => f.range?.price);
  if (priceFilter) {
    console.log('📌 Recovery Attempt 3: Expanding price range');
    const expandedPrice = { ...priceFilter.range.price };
    if (expandedPrice.gte) expandedPrice.gte = Math.max(0, expandedPrice.gte * 0.5);
    if (expandedPrice.lte) expandedPrice.lte = expandedPrice.lte * 1.5;
    console.log('   Original price:', priceFilter.range.price, '→ Expanded:', expandedPrice);
    
    const relaxedFilters3 = filters.map(f => f.range?.price ? { range: { price: expandedPrice } } : f);
    console.log('   Filters after price expansion:', JSON.stringify(relaxedFilters3, null, 2));
    const result3 = await executeSearch(originalQuery, pageNum, pageSize, sortBy, relaxedFilters3);
    console.log('   Results found:', result3.total);
    
    if (result3.total > 0) {
      console.log('✅ Recovery Attempt 3 SUCCESS: Found', result3.total, 'products');
      return {
        results: result3.results,
        facets: result3.facets,
        total: result3.total,
        recovery: {
          triggered: true,
          strategy: 'expanded_price',
          message: 'No products in your price range. Showing similar results with expanded price range.',
          appliedRemovals: [...recoveryAttempts],
          priceExpanded: true
        }
      };
    }
  }

  // STEP 4: AI Query Rewrite (Gemini)
  if (geminiClients.length > 0) {
    console.log('📌 Recovery Attempt 4: AI query rewrite');
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const rewritePrompt = `You are an ecommerce search expert. The search query "${originalQuery}" returned zero results.

Rewrite this query to be BROADER while keeping the user intent. Remove specific constraints but keep the main product type.

Examples:
- "red leather bag under 500" → "bag"
- "sony 65 inch 4k tv under 50000" → "tv"
- "formal blue shirt cotton" → "shirt"

Return ONLY the rewritten query, no explanation.`;

      const rewriteResult = await model.generateContent(rewritePrompt);
      const rewritttenQuery = rewriteResult.response.text().trim().toLowerCase();
      
      console.log(`✏️ Query rewritten: "${originalQuery}" → "${rewritttenQuery}"`);

      if (rewritttenQuery && rewritttenQuery.length > 0) {
        const resultAI = await executeSearch(rewritttenQuery, pageNum, pageSize, sortBy, []);
        
        if (resultAI.total > 0) {
          return {
            results: resultAI.results,
            facets: resultAI.facets,
            total: resultAI.total,
            recovery: {
              triggered: true,
              strategy: 'ai_query_rewrite',
              message: `No products found for "${originalQuery}". Showing results for "${rewritttenQuery}".`,
              originalQuery: originalQuery,
              rewrittenQuery: rewritttenQuery
            }
          };
        }
      }
    } catch (geminiError) {
      console.warn('⚠️ AI query rewrite failed:', geminiError.message);
    }
  }

  // STEP 5: Fallback - Remove all filters, search with just query
  console.log('📌 Recovery Attempt 5: Fallback - removing ALL filters');
  const resultFallback = await executeSearch(originalQuery, pageNum, pageSize, sortBy, []);
  console.log('   Results found with no filters:', resultFallback.total);
  
  if (resultFallback.total > 0) {
    console.log('✅ Recovery Attempt 5 SUCCESS: Found', resultFallback.total, 'products (all filters removed)');
  } else {
    console.log('❌ Recovery FAILED: No products found even after removing all filters');
  }
  
  return {
    results: resultFallback.results,
    facets: resultFallback.facets,
    total: resultFallback.total,
    recovery: {
      triggered: true,
      strategy: 'fallback',
      message: 'No products found for your search. Showing popular alternatives.',
    }
  };
}

/**
 * Execute Elasticsearch search with given parameters
 */
async function executeSearch(query, pageNum, pageSize, sortBy, filters) {
  try {
    const from = (pageNum - 1) * pageSize;

    const esQuery = {
      index: ES_INDEX,
      body: {
        size: pageSize,
        from,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query,
                  fields: ['name^2', 'description']
                },
              },
            ],
            filter: filters,
          },
        },
        aggs: {
          colors: {
            terms: { field: 'color', size: 100 },
          },
          categories: {
            terms: { field: 'category', size: 100 },
          },
          specifications: {
            nested: { path: 'specifications' },
            aggs: {
              spec_names: {
                terms: { field: 'specifications.name', size: 7 },
                aggs: {
                  spec_values: {
                    terms: { field: 'specifications.value', size: 10 },
                  },
                },
              },
            },
          },
        },
      },
    };

    if (sortBy && sortBy.length > 0) {
      esQuery.body.sort = sortBy;
    }

    const searchResults = await esClient.search(esQuery);
    const totalHits = searchResults.hits.total.value || 0;

    const results = searchResults.hits.hits.map((hit) => ({
      id: hit._id,
      name: hit._source.name,
      price: hit._source.price,
      image: getValidImageUrl(hit._source.image),
      color: hit._source.color,
      category: hit._source.category || 'Uncategorized',
      rating: hit._source.rating || 0,
      ratings_count: hit._source.ratings_count || 0,
      description: hit._source.description || '',
    }));

    const facets = {
      colors: searchResults.aggregations.colors.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })),
      categories: searchResults.aggregations.categories.buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })),
      specifications: searchResults.aggregations.specifications.spec_names.buckets.map((specBucket) => ({
        name: specBucket.key,
        values: specBucket.spec_values.buckets.map((valueBucket) => ({
          value: valueBucket.key,
          count: valueBucket.doc_count,
        })),
      })),
    };

    return { results, facets, total: totalHits };
  } catch (error) {
    console.error('Execute search error:', error);
    return { results: [], facets: {}, total: 0 };
  }
}

app.get('/keywords', async (req, res) => {
  try {
    const field = req.query.field || 'name';
    const size = Math.min(parseInt(req.query.size) || 20, 100);

    console.log(`🧠 AI-based keyword extraction from field: "${field}", size: ${size}`);

    // Check if Gemini is configured
    if (geminiClients.length === 0) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'GEMINI_API_KEY not configured',
      });
    }

    // Generate cache key for AI keyword extraction
    const cacheKey = `keywords:${field}:${size}`;
    const cachedKeywords = getCachedGeminiResponse(cacheKey);
    
    let keywords;

    if (cachedKeywords) {
      keywords = cachedKeywords;
    } else {
      // Fetch ALL documents from Elasticsearch
      console.log(`📥 Fetching all documents from field: "${field}"`);
      const esQuery = {
        index: ES_INDEX,
        body: {
          size: 10000, // Fetch up to 10k documents
          _source: [field],
          query: {
            match_all: {},
          },
        },
      };

      const searchResults = await esClient.search(esQuery);
      const documents = searchResults.hits.hits;

      console.log(`✅ Fetched ${documents.length} documents`);

      if (documents.length === 0) {
        return res.json({
          success: true,
          field,
          count: 0,
          keywords: [],
          message: 'No documents found in index',
        });
      }

      // Extract text from documents
      const textData = documents
        .map(doc => doc._source[field])
        .filter(text => text && String(text).trim().length > 0)
        .map(text => String(text).trim());

      console.log(`📄 Extracted ${textData.length} product names`);

      // Create a formatted list of actual product names for Gemini
      const productList = textData
        .slice(0, 500) // Limit to first 500 for clarity
        .map((name, idx) => `${idx + 1}. ${name}`)
        .join('\n');

      // Send to Gemini for AI analysis
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are an ecommerce keyword analyst expert.

IMPORTANT: Extract ONLY keywords that ACTUALLY EXIST in the provided product data. Do NOT generate, infer, or create new keywords.

Below are ACTUAL product ${field}s from an ecommerce database. Extract the TOP ${size} most frequent and meaningful keywords that appear in these names.

ACTUAL PRODUCT NAMES:
${productList}

EXTRACTION RULES:
- Extract keywords that ACTUALLY APPEAR in the product names above
- Do NOT generate new keywords or categories that don't appear
- Do NOT infer or assume keywords
- Do NOT create hyphenated versions that don't exist in the data
- Return only words/phrases that exist verbatim or as substrings in the data
- Use lowercase for all keywords
- Remove special characters (keep only letters, numbers, spaces)
- Return as JSON array format: ["keyword1", "keyword2", "keyword3", ...]
- Return exactly ${size} keywords (if fewer unique keywords exist in data, return only what exists - do NOT make up keywords)

Example (if these actual words appear in the product names):
["backpack", "laptop", "school", "travel", "bag"]`;

      if (DEBUG) {
        console.log('\n📤 GEMINI KEYWORD EXTRACTION REQUEST:');
        console.log('Field:', field);
        console.log('Size:', size);
        console.log('Prompt length:', prompt.length);
      }

      let result;
      try {
        result = await model.generateContent(prompt);
      } catch (geminiError) {
        console.error('⚠️ Gemini API error:', geminiError.message);
        return res.status(503).json({
          error: 'Gemini API failed',
          message: geminiError.message,
        });
      }

      const responseText = result.response.text();

      if (DEBUG) {
        console.log('\n📥 GEMINI RESPONSE:');
        console.log('Response:', responseText);
      }

      // Parse the JSON response
      try {
        let jsonText = responseText.trim();
        
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
        }

        const parsed = JSON.parse(jsonText);
        keywords = Array.isArray(parsed) ? parsed : [];

        // Validate and clean keywords
        keywords = keywords
          .filter(k => k && String(k).trim().length > 0)
          .map(k => String(k).trim().toLowerCase())
          .slice(0, size); // Ensure we don't exceed requested size

        console.log(`✅ AI extracted ${keywords.length} keywords`);

        // Cache the result
        cacheGeminiResponse(cacheKey, keywords);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError.message);
        return res.status(400).json({
          error: 'Failed to parse AI response',
          message: parseError.message,
        });
      }
    }

    res.json({
      success: true,
      field,
      count: keywords.length,
      keywords,
      source: 'AI-analyzed keywords from Elasticsearch data',
    });
  } catch (error) {
    console.error('Failed to extract keywords:', error.message);
    res.status(500).json({
      error: 'Failed to extract keywords',
      message: error.message,
    });
  }
});

/**
 * Store synonym response in cache
 */
function cacheSynonymResponse(cacheKey, data) {
  if (!geminiCacheStore) geminiCacheStore = new Map();
  geminiCacheStore.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  console.log('💾 SYNONYM CACHE STORED: Response cached for 2 minutes');
}

/**
 * Get cached synonym response if available and not expired
 */
function getCachedSynonymResponse(cacheKey) {
  if (!geminiCacheStore) return null;
  const cached = geminiCacheStore.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    geminiCacheStore.delete(cacheKey);
    return null;
  }
  
  console.log('✅ SYNONYM CACHE HIT: Using cached response');
  return cached.data;
}

// Separate cache for synonyms
const geminiCacheStore = new Map();

// POST /generate-synonyms - Generate synonyms using Gemini AI
app.post('/generate-synonyms', async (req, res) => {
  try {
    const { keywords } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'keywords array is required and must not be empty',
      });
    }

    if (geminiClients.length === 0) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'GEMINI_API_KEY not configured',
      });
    }

    // Limit to 20 keywords
    const processKeywords = keywords.slice(0, 20).sort(); // Sort for consistent cache key
    const cacheKey = `synonyms:${processKeywords.join('|')}`;
    
    console.log(`\n🧠 === SYNONYM GENERATION ===`);
    console.log(`Processing ${processKeywords.length} keywords:`, processKeywords);

    // Check cache first
    const cachedResponse = getCachedSynonymResponse(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an ecommerce search expert.
Generate 2-3 relevant synonyms for each keyword below.
Think about how users search for products - include variations, related terms, and common alternatives.

Keywords to process: ${JSON.stringify(processKeywords)}

Return ONLY a valid JSON object with NO explanation, NO markdown, NO code blocks.
Format:
{
  "keyword1": ["synonym1", "synonym2", "synonym3"],
  "keyword2": ["synonym1", "synonym2"]
}`;

    if (DEBUG) {
      console.log('📤 GEMINI REQUEST:');
      console.log('Model: gemini-2.5-flash');
      console.log('Prompt:\n', prompt);
    }

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (geminiError) {
      console.error('⚠️ Gemini API error:', geminiError.message);
      return res.status(503).json({
        error: 'Gemini API failed',
        message: geminiError.message,
        hint: 'This could be due to: API quota exceeded, rate limiting, or service unavailability',
      });
    }

    const responseText = result.response.text();

    if (DEBUG) {
      console.log('\n📥 GEMINI RESPONSE:');
      console.log('Full Response:\n', responseText);
    }

    // Parse response
    let parsedSynonyms;
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
      }
      parsedSynonyms = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError.message);
      return res.status(400).json({
        error: 'Failed to parse AI response',
        message: parseError.message,
      });
    }

    // Convert to Elasticsearch synonym format: "term, synonym1, synonym2"
    const synonymLines = Object.entries(parsedSynonyms).map(([keyword, syns]) => {
      const allTerms = [keyword, ...(Array.isArray(syns) ? syns : [])];
      return allTerms.join(', ');
    });

    console.log('✅ Generated synonyms:', synonymLines);

    const response = {
      success: true,
      count: synonymLines.length,
      synonyms: synonymLines,
      raw: parsedSynonyms,
    };

    // Cache the response
    cacheSynonymResponse(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('⚠️ Synonym generation error:', error.message);
    console.error('Error details:', error);
    
    res.status(500).json({
      error: 'Synonym generation failed',
      message: error.message,
      type: error.constructor.name,
    });
  }
});

// POST /update-synonyms - Update Elasticsearch index with synonyms
app.post('/update-synonyms', async (req, res) => {
  try {
    const { synonyms } = req.body;

    if (!synonyms || !Array.isArray(synonyms) || synonyms.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'synonyms array is required and must not be empty',
      });
    }

    console.log(`\n🔄 === UPDATING ELASTICSEARCH SYNONYMS (ACCUMULATIVE) ===`);
    console.log(`Received ${synonyms.length} new synonym rules`);

    // Merge new synonyms with existing ones (no duplicates)
    const allSynonyms = await mergeSynonyms(synonyms);
    
    // Save to Elasticsearch metadata index
    const savedSynonyms = await saveAppliedSynonyms(allSynonyms);

    // Close index to apply settings
    await esClient.indices.close({ index: ES_INDEX });
    console.log('📴 Index closed');

    // Update index settings with ALL synonyms (accumulated + new)
    await esClient.indices.putSettings({
      index: ES_INDEX,
      body: {
        analysis: {
          filter: {
            synonym_graph_filter: {
              type: 'synonym_graph',
              synonyms: savedSynonyms,
              lenient: true,
            },
          },
          analyzer: {
            custom_search_analyzer: {
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'stop',
                'porter_stem',
                'synonym_graph_filter',
              ],
            },
          },
        },
      },
    });
    console.log('⚙️ Settings updated with ALL accumulated synonym rules');

    // Reopen index
    await esClient.indices.open({ index: ES_INDEX });
    console.log('📴 Index reopened');

    console.log('✅ Synonyms updated successfully (accumulated)');

    res.json({
      success: true,
      message: 'Synonyms updated successfully (accumulated with existing)',
      addedCount: synonyms.length,
      totalCount: savedSynonyms.length,
      appliedSynonyms: savedSynonyms,
    });
  } catch (error) {
    console.error('⚠️ Failed to update synonyms:', error.message);
    
    // Try to reopen index if it's closed
    try {
      await esClient.indices.open({ index: ES_INDEX });
    } catch (reopenError) {
      console.error('Could not reopen index:', reopenError.message);
    }

    res.status(500).json({
      error: 'Failed to update synonyms',
      message: error.message,
    });
  }
});

// GET /applied-synonyms - View all currently applied synonyms
app.get('/applied-synonyms', async (req, res) => {
  try {
    const synonyms = await loadAppliedSynonyms();
    console.log(`📋 Retrieved ${synonyms.length} applied synonym rules`);
    
    res.json({
      success: true,
      count: synonyms.length,
      synonyms: synonyms,
      storage: METADATA_INDEX,
    });
  } catch (error) {
    console.error('Failed to retrieve synonyms:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve synonyms',
      message: error.message,
    });
  }
});

// POST /reset-synonyms - Clear all applied synonyms
app.post('/reset-synonyms', async (req, res) => {
  try {
    console.log('\n🗑️ === RESETTING ALL SYNONYMS ===');
    
    // Delete stored synonyms from Elasticsearch
    try {
      await esClient.delete({
        index: METADATA_INDEX,
        id: 'applied_synonyms',
      });
      console.log(`🗑️ Deleted synonym storage from ES (${METADATA_INDEX})`);
    } catch (deleteError) {
      if (deleteError.statusCode !== 404) {
        throw deleteError;
      }
      console.log('📋 No stored synonyms to delete');
    }

    // Close index
    await esClient.indices.close({ index: ES_INDEX });
    console.log('📴 Index closed');

    // Update index settings to remove synonyms
    await esClient.indices.putSettings({
      index: ES_INDEX,
      body: {
        analysis: {
          filter: {
            synonym_graph_filter: {
              type: 'synonym_graph',
              synonyms: [],
              lenient: true,
            },
          },
          analyzer: {
            custom_search_analyzer: {
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'stop',
                'porter_stem',
                'synonym_graph_filter',
              ],
            },
          },
        },
      },
    });
    console.log('⚙️ Removed all synonyms from index');

    // Reopen index
    await esClient.indices.open({ index: ES_INDEX });
    console.log('📴 Index reopened');

    console.log('✅ All synonyms reset successfully');

    res.json({
      success: true,
      message: 'All applied synonyms have been reset',
      storageDeleted: true,
    });
  } catch (error) {
    console.error('⚠️ Failed to reset synonyms:', error.message);
    
    try {
      await esClient.indices.open({ index: ES_INDEX });
    } catch (reopenError) {
      console.error('Could not reopen index:', reopenError.message);
    }

    res.status(500).json({
      error: 'Failed to reset synonyms',
      message: error.message,
    });
  }
});

// GET /search/analytics-insights - Generate search analytics insights report
app.get('/search/analytics-insights', async (req, res) => {
  try {
    console.log('\n📊 === SEARCH ANALYTICS INSIGHTS ENDPOINT ===');

    // Fetch aggregated search analytics from Elasticsearch
    const analyticsQuery = {
      index: `${ES_INDEX}-analytics`,
      size: 100,
      body: {
        query: {
          match_all: {},
        },
        sort: [
          { total_searches: { order: 'desc' } },
        ],
      },
    };

    let analyticsData = [];

    try {
      const analyticsResults = await esClient.search(analyticsQuery);
      analyticsData = analyticsResults.hits.hits.map(hit => hit._source);
      console.log(`📥 Fetched ${analyticsData.length} analytics records`);
    } catch (error) {
      console.warn('⚠️ Analytics index not found, returning empty report');
      // Continue with empty data - will return template report
    }

    // Generate insights using AI
    const report = await analyzeSearchAnalytics(analyticsData, genAI);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Analytics insights generation failed:', error.message);
    res.status(500).json({
      error: 'Failed to generate analytics insights',
      message: error.message,
    });
  }
});

// ============================================
// TRACKING ENDPOINTS
// ============================================

/**
 * POST /track/search - Track a search query
 * Body: { query, resultsCount, isZeroResult, engine }
 */
app.post('/track/search', async (req, res) => {
  try {
    const { query, resultsCount = 0, isZeroResult = false, engine = 'traditional' } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required',
      });
    }

    await trackSearch(query, resultsCount, isZeroResult, engine);

    res.json({
      success: true,
      message: 'Search tracked',
    });
  } catch (error) {
    console.error('Track search error:', error.message);
    res.status(500).json({
      error: 'Failed to track search',
      message: error.message,
    });
  }
});

/**
 * POST /track/click - Track a product click
 * Body: { query, productId, position }
 */
app.post('/track/click', async (req, res) => {
  try {
    const { query, productId, position = 0 } = req.body;

    if (!query || !productId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query and productId are required',
      });
    }

    await trackClick(query, productId, position);

    res.json({
      success: true,
      message: 'Click tracked',
    });
  } catch (error) {
    console.error('Track click error:', error.message);
    res.status(500).json({
      error: 'Failed to track click',
      message: error.message,
    });
  }
});

/**
 * POST /track/refinement - Track search refinement (filter changes, new search)
 * Body: { originalQuery, newQuery, filterChanges }
 */
app.post('/track/refinement', async (req, res) => {
  try {
    const { originalQuery, newQuery, filterChanges = null } = req.body;

    if (!originalQuery || !newQuery) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Original and new queries are required',
      });
    }

    await trackRefinement(originalQuery, newQuery, filterChanges);

    res.json({
      success: true,
      message: 'Refinement tracked',
    });
  } catch (error) {
    console.error('Track refinement error:', error.message);
    res.status(500).json({
      error: 'Failed to track refinement',
      message: error.message,
    });
  }
});

// ============================================
// SEARCH INTELLIGENCE ENDPOINT
// ============================================

/**
 * GET /search/intelligence - Generate 6 business-focused intelligence reports
 * 
 * Reports Generated:
 * 1. Search Success Rate Report
 * 2. Lost Opportunity Report
 * 3. Ranking Effectiveness Report
 * 4. AI Quick Wins (Auto-Fix Engine)
 * 5. Trending Searches Report
 * 6. Frustration Signals Report
 */
app.get('/search/intelligence', async (req, res) => {
  try {
    console.log('\n🧠 === SEARCH INTELLIGENCE ENDPOINT ===');

    // Fetch aggregated analytics from Elasticsearch
    const analyticsQuery = {
      index: `${ES_INDEX}-analytics`,
      size: 100,
      body: {
        query: {
          match_all: {},
        },
        sort: [
          { total_searches: { order: 'desc' } },
        ],
      },
    };

    let analyticsData = [];

    try {
      const analyticsResults = await esClient.search(analyticsQuery);
      analyticsData = analyticsResults.hits.hits.map(hit => hit._source);
      console.log(`📥 Fetched ${analyticsData.length} analytics records for intelligence generation`);
    } catch (error) {
      console.warn('⚠️ Analytics index not found, returning empty intelligence report');
      // Continue with empty data - will return template report
    }

    // Generate comprehensive intelligence reports
    const intelligence = await generateSearchIntelligence(analyticsData, genAI);

    res.json({
      success: true,
      intelligence,
    });
  } catch (error) {
    console.error('Search intelligence generation failed:', error.message);
    res.status(500).json({
      error: 'Failed to generate search intelligence',
      message: error.message,
    });
  }
});

// ============================================
// SETUP RULE-BASED SEARCH INSIGHTS ENGINE
// ============================================
console.log('\n⚙️  Initializing Rule-Based Search Insights API');
setupSearchInsightsAPI(app, esClient, {
  indexName: `${ES_INDEX}-analytics`,
  dateRangeGte: 'now-7d',
  debugMode: DEBUG,
  cacheEnabled: true,
  cacheTtlSeconds: 300,
});

console.log('✅ Search Insights API endpoints available:');
console.log('  - GET /api/search-insights');
console.log('  - GET /api/search-insights?format=quick');
console.log('  - GET /api/search-insights?format=detailed');
console.log('  - GET /api/search-insights?period=30d');
console.log('  - GET /api/search-insights/export?format=csv');
console.log('  - GET /api/search-insights/export?format=json');
console.log('  - POST /api/search-insights/cache/clear');

// ============================================
// RULES CONFIGURATION ENDPOINTS
// ============================================
console.log('\n⚙️  Initializing Rules Configuration API');

// Load rules from storage on startup
loadRulesFromStorage();

// GET /api/rules/config - Get all rule configurations
app.get('/api/rules/config', (req, res) => {
  try {
    const rules = getRulesConfig();
    const stats = getRulesStats();
    res.json({
      success: true,
      rules,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching rules config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/rules/config - Update rule configurations
app.put('/api/rules/config', (req, res) => {
  try {
    const { rules } = req.body;
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request: rules array required' 
      });
    }

    const updated = updateRulesConfig(rules);
    const stats = getRulesStats();
    
    res.json({
      success: true,
      rules: updated,
      stats,
      message: 'Rules configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating rules config:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/rules/reset - Reset rules to defaults
app.post('/api/rules/reset', (req, res) => {
  try {
    const rules = resetRulesConfig();
    const stats = getRulesStats();
    
    res.json({
      success: true,
      rules,
      stats,
      message: 'Rules reset to default configuration',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/rules/:ruleId - Update specific rule
app.patch('/api/rules/:ruleId', (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    const updated = updateRule(ruleId, updates);
    
    res.json({
      success: true,
      rule: updated,
      message: `Rule ${ruleId} updated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/rules/:ruleId/toggle - Toggle rule enabled/disabled
app.post('/api/rules/:ruleId/toggle', (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = toggleRuleStatus(ruleId);
    
    res.json({
      success: true,
      rule,
      message: `Rule ${ruleId} status changed to ${rule.enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error toggling rule status:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/rules/stats - Get rules statistics
app.get('/api/rules/stats', (req, res) => {
  try {
    const stats = getRulesStats();
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching rules stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

console.log('✅ Rules Configuration API endpoints available:');
console.log('  - GET /api/rules/config');
console.log('  - PUT /api/rules/config');
console.log('  - POST /api/rules/reset');
console.log('  - PATCH /api/rules/:ruleId');
console.log('  - POST /api/rules/:ruleId/toggle');
console.log('  - GET /api/rules/stats');

// Start server with automatic port cleanup
(async () => {
  try {
    console.log(`\n🔧 Ensuring port ${PORT} is available...`);
    
    // First cleanup attempt
    await killProcessOnPort(PORT);
    
    // Wait for port to be truly available
    let portReady = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await waitForPortAvailable(PORT, 5, 300);
        portReady = true;
        break;
      } catch (err) {
        if (attempt < 4) {
          console.log(`⏱️  Retry attempt ${attempt + 1}/4...`);
          await killProcessOnPort(PORT);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    
    if (!portReady) {
      throw new Error(`Port ${PORT} could not be freed after multiple attempts`);
    }
    
    // Now start the server - listen only on localhost/127.0.0.1
    app.listen(PORT, 'localhost', () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Elasticsearch connected to: ${ES_NODE}\n`);
    });
  } catch (error) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
})();
