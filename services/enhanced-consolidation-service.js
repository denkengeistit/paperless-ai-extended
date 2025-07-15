// services/enhanced-consolidation-service.js
const paperlessService = require('./paperlessService');
const config = require('../config/config');
const stringSimilarity = require('string-similarity');
const Fuse = require('fuse.js');

/**
 * Enhanced Consolidation Service with optimized algorithms for large datasets
 */
class EnhancedConsolidationService {
  /**
   * Initialize the enhanced consolidation service
   * @param {number} similarityThreshold - Default similarity threshold (0-1)
   * @param {number} batchSize - Size of batches for processing
   */
  constructor(similarityThreshold = 0.8, batchSize = 1000) {
    this.similarityThreshold = similarityThreshold;
    this.batchSize = batchSize;
    this.cache = new Map();
    this.performanceStats = {
      startTime: null,
      endTime: null,
      memoryUsage: 0,
      cacheHits: 0,
      cacheAttempts: 0,
      comparisons: 0
    };
    this.initialize();
  }

  /**
   * Initialize with paperless service
   */
  initialize() {
    // Initialize with paperless service
  }

  /**
   * Reset performance stats
   */
  resetPerformance() {
    this.performanceStats = {
      startTime: null,
      endTime: null,
      memoryUsage: 0,
      cacheHits: 0,
      cacheAttempts: 0,
      comparisons: 0
    };
    this.cache.clear();
  }

  /**
   * Get current performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const cacheHitRate = this.performanceStats.cacheAttempts > 0 
      ? this.performanceStats.cacheHits / this.performanceStats.cacheAttempts 
      : 0;
    
    return {
      memoryUsage,
      cacheHitRate,
      comparisons: this.performanceStats.comparisons,
      elapsedTime: this.performanceStats.endTime && this.performanceStats.startTime 
        ? (this.performanceStats.endTime - this.performanceStats.startTime) / 1000 
        : null
    };
  }

  /**
   * Calculate cache key for two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {string} Cache key
   */
  getCacheKey(str1, str2) {
    // Ensure consistent ordering for cache keys
    return [str1, str2].sort().join('::');
  }

  /**
   * Calculate similarity between two strings using Dice coefficient
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateDiceCoefficient(str1, str2) {
    this.performanceStats.comparisons++;
    
    // Check cache first
    this.performanceStats.cacheAttempts++;
    const cacheKey = this.getCacheKey(str1, str2);
    
    if (this.cache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.cache.get(cacheKey);
    }
    
    // Calculate dice coefficient using string-similarity
    const similarity = stringSimilarity.compareTwoStrings(str1, str2);
    
    // Cache the result
    this.cache.set(cacheKey, similarity);
    
    return similarity;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateLevenshteinSimilarity(str1, str2) {
    this.performanceStats.comparisons++;
    
    // Check cache first
    this.performanceStats.cacheAttempts++;
    const cacheKey = this.getCacheKey(str1, str2);
    
    if (this.cache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.cache.get(cacheKey);
    }
    
    const longerLength = Math.max(str1.length, str2.length);
    if (longerLength === 0) return 1.0;
    
    const levenshteinDistance = this.levenshteinDistance(str1, str2);
    const similarity = (longerLength - levenshteinDistance) / longerLength;
    
    // Cache the result
    this.cache.set(cacheKey, similarity);
    
    return similarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return track[str2.length][str1.length];
  }

  /**
   * Find similar tags based on name similarity
   * @param {number} similarityThreshold - Threshold for similarity (0-1)
   * @returns {Promise<Array>} - Array of similar tag groups
   */
  async findSimilarTags(similarityThreshold = this.similarityThreshold) {
    try {
      const tags = await paperlessService.getTags();
      return this.findSimilarEntities(tags, similarityThreshold);
    } catch (error) {
      console.error('[ERROR] finding similar tags:', error.message);
      return [];
    }
  }

  /**
   * Find similar correspondents based on name similarity
   * @param {number} similarityThreshold - Threshold for similarity (0-1)
   * @returns {Promise<Array>} - Array of similar correspondent groups
   */
  async findSimilarCorrespondents(similarityThreshold = this.similarityThreshold) {
    try {
      const correspondents = await paperlessService.listCorrespondentsNames();
      return this.findSimilarEntities(correspondents, similarityThreshold);
    } catch (error) {
      console.error('[ERROR] finding similar correspondents:', error.message);
      return [];
    }
  }

  /**
   * Find similar document types based on name similarity
   * @param {number} similarityThreshold - Threshold for similarity (0-1)
   * @returns {Promise<Array>} - Array of similar document type groups
   */
  async findSimilarDocumentTypes(similarityThreshold = this.similarityThreshold) {
    try {
      // Fetch document types
      const response = await paperlessService.client.get('/document_types/');
      const documentTypes = response.data.results;
      return this.findSimilarEntities(documentTypes, similarityThreshold);
    } catch (error) {
      console.error('[ERROR] finding similar document types:', error.message);
      return [];
    }
  }

