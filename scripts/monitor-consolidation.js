// scripts/monitor-consolidation.js
const consolidationService = require('../services/consolidationService');

/**
 * Monitor performance of the consolidation service
 */
function monitorPerformance() {
  const stats = consolidationService.getPerformanceStats();
  console.log(`Memory: ${stats.memoryUsage.toFixed(2)}MB, Cache hits: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
}

/**
 * Run the consolidation process with monitoring
 */
async function runConsolidationWithMonitoring(threshold = 0.8, useAdvancedAlgorithm = true) {
  console.log(`Starting consolidation with threshold ${threshold} and ${useAdvancedAlgorithm ? 'advanced' : 'standard'} algorithm...`);
  
  // Set up monitoring interval
  const monitorInterval = setInterval(monitorPerformance, 30000); // Every 30 seconds
  
  try {
    // Run the optimized consolidation process
    const results = await consolidationService.processAndMergeTagsOptimized(
      threshold,
      useAdvancedAlgorithm
    );
    
    // Output final results
    console.log('\n===== Consolidation Complete =====');
    console.log(`Merged ${results.mergeCount} tags`);
    console.log(`Final memory usage: ${results.stats.memoryUsage.toFixed(2)}MB`);
    console.log(`Final cache hit rate: ${(results.stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Total comparisons: ${results.stats.comparisons}`);
    console.log(`Elapsed time: ${results.stats.elapsedTime} seconds`);
    
    if (results.mergeDetails.length > 0) {
      console.log('\nMerge Details:');
      results.mergeDetails.forEach((detail, index) => {
        console.log(`${index + 1}. ${detail}`);
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error during consolidation:', error);
    return { error: error.message };
  } finally {
    // Clean up monitoring interval
    clearInterval(monitorInterval);
  }
}

// If script is run directly
if (require.main === module) {
  // Get command line arguments for threshold and algorithm choice
  const args = process.argv.slice(2);
  const threshold = parseFloat(args[0]) || 0.8;
  const useAdvancedAlgorithm = args[1] === 'true' || args[1] === '1';
  
  runConsolidationWithMonitoring(threshold, useAdvancedAlgorithm)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = {
    runConsolidationWithMonitoring
  };
}
