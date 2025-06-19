const summaryService = require('./services/summaryService');

async function testSummaryService() {
    try {
        // Initialize the service
        console.log('Initializing summary service...');
        const initialized = await summaryService.initialize();
        if (!initialized) {
            console.error('Failed to initialize summary service');
            return;
        }
        console.log('Summary service initialized successfully');

        // Test with a single document
        const testDocumentId = 1; // Replace with an actual document ID from your Paperless instance
        console.log(`\nTesting summary generation for document ${testDocumentId}...`);
        
        const result = await summaryService.generateAndSaveSummary(testDocumentId);
        console.log('\nResult:', JSON.stringify(result, null, 2));

        // Test batch processing
        const testDocumentIds = [1, 2, 3]; // Replace with actual document IDs
        console.log('\nTesting batch processing...');
        const batchResult = await summaryService.batchProcessSummaries(testDocumentIds);
        console.log('\nBatch Result:', JSON.stringify(batchResult, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testSummaryService(); 