  /**
   * Find similar entities using standard comparison algorithm
   * @param {Array} entities - Array of entities to compare
   * @param {number} similarityThreshold - Threshold for similarity (0-1)
   * @returns {Array} - Array of similar entity groups
   */
  findSimilarEntities(entities, similarityThreshold) {
    const similarGroups = [];
    const processedIndices = new Set();

    for (let i = 0; i < entities.length; i++) {
      if (processedIndices.has(i)) continue;

      const currentEntity = entities[i];
      const similarEntities = [currentEntity];
      processedIndices.add(i);

      for (let j = i + 1; j < entities.length; j++) {
        if (processedIndices.has(j)) continue;

        const targetEntity = entities[j];
        const similarity = this.calculateDiceCoefficient(
          currentEntity.name.toLowerCase(),
          targetEntity.name.toLowerCase()
        );

        if (similarity >= similarityThreshold) {
          similarEntities.push(targetEntity);
          processedIndices.add(j);
        }
      }

      if (similarEntities.length > 1) {
        similarGroups.push(similarEntities);
      }
    }

    return similarGroups;
  }

  /**
   * Find similar entities using optimized algorithm with multiple similarity methods
   * @param {Array} entities - Array of entities to compare
   * @param {number} similarityThreshold - Threshold for similarity (0-1)
   * @param {boolean} useAdvancedAlgorithm - Whether to use fuzzy search for large datasets
   * @returns {Array} - Array of similar entity groups
   */
  findSimilarEntitiesOptimized(entities, similarityThreshold, useAdvancedAlgorithm = false) {
    if (!entities || entities.length === 0) {
      return [];
    }

    // For small datasets or when specified, use standard algorithm with Dice coefficient
    if (!useAdvancedAlgorithm || entities.length < 5000) {
      return this.findSimilarEntities(entities, similarityThreshold);
    }

    // For large datasets, use Fuse.js for fuzzy searching
    const similarGroups = [];
    const processedIndices = new Set();
    
    // Configure Fuse.js options
    const fuseOptions = {
      keys: ['name'],
      includeScore: true,
      threshold: 1.0 - similarityThreshold, // Convert similarity to distance
      location: 0,
      distance: 100,
      minMatchCharLength: 2
    };
    
    // Process entities in batches to reduce memory usage
    for (let batchStart = 0; batchStart < entities.length; batchStart += this.batchSize) {
      // Cleanup memory every batch if possible
      if (global.gc && batchStart > 0) {
        global.gc();
      }
      
      const batchEnd = Math.min(batchStart + this.batchSize, entities.length);
      const batchEntities = entities.slice(batchStart, batchEnd);
      
      for (let i = 0; i < batchEntities.length; i++) {
        const globalIndex = batchStart + i;
        if (processedIndices.has(globalIndex)) continue;
        
        const currentEntity = batchEntities[i];
        const currentName = currentEntity.name.toLowerCase();
        const similarEntities = [currentEntity];
        processedIndices.add(globalIndex);
        
        // Create a Fuse instance for the current batch excluding the current entity
        const fuse = new Fuse(
          entities.filter((_, idx) => idx !== globalIndex && !processedIndices.has(idx)),
          fuseOptions
        );
        
        // Search for similar entities
        const results = fuse.search(currentName);
        
        for (const result of results) {
          if (result.score <= (1.0 - similarityThreshold)) {
            const targetEntity = result.item;
            const targetIndex = entities.findIndex(e => e.id === targetEntity.id);
            
            if (targetIndex !== -1 && !processedIndices.has(targetIndex)) {
              similarEntities.push(targetEntity);
              processedIndices.add(targetIndex);
            }
          }
        }
        
        if (similarEntities.length > 1) {
          similarGroups.push(similarEntities);
        }
      }
    }
    
    return similarGroups;
  }

  /**
   * Sort groups by total document count in descending order
   * @param {Array} groups - List of tag groups
   * @returns {Array} Sorted list of tag groups
   */
  sortGroupsByDocCount(groups) {
    return groups.sort((a, b) => {
      const countA = a.reduce((sum, tag) => sum + (tag.document_count || 0), 0);
      const countB = b.reduce((sum, tag) => sum + (tag.document_count || 0), 0);
      return countB - countA;
    });
  }

  /**
   * Merge source tags into target tag
   * @param {number} targetTagId - ID of the tag to merge into
   * @param {Array<number>} sourceTagIds - List of tag IDs to merge from
   * @returns {Promise<boolean>} Success status
   */
  async mergeTags(targetTagId, sourceTagIds) {
    try {
      const documents = new Map();
      
      // Collect all documents that need to be updated
      for (const sourceId of sourceTagIds) {
        const response = await paperlessService.getDocuments({ tags__id: sourceId });
        
        for (const doc of response.results) {
          if (!documents.has(doc.id)) {
            documents.set(doc.id, [...doc.tags]);
          }
        }
      }
      
      // Batch update documents
      const updates = [];
      for (const [docId, tags] of documents.entries()) {
        // Filter out source tags and add target tag
        const newTags = [...new Set([
          ...tags.filter(id => !sourceTagIds.includes(id)),
          targetTagId
        ])];
        
        updates.push({
          id: docId,
          tags: newTags
        });
      }
      
      // Process updates in batches
      for (let i = 0; i < updates.length; i += this.batchSize) {
        const batch = updates.slice(i, i + this.batchSize);
        
        // Process each update in the batch
        for (const update of batch) {
          await paperlessService.updateDocument(update.id, { tags: update.tags });
        }
      }
      
      // Delete source tags
      for (const sourceId of sourceTagIds) {
        await paperlessService.deleteTag(sourceId);
      }
      
      return true;
    } catch (error) {
      console.error('Error during tag merge:', error);
      return false;
    }
  }

