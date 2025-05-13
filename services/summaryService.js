// services/summaryService.js
const paperlessService = require('./paperlessService');
const AIServiceFactory = require('./aiServiceFactory');
const config = require('../config/config');

class SummaryService {
  constructor() {
    this.aiService = null;
  }

  /**
   * Initialize the AI service for generating summaries
   */
  async initialize() {
    try {
      this.aiService = await AIServiceFactory.getAIService();
      return true;
    } catch (error) {
      console.error('[ERROR] initializing SummaryService:', error.message);
      return false;
    }
  }

  /**
   * Generate a summary for a document and save it to Notes in PaperlessNGX
   * @param {number} documentId - ID of the document to summarize
   * @returns {Promise<Object>} - Result of the summary operation
   */
  async generateAndSaveSummary(documentId) {
    try {
      // Initialize if not already initialized
      if (!this.aiService) {
        await this.initialize();
      }

      // Get document content
      const documentContent = await paperlessService.getDocumentContent(documentId);
      if (!documentContent) {
        return {
          success: false,
          error: 'Document content could not be retrieved'
        };
      }

      // Get document details
      const document = await paperlessService.getDocument(documentId);
      if (!document) {
        return {
          success: false,
          error: 'Document details could not be retrieved'
        };
      }

      // Generate summary
      const summary = await this.generateSummary(documentContent, document.title);

      // Save summary to PaperlessNGX Notes
      const result = await this.saveToNotes(documentId, summary);

      return {
        success: true,
        documentId,
        title: document.title,
        summary,
        notesUpdated: result
      };
    } catch (error) {
      console.error(`[ERROR] generating and saving summary for document ${documentId}:`, error.message);
      return {
        success: false,
        documentId,
        error: error.message
      };
    }
  }

  /**
   * Generate a summary for document content
   * @param {string} documentContent - Content of the document to summarize
   * @param {string} documentTitle - Title of the document
   * @returns {Promise<string>} - Generated summary
   */
  async generateSummary(documentContent, documentTitle) {
    try {
      // Prepare prompt for AI
      const prompt = `
Please provide a concise summary of the following document titled "${documentTitle}".
Focus on key information such as dates, amounts, parties involved, and main points.
The summary should be comprehensive while remaining under 1000 characters.

DOCUMENT CONTENT:
${documentContent}

SUMMARY:`;

      // Get AI service and generate analysis
      const analysis = await this.aiService.analyze(prompt);
      if (!analysis || !analysis.trim()) {
        throw new Error('Failed to generate summary from AI service');
      }

      return analysis.trim();
    } catch (error) {
      console.error('[ERROR] generating summary:', error.message);
      throw error;
    }
  }

  /**
   * Save summary to Notes field in PaperlessNGX
   * @param {number} documentId - ID of the document
   * @param {string} summary - Summary to save to notes
   * @returns {Promise<boolean>} - Success status
   */
  async saveToNotes(documentId, summary) {
    try {
      // Format the summary with a timestamp
      const timestamp = new Date().toISOString();
      const formattedSummary = `--- AI Generated Summary (${timestamp}) ---\n\n${summary}`;
      
      // Get existing document data to check for existing notes
      const document = await paperlessService.getDocument(documentId);
      let updatedNotes;
      
      // If there are existing notes, append the summary
      if (document.notes && document.notes.trim()) {
        updatedNotes = `${document.notes}\n\n${formattedSummary}`;
      } else {
        updatedNotes = formattedSummary;
      }
      
      // Update document with new notes
      const result = await paperlessService.updateDocument(documentId, { notes: updatedNotes });
      
      return !!result;
    } catch (error) {
      console.error(`[ERROR] saving summary to notes for document ${documentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch process documents to generate summaries
   * @param {Array<number>} documentIds - Array of document IDs to process
   * @returns {Promise<Object>} - Results of batch processing
   */
  async batchProcessSummaries(documentIds) {
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      details: []
    };

    try {
      for (const documentId of documentIds) {
        try {
          const result = await this.generateAndSaveSummary(documentId);
          if (result.success) {
            results.processed++;
          } else {
            results.failed++;
          }
          results.details.push(result);
        } catch (error) {
          results.failed++;
          results.details.push({
            success: false,
            documentId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[ERROR] in batch processing summaries:', error.message);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }
}

module.exports = new SummaryService();
