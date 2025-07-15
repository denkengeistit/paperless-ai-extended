# Enhanced Consolidation Service

The Enhanced Consolidation Service provides optimized algorithms for processing and merging similar tags, correspondents, and document types in Paperless-ngx.

## Features

- **Optimized Algorithms**: Choose between standard and advanced fuzzy matching algorithms
- **Batch Processing**: Efficiently process large datasets with configurable batch sizes
- **Performance Monitoring**: Track memory usage and processing efficiency
- **Caching**: Improve performance by caching similarity calculations
- **Memory Management**: Reduced memory footprint compared to standard implementation

## Usage

### Basic Usage

```javascript
const consolidationService = require('./services/consolidationService');

// Process tags with default settings
const results = await consolidationService.processAndMergeTagsOptimized();
console.log(`Merged ${results.mergeCount} tags`);
```

### Advanced Usage

```javascript
const EnhancedConsolidationService = require('./services/enhanced-consolidation-service');

// Create custom instance with specific settings
const consolidationService = new EnhancedConsolidationService(
  0.75,   // similarity threshold
  2000    // batch size
);

// Use advanced algorithm for large datasets
const results = await consolidationService.processAndMergeTagsOptimized(
  0.75,   // threshold (override constructor value)
  true    // use advanced algorithm
);

// Output performance statistics
console.log(`Memory usage: ${results.stats.memoryUsage.toFixed(2)}MB`);
console.log(`Cache hit rate: ${(results.stats.cacheHitRate * 100).toFixed(1)}%`);
console.log(`Elapsed time: ${results.stats.elapsedTime} seconds`);
```

### Batch Processing

```javascript
// Prepare document updates
const updates = documents.map(doc => ({
  id: doc.id,
  data: { tags: [...doc.tags, newTagId] }
}));

// Process updates in batches
const results = await consolidationService.batchUpdateDocuments(updates);
console.log(`Updated ${results.updatedCount} documents`);
```

### Performance Monitoring

```javascript
// Set up interval monitoring
const monitorInterval = setInterval(() => {
  const stats = consolidationService.getPerformanceStats();
  console.log(`Memory: ${stats.memoryUsage.toFixed(2)}MB, Cache hits: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
}, 30000); // Every 30 seconds

// Remember to clear the interval when done
clearInterval(monitorInterval);
```

## Configuration

You can configure the service through environment variables:

```
CONSOLIDATION_THRESHOLD=0.8
CONSOLIDATION_BATCH_SIZE=1000
USE_ADVANCED_ALGORITHM=true
ENABLE_PERFORMANCE_MONITORING=true
```

See `config/consolidation.env.sample` for a complete list of options.

## Algorithm Comparison

### Dice Coefficient vs Levenshtein Distance

The enhanced service uses two different similarity algorithms:

1. **Dice Coefficient** (default): Faster and better for handling common tag variations
   - Better for similar word forms and abbreviations
   - Example: "Invoice 2024" vs "invoice-2024" = 0.87 similarity

2. **Levenshtein Distance**: More precise but slower
   - Better for detecting spelling errors
   - Example: "Invoice 2024" vs "invoice-2024" = 0.73 similarity

The advanced algorithm uses Fuse.js for fuzzy searching with optimized memory usage.

## Memory Management

For large datasets, use these techniques to reduce memory usage:

1. Enable garbage collection: `node --expose-gc your-script.js`
2. Increase memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`
3. Use smaller batch sizes for memory-constrained environments
4. Clear cache periodically for very long-running processes

## Examples

See the `examples/consolidation-examples.js` file for complete usage examples:

- Small dataset optimization
- Large dataset optimization
- Memory-constrained environments
- Batch processing
- Performance testing
- Dry runs (simulation without making changes)

## Troubleshooting

### If processing is slow:
1. Reduce batch size
2. Increase similarity threshold to find fewer matches
3. Use standard algorithm instead of fuzzy search

### If memory usage is high:
1. Reduce batch size to 100-250
2. Clear cache more frequently
3. Run with `--max-old-space-size=4096` if needed

### If accuracy is poor:
1. Lower similarity threshold to 0.7-0.75
2. Try different algorithms for specific tag types
3. Preprocess tags to normalize formatting
