document.addEventListener('DOMContentLoaded', () => {
    // Legacy file redirecting to consolidation features
    const mergeButton = document.getElementById('mergeTags');
    const thresholdInput = document.getElementById('similarityThreshold');
    const resultsList = document.getElementById('mergeResults');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Provide backward compatibility for old tag merger page
    if (mergeButton) {
        mergeButton.addEventListener('click', async () => {
            try {
                loadingSpinner.style.display = 'block';
                mergeButton.disabled = true;
                resultsList.innerHTML = '';

                const threshold = thresholdInput.value || 0.8;
                // Use new consolidation endpoint
                const response = await fetch(`/api/consolidation/similar-tags?threshold=${threshold}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        window.location.href = '/login';
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success && data.similarGroups && data.similarGroups.length > 0) {
                    // Process similar groups
                    const summary = document.createElement('div');
                    summary.className = 'alert alert-info';
                    summary.textContent = `Found ${data.similarGroups.length} groups of similar tags`;
                    resultsList.appendChild(summary);
                    
                    const note = document.createElement('div');
                    note.className = 'alert alert-warning';
                    note.textContent = `For a more comprehensive tag management interface, please use the /consolidation page.`;
                    resultsList.appendChild(note);
                    
                    // Display each group
                    data.similarGroups.forEach((group, i) => {
                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'card mb-3';
                        
                        const header = document.createElement('div');
                        header.className = 'card-header';
                        header.textContent = `Similar Group ${i+1}`;
                        
                        const body = document.createElement('div');
                        body.className = 'card-body';
                        
                        const tagsList = document.createElement('ul');
                        tagsList.className = 'list-group';
                        
                        group.forEach(tag => {
                            const tagItem = document.createElement('li');
                            tagItem.className = 'list-group-item';
                            tagItem.textContent = `${tag.name} (ID: ${tag.id})`;
                            tagsList.appendChild(tagItem);
                        });
                        
                        body.appendChild(tagsList);
                        groupDiv.appendChild(header);
                        groupDiv.appendChild(body);
                        resultsList.appendChild(groupDiv);
                    });
                } else {
                    const noResults = document.createElement('div');
                    noResults.className = 'alert alert-info';
                    noResults.textContent = 'No similar tags found. Try lowering the similarity threshold.';
                    resultsList.appendChild(noResults);
                }
            } catch (error) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger';
                errorDiv.textContent = `Error: ${error.message}`;
                resultsList.appendChild(errorDiv);
            } finally {
                loadingSpinner.style.display = 'none';
                mergeButton.disabled = false;
            }
        });
    }
});
