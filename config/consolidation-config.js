// config/consolidation-config.js

/**
 * Configuration settings for consolidation service
 */
module.exports = {
  // Default similarity threshold
  CONSOLIDATION_THRESHOLD: process.env.CONSOLIDATION_THRESHOLD || 0.8,
  
  // Batch size for processing
  CONSOLIDATION_BATCH_SIZE: parseInt(process.env.CONSOLIDATION_BATCH_SIZE || 1000, 10),
  
  // Whether to use advanced algorithm for large datasets
  USE_ADVANCED_ALGORITHM: process.env.USE_ADVANCED_ALGORITHM === 'true',
  
  // Whether to enable performance monitoring
  ENABLE_PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  
  // Monitoring interval in milliseconds
  MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL || 30000, 10),
  
  // Batch size thresholds
  BATCH_SIZE: {
    SMALL: 250,   // For memory-constrained environments
    MEDIUM: 1000, // Default
    LARGE: 2000   // For high-performance environments
  },
  
  // Dataset size thresholds
  DATASET_SIZE: {
    SMALL: 5000,  // Use standard algorithm below this threshold
    LARGE: 10000  // Use optimized batching above this threshold
  },
  
  // Algorithm selection based on tag count
  getRecommendedSettings(tagCount) {
    if (tagCount < this.DATASET_SIZE.SMALL) {
      return {
        threshold: 0.8,
        batchSize: this.BATCH_SIZE.MEDIUM,
        useAdvancedAlgorithm: false
      };
    } else if (tagCount < this.DATASET_SIZE.LARGE) {
      return {
        threshold: 0.75,
        batchSize: this.BATCH_SIZE.MEDIUM,
        useAdvancedAlgorithm: true
      };
    } else {
      return {
        threshold: 0.75,
        batchSize: this.BATCH_SIZE.LARGE,
        useAdvancedAlgorithm: true
      };
    }
  }
};
