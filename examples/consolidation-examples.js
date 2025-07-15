// examples/consolidation-examples.js
const EnhancedConsolidationService = require('../services/enhanced-consolidation-service');
const BatchProcessor = require('../utils/batch-processor');
const paperlessService = require('../services/paperlessService');

// Example configurations for different dataset sizes

/**
 * Example for small datasets (< 5,000 tags)
 */
async function smallDatasetExample() {
  console.log('Running small dataset example...');
  
  const consolidationService = new EnhancedConsolidationService(
    0.8,    // similarity threshold
    500     // smaller batch size
  );

  // Use standard algorithm
  const results = await consolidationService.processAndMergeTagsOptimized(0.8, false);
  
  console.log(`Processed ${results.mergeCount} tags in ${results.stats.elapsedTime} seconds`);
  console.log(`Memory usage: ${results.stats.memoryUsage.toFixed(2)}MB`);
  
  return results;
}

/**
 * Example for large datasets (> 5,000 tags)
 */
async function largeDatasetExample() {
  console.log('Running large dataset example...');
  
  const consolidationService = new EnhancedConsolidationService(
    0.75,   // slightly lower threshold for more matches
    2000    // larger batch size for efficiency  
  );

  // Use advanced fuzzy algorithm
  const results = await consolidationService.processAndMergeTagsOptimized(0.75, true);
  
  console.log(`Processed ${results.mergeCount} tags in ${results.stats.elapsedTime} seconds`);
  console.log(`Memory usage: ${results.stats.memoryUsage.toFixed(2)}MB`);
  
  return results;
}

/**
 * Example for memory-constrained environments
 */
async function memoryConstrainedExample() {
  console.log('Running memory-constrained example...');
  
  const consolidationService = new EnhancedConsolidationService(
    0.8,    
    250     // very small batches to minimize memory usage
  );

  // Enable garbage collection if available
  if (global.gc) {
    console.log('Garbage collection available');
    global.gc();
  }

  // Use standard algorithm with small batch size
  const results = await consolidationService.processAndMergeTagsOptimized(0.8, false);
  
  console.log(`Processed ${results.mergeCount} tags in ${results.stats.elapsedTime} seconds`);
  console.log(`Memory usage: ${results.stats.memoryUsage.toFixed(2)}MB`);
  
  return results;
}

/**
 * Example for batch processing document updates
 */
async function batchProcessingExample() {
  console.log('Running batch processing example...');
  
  // Get documents that need to be updated
  const documents = await paperlessService.getAllDocuments();
  console.log(`Found ${documents.length} documents`);
  
  // Create batch processor with batch size of 500
  const batchProcessor = new BatchProcessor(500);
  
  // Prepare updates (example: add a tag to documents)
  const tagId = 123; // Replace with an actual tag ID
  const updates = documents.map(doc => ({ 
    id: doc.id, 
    data: { tags: [...new Set([...doc.tags, tagId])] }
  }));
  
  // Use the consolidation service for batch updates
  const consolidationService = new EnhancedConsolidationService(0.8, 500);
  const results = await consolidationService.batchUpdateDocuments(updates);
  
  console.log(`Updated ${results.updatedCount} documents`);
  console.log(`Errors: ${results.errors.length}`);
  
  return results;
}

/**
 * Performance testing example
 */
async function performanceTestExample() {
  console.log('Running performance test...');
  
  console.time('tag-consolidation');
  
  const consolidationService = new EnhancedConsolidationService(0.8, 1000);
  const results = await consolidationService.processAndMergeTagsOptimized(0.8, true);
  
  console.timeEnd('tag-consolidation');
  console.log('Performance stats:', results.stats);
  
  return results;
}

/**
 * Dry run example - find similar tags without merging
 */
async function dryRunExample() {
  console.log('Running dry run example...');
  
  const consolidationService = new EnhancedConsolidationService(0.8, 1000);
  const tags = await paperlessService.getTags();
  
  // Test similarity detection without making changes
  const groups = consolidationService.findSimilarEntitiesOptimized(tags, 0.8, true);
  console.log(`Found ${groups.length} groups for potential consolidation`);
  
  // Review groups before consolidating
  groups.forEach((group, index) => {
    console.log(`Group ${index + 1}:`, group.map(tag => tag.name));
  });
  
  return groups;
}

// Export examples
module.exports = {
  smallDatasetExample,
  largeDatasetExample,
  memoryConstrainedExample,
  batchProcessingExample,
  performanceTestExample,
  dryRunExample
};

// If script is run directly, execute the examples
if (require.main === module) {
  // Get command line arguments to choose which example to run
  const args = process.argv.slice(2);
  const exampleName = args[0] || 'dryRunExample';
  
  if (module.exports[exampleName]) {
    module.exports[exampleName]()
      .then(results => {
        console.log(`Example ${exampleName} completed successfully`);
        process.exit(0);
      })
      .catch(err => {
        console.error(`Error running example ${exampleName}:`, err);
        process.exit(1);
      });
  } else {
    console.error(`Unknown example: ${exampleName}`);
    console.log('Available examples:');
    Object.keys(module.exports).forEach(example => console.log(`- ${example}`));
    process.exit(1);
  }
}
