const OpenAI = require('openai');
const config = require('../config/config');
const tiktoken = require('tiktoken');
const paperlessService = require('./paperlessService');
const fs = require('fs').promises;
const path = require('path');

class OpenAIService {
  constructor() {
    this.client = null;
    this.tokenizer = null;
  }

  initialize() {
    if (!this.client && config.aiProvider === 'ollama') {
      this.client = new OpenAI({
        baseURL: config.ollama.apiUrl + '/v1',
        apiKey: 'ollama'
      });
    } else if (!this.client && config.aiProvider === 'custom') {
      this.client = new OpenAI({
        baseURL: config.custom.apiUrl,
        apiKey: config.custom.apiKey
      });
    } else if (!this.client && config.aiProvider === 'openai') {
    if (!this.client && config.openai.apiKey) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
    }}

  // Calculate tokens for a given text
  async calculateTokens(text) {
    if (!this.tokenizer) {
      // Use the appropriate model encoding
      this.tokenizer = await tiktoken.encoding_for_model(process.env.OPENAI_MODEL || "gpt-4o-mini");
    }
    return this.tokenizer.encode(text).length;
  }

  // Calculate tokens for a given text
  async calculateTotalPromptTokens(systemPrompt, additionalPrompts = []) {
    let totalTokens = 0;
    
    // Count tokens for system prompt
    totalTokens += await this.calculateTokens(systemPrompt);
    
    // Count tokens for additional prompts
    for (const prompt of additionalPrompts) {
      if (prompt) { // Only count if prompt exists
        totalTokens += await this.calculateTokens(prompt);
      }
    }
    
    // Add tokens for message formatting (approximately 4 tokens per message)
    const messageCount = 1 + additionalPrompts.filter(p => p).length; // Count system + valid additional prompts
    totalTokens += messageCount * 4;
    
    return totalTokens;
  }

  // Truncate text to fit within token limit
  async truncateToTokenLimit(text, maxTokens) {
    const tokens = await this.calculateTokens(text);
    if (tokens <= maxTokens) return text;

    // Simple truncation strategy - could be made more sophisticated
    const ratio = maxTokens / tokens;
    return text.slice(0, Math.floor(text.length * ratio));
  }

