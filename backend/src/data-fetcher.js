/**
 * RULE-BASED AI SEARCH INTELLIGENCE ENGINE
 * Data Fetcher - Elasticsearch Integration
 * 
 * Aggregates search analytics data from Elasticsearch
 * Calculates derived metrics
 */

/**
 * Data Fetcher for Elasticsearch
 * Queries search analytics index and aggregates metrics
 */
export class DataFetcher {
  constructor(esClient, config = {}) {
    this.esClient = esClient;
    this.indexName = config.indexName || 'search_analytics';
    this.dateRangeGte = config.dateRangeGte || 'now-7d'; // Last 7 days by default
    this.dateRangeFormat = config.dateRangeFormat || 'now-30d'; // Customizable range
    this.timeout = config.timeout || 30000; // 30 seconds
    this.stats = {
      queries_fetched: 0,
      aggregation_time: 0,
      elasticsearch_calls: 0,
      errors: 0,
    };
  }

  /**
   * Main method: Aggregate all search analytics data
   * Returns array of query-level metrics with derived calculations
   */
  async fetchAggregatedAnalytics(options = {}) {
    console.log(`\n📊 DATA FETCHER: Fetching from Elasticsearch index "${this.indexName}"`);
    const startTime = Date.now();

    try {
      // Build Elasticsearch aggregation query
      const query = this.buildAggregationQuery(options);

      console.log(`🔍 Query range: ${options.dateRangeGte || this.dateRangeGte}`);

      this.stats.elasticsearch_calls++;

      // Execute query with timeout
      const response = await Promise.race([
        this.esClient.search(query),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Elasticsearch query timeout')), this.timeout)
        ),
      ]);

      // Extract and process buckets
      const aggregations = response.aggregations?.queries_by_name?.buckets || [];
      console.log(`✅ Fetched ${aggregations.length} unique queries`);

      // Transform raw aggregations into normalized metrics
      const analyticsData = this.transformAggregations(aggregations);

      this.stats.queries_fetched = analyticsData.length;
      this.stats.aggregation_time = Date.now() - startTime;

      console.log(`⏱️  Processing time: ${this.stats.aggregation_time}ms`);

      return analyticsData;
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Data Fetcher Error:', error.message);
      
      // Log detailed error info for debugging
      if (error.body?.error) {
        console.error('   Elasticsearch Error:', error.body.error);
      } else if (error.stack) {
        console.error('   Stack:', error.stack);
      }
      
      // Return mock analytics data as fallback for resilience
      console.warn('⚠️  Returning fallback analytics data');
      return this.getMockAnalyticsData();
    }
  }

  /**
   * Build Elasticsearch aggregation query
   * Aggregates metrics at the query level
   */
  buildAggregationQuery(options = {}) {
    const dateRange = options.dateRangeGte || this.dateRangeGte;
    const minSearchVolume = options.minSearchVolume || 1;

    return {
      index: this.indexName,
      size: 0, // Don't return individual documents, only aggregations
      query: {
        bool: {
          must: [
            {
              // Minimum search volume filter
              range: {
                total_searches: {
                  gte: minSearchVolume,
                },
              },
            },
          ],
          // Exclude empty queries
          must_not: [
            { term: { query: '' } },
          ],
          // Require query field to exist
          filter: [
            { exists: { field: 'query' } },
          ],
        },
      },
      aggs: {
        // Group by query term
        queries_by_name: {
          terms: {
            field: 'query.keyword', // Use keyword subfield for aggregation (text fields need .keyword)
            size: 500, // Get top 500 queries
            min_doc_count: 1,
            order: { _count: 'desc' }, // Sort by frequency
          },
          aggs: {
            // Calculate metrics for each query
            total_searches: {
              sum: { field: 'total_searches' },
            },
            total_clicks: {
              sum: { field: 'clicks' },
            },
            total_zero_results: {
              sum: { field: 'zero_result_count' },
            },
            avg_position: {
              avg: { field: 'avg_click_position' },
            },
            avg_refinement_rate: {
              avg: { field: 'refinement_rate' },
            },
            avg_results_count: {
              avg: { field: 'results_count_avg' },
            },
            avg_scroll_depth: {
              avg: { field: 'scroll_depth' },
            },
            avg_time_spent: {
              avg: { field: 'avg_time_spent' },
            },
            // Percentile analysis
            position_percentiles: {
              percentiles: { field: 'avg_click_position', percents: [25, 50, 75, 95] },
            },
            // Distribution analysis
            ctr_histogram: {
              histogram: { field: 'ctr', interval: 0.1 },
            },
          },
        },
      },
    };
  }

  /**
   * Transform raw Elasticsearch aggregations into normalized metrics
   */
  transformAggregations(buckets) {
    const analyticsData = [];

    for (const bucket of buckets) {
      const query = bucket.key; // The query term
      const totalSearches = Math.round(bucket.total_searches?.value || 0);
      const totalClicks = Math.round(bucket.total_clicks?.value || 0);
      const totalZeroResults = Math.round(bucket.total_zero_results?.value || 0);

      // Calculate derived metrics
      const ctr = totalSearches > 0 ? totalClicks / totalSearches : 0; // 0-1 scale
      const zeroResultRate = totalSearches > 0 ? totalZeroResults / totalSearches : 0;

      // Handle missing metrics gracefully
      const avgClickPosition = bucket.avg_position?.value || 0;
      const refinementRate = bucket.avg_refinement_rate?.value || 0;
      const avgResultsCount = Math.round(bucket.avg_results_count?.value || 0);
      const scrollDepth = bucket.avg_scroll_depth?.value || 0;
      const avgTimeSpent = bucket.avg_time_spent?.value || 0;

      analyticsData.push({
        query,
        total_searches: totalSearches,
        clicks: totalClicks,
        ctr, // 0-1 scale (will be converted to percentage in rule engine)
        zero_result_count: totalZeroResults,
        zero_result_rate: zeroResultRate,
        avg_click_position: avgClickPosition,
        refinement_rate: refinementRate, // 0-1 scale
        results_count_avg: avgResultsCount,
        scroll_depth: scrollDepth, // 0-1 scale
        avg_time_spent: avgTimeSpent,
        doc_count: bucket.doc_count,
      });
    }

    console.log(`📈 Transformed ${analyticsData.length} query records`);
    return analyticsData;
  }

  /**
   * Fetch trending queries (increasing search volume)
   */
  async fetchTrendingQueries(comparisonDays = 7) {
    console.log(`\n📈 TRENDING QUERIES: Comparing last ${comparisonDays} days`);

    const query = {
      index: this.indexName,
      size: 0,
      query: {
        range: {
          timestamp: {
            gte: `now-${comparisonDays * 2}d`,
            lte: 'now',
          },
        },
      },
      aggs: {
        // Split data into two time periods
        current_period: {
          filter: {
            range: {
              timestamp: {
                gte: `now-${comparisonDays}d`,
              },
            },
          },
          aggs: {
            queries: {
              terms: {
                field: 'query.keyword',
                size: 100,
              },
              aggs: {
                search_count: { sum: { field: 'total_searches' } },
              },
            },
          },
        },
        previous_period: {
          filter: {
            range: {
              timestamp: {
                lte: `now-${comparisonDays}d`,
              },
            },
          },
          aggs: {
            queries: {
              terms: {
                field: 'query.keyword',
                size: 100,
              },
              aggs: {
                search_count: { sum: { field: 'total_searches' } },
              },
            },
          },
        },
      },
    };

    try {
      const response = await this.esClient.search(query);
      return this.analyzeTrendingData(response.aggregations);
    } catch (error) {
      console.error('Error fetching trending queries:', error.message);
      return [];
    }
  }

  /**
   * Analyze trending data
   */
  analyzeTrendingData(aggs) {
    const currentQueries = {};
    const previousQueries = {};

    // Build maps of current period
    for (const bucket of aggs.current_period?.queries?.buckets || []) {
      currentQueries[bucket.key] = bucket.search_count?.value || 0;
    }

    // Build maps of previous period
    for (const bucket of aggs.previous_period?.queries?.buckets || []) {
      previousQueries[bucket.key] = bucket.search_count?.value || 0;
    }

    // Calculate growth rates
    const trends = [];
    for (const query in currentQueries) {
      const currentSearches = currentQueries[query];
      const previousSearches = previousQueries[query] || 0;

      const growthRate =
        previousSearches > 0 
          ? ((currentSearches - previousSearches) / previousSearches) * 100
          : currentSearches > 0 ? 100 : 0;

      trends.push({
        query,
        current_searches: currentSearches,
        previous_searches: previousSearches,
        growth_rate: growthRate.toFixed(1),
        trend: growthRate > 10 ? '📈 Rising' : growthRate < -10 ? '📉 Declining' : '➡️ Stable',
      });
    }

    return trends.sort((a, b) => parseFloat(b.growth_rate) - parseFloat(a.growth_rate));
  }

  /**
   * Fetch zero result queries specifically
   */
  async fetchZeroResultQueries() {
    console.log('\n🔴 ZERO RESULT QUERIES: Fetching...');

    const query = {
      index: this.indexName,
      size: 0,
      query: {
        bool: {
          must: [
            { range: { zero_result_count: { gt: 0 } } },
            { range: { timestamp: { gte: this.dateRangeGte } } },
          ],
        },
      },
      aggs: {
        zero_result_queries: {
          terms: {
            field: 'query.keyword',
            size: 100,
          },
          aggs: {
            search_count: { sum: { field: 'total_searches' } },
            zero_count: { sum: { field: 'zero_result_count' } },
          },
        },
      },
    };

    try {
      const response = await this.esClient.search(query);
      const buckets = response.aggregations?.zero_result_queries?.buckets || [];

      return buckets.map(b => ({
        query: b.key,
        total_searches: Math.round(b.search_count?.value || 0),
        zero_results: Math.round(b.zero_count?.value || 0),
        zero_result_percentage: (((b.zero_count?.value || 0) / (b.search_count?.value || 1)) * 100).toFixed(1),
      })).sort((a, b) => b.zero_results - a.zero_results);
    } catch (error) {
      console.error('Error fetching zero result queries:', error.message);
      return [];
    }
  }

  /**
   * Get fetcher statistics
   */
  getStats() {
    return this.stats;
  }

  /**
   * Mock data for development/testing
   */
  getMockAnalyticsData() {
    return [
      {
        query: "blue leather backpack",
        total_searches: 87,
        clicks: 31,
        ctr: 0.356,
        zero_result_count: 0,
        avg_click_position: 2.1,
        refinement_rate: 0.138,
        results_count_avg: 42,
        scroll_depth: 0.65,
        avg_time_spent: 12,
      },
      {
        query: "red shoes under 2000",
        total_searches: 156,
        clicks: 18,
        ctr: 0.115,
        zero_result_count: 0,
        avg_click_position: 4.7,
        refinement_rate: 0.263,
        results_count_avg: 38,
        scroll_depth: 0.42,
        avg_time_spent: 8,
      },
      {
        query: "waterproof travel bags",
        total_searches: 45,
        clicks: 0,
        ctr: 0,
        zero_result_count: 45,
        avg_click_position: 0,
        refinement_rate: 0.178,
        results_count_avg: 0,
        scroll_depth: 0,
        avg_time_spent: 0,
      },
      {
        query: "work from home office chairs",
        total_searches: 112,
        clicks: 3,
        ctr: 0.027,
        zero_result_count: 0,
        avg_click_position: 7.3,
        refinement_rate: 0.304,
        results_count_avg: 45,
        scroll_depth: 0.15,
        avg_time_spent: 3,
      },
      {
        query: "smartwatch fitness tracker",
        total_searches: 234,
        clicks: 156,
        ctr: 0.667,
        zero_result_count: 0,
        avg_click_position: 1.2,
        refinement_rate: 0.009,
        results_count_avg: 298,
        scroll_depth: 0.85,
        avg_time_spent: 25,
      },
    ];
  }
}

/**
 * Utility: Create data fetcher with ES client
 */
export function createDataFetcher(esClient, config = {}) {
  return new DataFetcher(esClient, config);
}
