![GitHub License](https://img.shields.io/github/license/clusterzx/paperless-ai?cacheSeconds=1) ![Based On](https://img.shields.io/badge/based%20on-Paperless--AI-blue)

# Paperless-AI Extended

An extended version of Paperless-AI that adds powerful metadata management tools and document summarization capabilities to the original feature set. Built on top of the excellent Paperless-AI project, this extension adds more power and organization to your Paperless-ngx document management system.

It features everything from the original Paperless-AI: Automode, Manual Mode, support for Ollama and OpenAI, a Chat function to query your documents with AI, plus new tools for consolidating metadata and generating document summaries.
\
**Following Services and OpenAI API compatible services have been successfully tested:**
- Ollama
- OpenAI
- DeepSeek.ai
- OpenRouter.ai
- Perplexity.ai
- Together.ai
- VLLM
- LiteLLM
- Fastchat
- Gemini (Google)
- ... and there are possibly many more

![PPAI_SHOWCASE3](https://github.com/user-attachments/assets/1fc9f470-6e45-43e0-a212-b8fa6225e8dd)


## Features

### Automated Document Management
- **Automatic Scanning**: Identifies and processes new documents within Paperless-ngx.
- **AI-Powered Analysis**: Leverages OpenAI API and Ollama (Mistral, Llama, Phi 3, Gemma 2) for precise document analysis.
- **Metadata Assignment**: Automatically assigns titles, tags, document_type and correspondent details.

### Advanced Customization Options
- **Predefined Processing Rules**: Specify which documents to process based on existing tags. *(Optional)* 🆕
- **Selective Tag Assignment**: Use only selected tags for processing. *(Disables the prompt dialog)* 🆕
- **Custom Tagging**: Assign a specific tag (of your choice) to AI-processed documents for easy identification. 🆕

### Manual Mode
- **AI-Assisted Analysis**: Manually analyze documents with AI support in a modern web interface. *(Accessible via the `/manual` endpoint)* 🆕

### Interactive Chat Functionality
- **Document Querying**: Ask questions about your documents and receive accurate, AI-generated answers. 🆕

### Metadata Consolidation Tools 🔥
- **Similar Tag Detection**: Find and consolidate similar tags using advanced similarity algorithms.
- **Correspondent Management**: Identify and merge duplicate correspondents to keep your system organized.
- **Document Type Cleanup**: Consolidate similar document types to maintain a clean classification system.

### Automatic Document Summaries 🔥
- **AI-Generated Summaries**: Create concise summaries of document content using the same AI models.
- **Notes Integration**: Automatically save summaries to the Notes field in Paperless-ngx.
- **Batch Processing**: Generate summaries for multiple documents in a single operation.

## Installation

Visit the Wiki for installation:\
[Click here for Installation](https://github.com/clusterzx/paperless-ai/wiki/2.-Installation)
-------------------------------------------


## Docker Support

The application comes with full Docker support:

- Automatic container restart on failure
- Health monitoring
- Volume persistence for database
- Resource management
- Graceful shutdown handling

## Development

To run the application locally without Docker:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run test
```

3. Or run in production mode:
```bash
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) for the amazing document management system
- OpenAI API
- The Express.js and Node.js communities for their excellent tools

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/clusterzx/paperless-ai/issues) section
2. Create a new issue if yours isn't already listed
3. Provide detailed information about your setup and the problem

## Feature Roadmap

### Completed
- [x] Support for custom AI models
- [x] Support for multiple language analysis
- [x] Advanced tag matching algorithms
- [x] Custom rules for document processing
- [x] Enhanced web interface with statistics
- [x] Metadata consolidation tools for tags, correspondents, and document types
- [x] Automatic document summarization with Notes field integration

### Planned
- [ ] Advanced AI summarization options with customizable templates
- [ ] Bulk metadata cleanup recommendations
- [ ] Scheduled summary generation for new documents
- [ ] Summary-based document search enhancement
- [ ] Exportable metadata reports