  /**
   * Batch update documents
   * @param {Array} updates - Array of document updates {id, data}
   * @returns {Promise<{success: boolean, updatedCount: number, errors: Array}>}
   */
  async batchUpdateDocuments(updates) {
    const results = {
      success: true,
      updatedCount: 0,
      errors: []
    };
    
    // Process updates in batches
    for (let i = 0; i < updates.length; i += this.batchSize) {
      const batch = updates.slice(i, i + this.batchSize);
      
      // Process each update in the batch
      for (const update of batch) {
        try {
          await paperlessService.updateDocument(update.id, update.data);
          results.updatedCount++;
        } catch (error) {
          results.success = false;
          results.errors.push({
            documentId: update.id,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Main function to process all tags and perform merging with optimized algorithm
   * @param {number} threshold - Similarity threshold (0-1)
   * @param {boolean} useAdvancedAlgorithm - Whether to use advanced algorithm for large datasets
   * @returns {Promise<{mergeCount: number, mergeDetails: Array<string>, stats: Object}>}
   */
  async processAndMergeTagsOptimized(threshold = this.similarityThreshold, useAdvancedAlgorithm = false) {
    try {
      // Start performance tracking
      this.performanceStats.startTime = Date.now();
      this.resetPerformance();
      
      // Use the provided threshold or fall back to instance default
      const similarityThreshold = threshold !== undefined ? threshold : this.similarityThreshold;
      
      const tagsResponse = await paperlessService.getTags();
      const tags = tagsResponse;

      console.log(`[DEBUG] Processing ${tags.length} tags with threshold ${similarityThreshold}`);
      console.log(`[DEBUG] Using ${useAdvancedAlgorithm ? 'advanced' : 'standard'} algorithm`);
      
      // Find similar tags using optimized algorithm
      const groups = this.findSimilarEntitiesOptimized(tags, similarityThreshold, useAdvancedAlgorithm);
      const sortedGroups = this.sortGroupsByDocCount(groups);

      console.log(`[DEBUG] Found ${groups.length} groups of similar tags`);
      
      let mergeCount = 0;
      const mergeDetails = [];

      // Process each group in batches
      for (let i = 0; i < sortedGroups.length; i += Math.ceil(sortedGroups.length / 10)) {
        const batchGroups = sortedGroups.slice(i, i + Math.ceil(sortedGroups.length / 10));
        
        for (const group of batchGroups) {
          if (group.length > 1) {
            // Select target tag based on document count
            const targetTag = group.reduce((max, tag) => 
              (tag.document_count || 0) > (max.document_count || 0) ? tag : max
            , group[0]);
            
            const sourceTags = group.filter(tag => tag.id !== targetTag.id);
            
            const success = await this.mergeTags(
              targetTag.id,
              sourceTags.map(tag => tag.id)
            );

            if (success) {
              mergeCount += sourceTags.length;
              mergeDetails.push(
                `Merged tags ${sourceTags.map(t => t.name).join(', ')} into ${targetTag.name}`
              );
            }
          }
        }
        
        // Clean up memory if possible
        if (global.gc) {
          global.gc();
        }
      }
      
      // End performance tracking
      this.performanceStats.endTime = Date.now();
      const stats = this.getPerformanceStats();
      
      console.log(`[DEBUG] Completed tag processing in ${stats.elapsedTime} seconds`);
      console.log(`[DEBUG] Memory usage: ${stats.memoryUsage.toFixed(2)}MB`);
      console.log(`[DEBUG] Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
      
      return { 
        mergeCount, 
        mergeDetails,
        stats
      };
    } catch (error) {
      console.error('[ERROR] processing and merging tags:', error.message);
      return { 
        mergeCount: 0, 
        mergeDetails: [], 
        error: error.message,
        stats: this.getPerformanceStats()
      };
    }
  }
}

/**
 * Main function to process all tags and perform merging
 * @param {number} [threshold] - Optional similarity threshold override
 * @returns {Promise<{mergeCount: number, mergeDetails: Array<string>}>}
 */
EnhancedConsolidationService.prototype.processAndMergeTags = function(threshold) {
  // This ensures backward compatibility with the original consolidation service
  return this.processAndMergeTagsOptimized(threshold, false);
};

module.exports = EnhancedConsolidationService;
