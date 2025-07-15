// utils/batch-processor.js
const EnhancedConsolidationService = require('../services/enhanced-consolidation-service');
const consolidationService = new EnhancedConsolidationService(0.8, 1000);

/**
 * Utility for batch processing document updates
 */
class BatchProcessor {
  /**
   * Initialize the batch processor
   * @param {number} batchSize - Size of batches for processing
   */
  constructor(batchSize = 1000) {
    this.batchSize = batchSize;
  }

  /**
   * Process a batch of document updates
   * @param {Array} documents - Array of documents
   * @param {Function} updateFn - Function to create update data for each document
   * @returns {Promise<Object>} - Result of batch update
   */
  async processBatch(documents, updateFn) {
    const updates = documents.map(doc => ({
      id: doc.id,
      data: updateFn(doc)
    }));

    return await consolidationService.batchUpdateDocuments(updates);
  }

  /**
   * Process documents in batches for tag updates
   * @param {Array} documents - Array of documents
   * @param {Array} tags - Array of tag IDs to add
   * @returns {Promise<Object>} - Result of batch update
   */
  async updateDocumentTags(documents, tags) {
    return this.processBatch(documents, doc => ({ tags: [...new Set([...doc.tags, ...tags])] }));
  }

  /**
   * Process documents in batches for correspondent updates
   * @param {Array} documents - Array of documents
   * @param {number} correspondentId - ID of correspondent to set
   * @returns {Promise<Object>} - Result of batch update
   */
  async updateDocumentCorrespondent(documents, correspondentId) {
    return this.processBatch(documents, () => ({ correspondent: correspondentId }));
  }

  /**
   * Process documents in batches for document type updates
   * @param {Array} documents - Array of documents
   * @param {number} documentTypeId - ID of document type to set
   * @returns {Promise<Object>} - Result of batch update
   */
  async updateDocumentType(documents, documentTypeId) {
    return this.processBatch(documents, () => ({ document_type: documentTypeId }));
  }
}

module.exports = BatchProcessor;
