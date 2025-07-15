// services/consolidationService.js
const paperlessService = require('./paperlessService');
const config = require('../config/config');

class ConsolidationService {
  constructor(similarityThreshold = 0.8) {
    this.similarityThreshold = similarityThreshold;
    this.initialize();
  }

  initialize() {
    // Initialize with paperless service
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
   * Find similar entities (tags, correspondents, document types) based on name similarity
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
        const similarity = this.calculateSimilarity(
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
   * Calculate similarity between two strings using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longerLength = Math.max(str1.length, str2.length);
    if (longerLength === 0) return 1.0;
    
    return (longerLength - this.levenshteinDistance(str1, str2)) / longerLength;
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
   * Consolidate tags by merging similar tags into a primary tag
   * @param {Object} consolidationData - Data for consolidation {primaryTagId, tagsToMerge}
   * @returns {Promise<Object>} - Result of consolidation
   */
  async consolidateTags(consolidationData) {
    try {
      const { primaryTagId, tagsToMerge } = consolidationData;
      
      // Get primary tag details
      const primaryTag = await paperlessService.getTagNameById(primaryTagId);
      
      // Update documents with the tags to be merged
      const allDocuments = await paperlessService.getAllDocuments();
      const updatedDocuments = [];
      
      for (const document of allDocuments) {
        if (document.tags && document.tags.some(tagId => tagsToMerge.includes(tagId))) {
          // Create new tag array with merged tags replaced by primary
          const newTags = [...new Set([
            ...document.tags.filter(tagId => !tagsToMerge.includes(tagId)),
            primaryTagId
          ])];
          
          // Update document
          await paperlessService.updateDocument(document.id, { tags: newTags });
          updatedDocuments.push(document.id);
        }
      }
      
      return {
        success: true,
        primaryTag,
        mergedTagsCount: tagsToMerge.length,
        updatedDocumentsCount: updatedDocuments.length,
        updatedDocuments
      };
    } catch (error) {
      console.error('[ERROR] consolidating tags:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Consolidate correspondents by merging similar correspondents into a primary correspondent
   * @param {Object} consolidationData - Data for consolidation {primaryCorrespondentId, correspondentsToMerge}
   * @returns {Promise<Object>} - Result of consolidation
   */
  async consolidateCorrespondents(consolidationData) {
    try {
      const { primaryCorrespondentId, correspondentsToMerge } = consolidationData;
      
      // Get primary correspondent details
      const primaryCorrespondent = await paperlessService.getCorrespondentNameById(primaryCorrespondentId);
      
      // Update documents with the correspondents to be merged
      const allDocuments = await paperlessService.getAllDocuments();
      const updatedDocuments = [];
      
      for (const document of allDocuments) {
        if (correspondentsToMerge.includes(document.correspondent)) {
          // Update document correspondent
          await paperlessService.updateDocument(document.id, { correspondent: primaryCorrespondentId });
          updatedDocuments.push(document.id);
        }
      }
      
      return {
        success: true,
        primaryCorrespondent,
        mergedCorrespondentsCount: correspondentsToMerge.length,
        updatedDocumentsCount: updatedDocuments.length,
        updatedDocuments
      };
    } catch (error) {
      console.error('[ERROR] consolidating correspondents:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Consolidate document types by merging similar types into a primary type
   * @param {Object} consolidationData - Data for consolidation {primaryDocumentTypeId, documentTypesToMerge}
   * @returns {Promise<Object>} - Result of consolidation
   */
  async consolidateDocumentTypes(consolidationData) {
    try {
      const { primaryDocumentTypeId, documentTypesToMerge } = consolidationData;
      
      // Update documents with the document types to be merged
      const allDocuments = await paperlessService.getAllDocuments();
      const updatedDocuments = [];
      
      for (const document of allDocuments) {
        if (documentTypesToMerge.includes(document.document_type)) {
          // Update document document_type
          await paperlessService.updateDocument(document.id, { document_type: primaryDocumentTypeId });
          updatedDocuments.push(document.id);
        }
      }
      
      return {
        success: true,
        primaryDocumentTypeId,
        mergedDocumentTypesCount: documentTypesToMerge.length,
        updatedDocumentsCount: updatedDocuments.length,
        updatedDocuments
      };
    } catch (error) {
      console.error('[ERROR] consolidating document types:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
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
      for (const sourceId of sourceTagIds) {
        const documents = await paperlessService.getDocuments({ tags__id: sourceId });
        for (const doc of documents.results) {
          const tags = doc.tags.filter(id => id !== sourceId);
          if (!tags.includes(targetTagId)) {
            tags.push(targetTagId);
          }
          await paperlessService.updateDocument(doc.id, { tags });
        }
        await paperlessService.deleteTag(sourceId);
      }
      return true;
    } catch (error) {
      console.error('Error during tag merge:', error);
      return false;
    }
  }

  /**
   * Main function to process all tags and perform merging
   * @param {number} [threshold] - Optional similarity threshold override
   * @returns {Promise<{mergeCount: number, mergeDetails: Array<string>}>}
   */
  async processAndMergeTags(threshold) {
    try {
      // Use the provided threshold or fall back to instance default
      const similarityThreshold = threshold !== undefined ? threshold : this.similarityThreshold;
      
      const tagsResponse = await paperlessService.getTags();
      const tags = tagsResponse.results;

      const groups = this.findSimilarEntities(tags, similarityThreshold);
      const sortedGroups = this.sortGroupsByDocCount(groups);

      let mergeCount = 0;
      const mergeDetails = [];

      for (const group of sortedGroups) {
        if (group.length > 1) {
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

      return { mergeCount, mergeDetails };
    } catch (error) {
      console.error('[ERROR] processing and merging tags:', error.message);
      return { mergeCount: 0, mergeDetails: [], error: error.message };
    }
  }
}

// Import the enhanced service class
const EnhancedConsolidationService = require('./enhanced-consolidation-service');

// Create and export an instance with standard settings
module.exports = new EnhancedConsolidationService(0.8, 1000);
