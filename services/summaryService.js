// services/summaryService.js
const paperlessService = require('./paperlessService');
const AIServiceFactory = require('./aiServiceFactory');
const config = require('../config/config');

// Configuration constants
const MAX_CONTENT_LENGTH = 100000; // Maximum characters to process
const MAX_SUMMARY_LENGTH = 1000; // Maximum summary length
const MAX_NOTES_LENGTH = 10000; // Maximum notes length
const MAX_RETRIES = 3; // Maximum initialization retries
const RETRY_DELAY = 1000; // Delay between retries in ms

class SummaryService {
  constructor() {
    this.aiService = null;
    this.initializationAttempts = 0;
  }

  /**
   * Initialize the AI service for generating summaries
   */
  async initialize() {
    try {
      if (this.initializationAttempts >= MAX_RETRIES) {
        throw new Error('Maximum initialization attempts reached');
      }

      this.aiService = await AIServiceFactory.getAIService();
      this.initializationAttempts = 0;
      return true;
    } catch (error) {
      this.initializationAttempts++;
      console.error(`[ERROR] initializing SummaryService (attempt ${this.initializationAttempts}):`, error.message);
      
      if (this.initializationAttempts < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.initialize();
      }
      
      return false;
    }
  }

  /**
   * Validate document content
   * @param {string} content - Document content to validate
   * @returns {boolean} - Whether content is valid
   */
  validateContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      console.warn(`[WARN] Document content exceeds maximum length (${content.length} > ${MAX_CONTENT_LENGTH})`);
      return false;
    }
    return true;
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
        const initialized = await this.initialize();
        if (!initialized) {
          return {
            success: false,
            error: 'Failed to initialize AI service'
          };
        }
      }

      // Get document content
      const documentContent = await paperlessService.getDocumentContent(documentId);
      if (!this.validateContent(documentContent)) {
        return {
          success: false,
          error: 'Invalid or missing document content'
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
      if (!summary || summary.length > MAX_SUMMARY_LENGTH) {
        return {
          success: false,
          error: 'Generated summary is invalid or too long'
        };
      }

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
The summary should be comprehensive while remaining under ${MAX_SUMMARY_LENGTH} characters.
Format the response as plain text only.

DOCUMENT CONTENT:
${documentContent}

SUMMARY:`;

      // Get AI service and generate analysis
      const analysis = await this.aiService.analyze(prompt);
      if (!analysis || !analysis.trim()) {
        throw new Error('Failed to generate summary from AI service');
      }

      const summary = analysis.trim();
      if (summary.length > MAX_SUMMARY_LENGTH) {
        return summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
      }

      return summary;
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

      // Check if notes would exceed maximum length
      if (updatedNotes.length > MAX_NOTES_LENGTH) {
        // Keep only the most recent summaries
        const summaries = updatedNotes.split('--- AI Generated Summary');
        const recentSummaries = summaries.slice(-3); // Keep last 3 summaries
        updatedNotes = recentSummaries.join('--- AI Generated Summary');
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
