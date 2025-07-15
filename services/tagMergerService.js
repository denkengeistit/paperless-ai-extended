const consolidationService = require('./consolidationService');
const paperlessService = require('./paperlessService');

class TagMergerService {
    constructor(similarityThreshold = 0.8) {
        this.similarityThreshold = similarityThreshold;
    }

    /**
     * Calculate similarity between two tag names using Levenshtein distance
     * @param {string} tag1 - First tag name
     * @param {string} tag2 - Second tag name
     * @returns {number} Similarity ratio between 0 and 1
     */
    calculateSimilarity(tag1, tag2) {
        return consolidationService.calculateSimilarity(tag1.toLowerCase(), tag2.toLowerCase());
    }


    /**
     * Group tags based on name similarity
     * @param {Array} tags - List of tag objects
     * @returns {Array} List of groups, where each group is a list of similar tags
     */
    groupSimilarTags(tags) {
        const groups = [];
        const processed = new Set();

        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            if (processed.has(tag.id)) continue;

            const currentGroup = [tag];
            processed.add(tag.id);

            for (let j = i + 1; j < tags.length; j++) {
                const otherTag = tags[j];
                if (!processed.has(otherTag.id)) {
                    const similarity = this.calculateSimilarity(tag.name, otherTag.name);
                    if (similarity >= this.similarityThreshold) {
                        currentGroup.push(otherTag);
                        processed.add(otherTag.id);
                    }
                }
            }

            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
        }

        return groups;
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
            // For each source tag, get and update all associated documents
            for (const sourceId of sourceTagIds) {
                // Get all documents with the source tag
                const documents = await paperlessService.getDocuments({ tags__id: sourceId });

                // Update each document to use the target tag
                for (const doc of documents.results) {
                    const tags = doc.tags.filter(id => id !== sourceId);
                    if (!tags.includes(targetTagId)) {
                        tags.push(targetTagId);
                    }

                    // Update document tags
                    await paperlessService.updateDocument(doc.id, { tags });
                }

                // Delete the source tag
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
     * @returns {Promise<{mergeCount: number, mergeDetails: Array<string>}>}
     */
    async processAndMergeTags() {
        // Get all tags
        const tagsResponse = await paperlessService.getTags();
        const tags = tagsResponse.results;

        // Group similar tags
        const groups = this.groupSimilarTags(tags);

        // Sort groups by document count
        const sortedGroups = this.sortGroupsByDocCount(groups);

        let mergeCount = 0;
        const mergeDetails = [];

        // Process each group
        for (const group of sortedGroups) {
            if (group.length > 1) {
                // Use the tag with the most documents as the target
                const targetTag = group.reduce((max, tag) => 
                    (tag.document_count || 0) > (max.document_count || 0) ? tag : max
                , group[0]);

                const sourceTags = group.filter(tag => tag.id !== targetTag.id);

                // Perform the merge
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
    }
}

module.exports = new TagMergerService();
