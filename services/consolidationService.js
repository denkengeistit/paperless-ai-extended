// services/consolidationService.js
const paperlessService = require('./paperlessService');
const config = require('../config/config');

class ConsolidationService {
  constructor() {
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
  async findSimilarTags(similarityThreshold = 0.7) {
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
  async findSimilarCorrespondents(similarityThreshold = 0.7) {
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
  async findSimilarDocumentTypes(similarityThreshold = 0.7) {
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
}

module.exports = new ConsolidationService();