  async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], id, customPrompt = null) {
    const cachePath = path.join('./public/images', `${id}.png`);
    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }

      // Handle thumbnail caching
      try {
        await fs.access(cachePath);
        console.log('[DEBUG] Thumbnail already cached');
      } catch (err) {
        console.log('Thumbnail not cached, fetching from Paperless');
        
        const thumbnailData = await paperlessService.getThumbnailImage(id);
        
        if (!thumbnailData) {
          console.warn('Thumbnail nicht gefunden');
        }
  
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, thumbnailData);
      }
      
      // Format existing tags
      const existingTagsList = existingTags
        .map(tag => tag.name)
        .join(', ');

      let systemPrompt = '';
      let promptTags = '';
      const model = process.env.OPENAI_MODEL;
      
      // Parse CUSTOM_FIELDS from environment variable
      let customFieldsObj;
      try {
        customFieldsObj = JSON.parse(process.env.CUSTOM_FIELDS);
      } catch (error) {
        console.error('Failed to parse CUSTOM_FIELDS:', error);
        customFieldsObj = { custom_fields: [] };
      }

      // Generate custom fields template for the prompt
      const customFieldsTemplate = {};

      customFieldsObj.custom_fields.forEach((field, index) => {
        customFieldsTemplate[index] = {
          field_name: field.value,
          value: "Fill in the value based on your analysis"
        };
      });

      // Convert template to string for replacement and wrap in custom_fields
      const customFieldsStr = '"custom_fields": ' + JSON.stringify(customFieldsTemplate, null, 2)
        .split('\n')
        .map(line => '    ' + line)  // Add proper indentation
        .join('\n');

      // Get system prompt and model
      if(process.env.USE_EXISTING_DATA === 'yes') {
        systemPrompt = `
        Prexisting tags: ${existingTagsList}\n\n
        Prexisiting correspondent: ${existingCorrespondentList}\n\n
        ` + process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        promptTags = '';
      } else {
        config.mustHavePrompt = config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        systemPrompt = process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt;
        promptTags = '';
      }

      if (process.env.USE_PROMPT_TAGS === 'yes') {
        promptTags = process.env.PROMPT_TAGS;
        systemPrompt = `
        Take these tags and try to match one or more to the document content.\n\n
        ` + config.specialPromptPreDefinedTags;
      }

      if (customPrompt) {
        console.log('[DEBUG] Replace system prompt with custom prompt via WebHook');
        systemPrompt = customPrompt + '\n\n' + config.mustHavePrompt;
      }
      
      // Rest of the function remains the same
      const totalPromptTokens = await this.calculateTotalPromptTokens(
        systemPrompt,
        process.env.USE_PROMPT_TAGS === 'yes' ? [promptTags] : []
      );
      
      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens);
      const availableTokens = maxTokens - reservedTokens;
      
      const truncatedContent = await this.truncateToTokenLimit(content, availableTokens);
      
      await this.writePromptToFile(systemPrompt, truncatedContent);

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        ...(model !== 'o3-mini' && { temperature: 0.3 }),
      });
      
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }
      
      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(`[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`);
      
      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Try to locate JSON content in the response if it's not properly formatted
      if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
        console.log('[DEBUG] Response not in JSON format, attempting to extract JSON...');
        // Try to find JSON pattern between curly braces
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('[DEBUG] Found JSON-like content in response');
          jsonContent = jsonMatch[0];
        } else {
        console.error('[ERROR] Could not extract JSON from response: ' + jsonContent); // Log full content for debugging
          // Create a default response with a fixed title indicating error
          return { 
            document: {
              title: "Error: Invalid JSON Response",
              correspondent: null,
              tags: ["untagged", "error"],
              document_type: "Document",
              document_date: new Date().toISOString().split('T')[0],
              language: "en"
            },
            metrics: {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens
            },
            truncated: false
          };
        }
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
        console.log('[DEBUG] Raw AI response:', jsonContent);
        console.log('[DEBUG] Parsed response:', parsedResponse);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        console.log('[DEBUG] Attempting to create default response from non-JSON content');
        console.log('[DEBUG] Non-JSON content:', jsonContent);
        // Create a default response with a fixed title indicating error
        return { 
          document: {
            title: "Error: Invalid JSON Response",
            correspondent: null,
            tags: ["untagged", "error"],
            document_type: "Document",
            document_date: new Date().toISOString().split('T')[0],
            language: "en"
          },
          metrics: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          },
          truncated: false
        };
      }

      // Validate response structure
      if (!parsedResponse) {
        throw new Error('Invalid response: empty or null response');
      }
      
      if (!Array.isArray(parsedResponse.tags)) {
        throw new Error('Invalid response: tags must be an array');
      }
      
      // If no tags are provided, add a fallback tag instead of failing
      if (parsedResponse.tags.length === 0) {
        console.log('[WARN] No tags provided by AI, adding fallback "untagged" tag');
        parsedResponse.tags = ["untagged"];
      }
      
      // Check if correspondent is invalid or empty, set to null if so
      if (typeof parsedResponse.correspondent !== 'string' || !parsedResponse.correspondent.trim()) {
        console.log('[WARN] No correspondent provided by AI, setting to null');
        parsedResponse.correspondent = null;
      }
      
      if (typeof parsedResponse.title !== 'string' || !parsedResponse.title.trim()) {
        throw new Error('Invalid response: title must be a non-empty string');
      }
      
      if (typeof parsedResponse.document_type !== 'string' || !parsedResponse.document_type.trim()) {
        throw new Error('Invalid response: document_type must be a non-empty string');
      }
      
      console.log('[DEBUG] Document date from AI:', parsedResponse.document_date);
      if (parsedResponse.document_date !== 'YYYY-MM-DD' && !/^\d{4}-\d{2}-\d{2}$/.test(parsedResponse.document_date)) {
        console.log(`[WARN] Invalid document_date format: ${parsedResponse.document_date}, defaulting to today's date`);
        parsedResponse.document_date = new Date().toISOString().split('T')[0];
      }
      
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(parsedResponse.language)) {
        throw new Error('Invalid response: language must be a valid language code (e.g., en, de, es)');
      }

      return { 
        document: parsedResponse, 
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length
      };
    } catch (error) {
      console.error('Failed to analyze document:', error);
      return { 
        document: { tags: [], correspondent: null },
        metrics: null,
        error: error.message 
      };
    }
}

  async writePromptToFile(systemPrompt, truncatedContent) {
    const filePath = './logs/prompt.txt';
    const maxSize = 10 * 1024 * 1024;
  
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > maxSize) {
        await fs.unlink(filePath); // Delete the file if is biger 10MB
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[WARNING] Error checking file size:', error);
      }
    }
  
    try {
      await fs.appendFile(filePath, systemPrompt + truncatedContent + '\n\n');
    } catch (error) {
      console.error('[ERROR] Error writing to file:', error);
    }
  }

  async analyzePlayground(content, prompt) {
    const musthavePrompt = `
    Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:  
        {
          "title": "xxxxx",
          "correspondent": "xxxxxxxx",
          "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
          "document_date": "YYYY-MM-DD",
          "language": "en/de/es/..."
        }`;

    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      
      if (!this.client) {
        throw new Error('OpenAI client not initialized - missing API key');
      }
      
      // Calculate total prompt tokens including musthavePrompt
      const totalPromptTokens = await this.calculateTotalPromptTokens(
        prompt + musthavePrompt // Combined system prompt
      );
      
      // Calculate available tokens
      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens); // Reserve for response
      const availableTokens = maxTokens - reservedTokens;
      
      // Truncate content if necessary
      const truncatedContent = await this.truncateToTokenLimit(content, availableTokens);
      const model = process.env.OPENAI_MODEL;
      // Make API request
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: prompt + musthavePrompt
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        ...(model !== 'o3-mini' && { temperature: 0.3 }),
      });
      
      // Handle response
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }
      
      // Log token usage
      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(`[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`);
      
      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Try to locate JSON content in the response if it's not properly formatted
      if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
        console.log('[DEBUG] Response not in JSON format, attempting to extract JSON...');
        // Try to find JSON pattern between curly braces
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('[DEBUG] Found JSON-like content in response');
          jsonContent = jsonMatch[0];
        } else {
        console.error('[ERROR] Could not extract JSON from response: ' + jsonContent); // Log full content for debugging
          // Create a default response with a fixed title indicating error
          return { 
            document: {
              title: "Error: Invalid JSON Response",
              correspondent: null,
              tags: ["untagged", "error"],
              document_type: "Document",
              document_date: new Date().toISOString().split('T')[0],
              language: "en"
            },
            metrics: {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens
            },
            truncated: false
          };
        }
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        console.log('[DEBUG] Attempting to create default response from non-JSON content');
        console.log('[DEBUG] Non-JSON content:', jsonContent);
        // Create a default response with a fixed title indicating error
        return { 
          document: {
            title: "Error: Invalid JSON Response",
            correspondent: null,
            tags: ["untagged", "error"],
            document_type: "Document",
            document_date: new Date().toISOString().split('T')[0],
            language: "en"
          },
          metrics: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          },
          truncated: false
        };
      }

      // Validate response structure
      if (!parsedResponse) {
        throw new Error('Invalid response: empty or null response');
      }
      
      if (!Array.isArray(parsedResponse.tags)) {
        throw new Error('Invalid response: tags must be an array');
      }
      
      // If no tags are provided, add a fallback tag instead of failing
      if (parsedResponse.tags.length === 0) {
        console.log('[WARN] No tags provided by AI in playground, adding fallback "untagged" tag');
        parsedResponse.tags = ["untagged"];
      }
      
      if (typeof parsedResponse.correspondent !== 'string' || !parsedResponse.correspondent.trim()) {
        console.log('[WARN] No correspondent provided by AI in playground, setting to null');
        parsedResponse.correspondent = null;
      }
      
      if (typeof parsedResponse.title !== 'string' || !parsedResponse.title.trim()) {
        throw new Error('Invalid response: title must be a non-empty string');
      }
      
      if (typeof parsedResponse.document_type !== 'string' || !parsedResponse.document_type.trim()) {
        throw new Error('Invalid response: document_type must be a non-empty string');
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedResponse.document_date)) {
        console.log(`[WARN] Invalid document_date format in playground: ${parsedResponse.document_date}, defaulting to today's date`);
        parsedResponse.document_date = new Date().toISOString().split('T')[0];
      }
      
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(parsedResponse.language)) {
        throw new Error('Invalid response: language must be a valid language code (e.g., en, de, es)');
      }

      return { 
        document: parsedResponse, 
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length
      };
    } catch (error) {
      console.error('Failed to analyze document:', error);
      return { 
        document: { tags: [], correspondent: null },
        metrics: null,
        error: error.message 
      };
    }
  }
}

module.exports = new OpenAIService();