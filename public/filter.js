// Filter-related functionality
const filterDropdown = document.getElementById('filter-dropdown');

// Filtering entries based on dropdown selection
if (filterDropdown) {
    filterDropdown.addEventListener('change', async (event) => {
        const filter = event.target.value || 'most-recent'; // Default to 'most-recent' if empty

        try {
            const response = await fetch(`/entries?filter=${filter}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.split('=')[1]}` // Adjust for your JWT setup
                },
            });

            if (response.ok) {
                const entries = await response.json();

                const entriesList = document.querySelector('.entries-list');
                entriesList.innerHTML = ''; // Clear current entries

                entries.forEach(entry => {
                    entriesList.innerHTML += `
                        <li class="entry-item">
                            <div class="entry-summary" data-entry-id="${entry.response_id}">
                                <span class="entry-date">${new Date(entry.created_at).toLocaleDateString()}</span>
                                <span class="entry-card">${entry.card_name}</span>
                            </div>
                            <div class="entry-details hidden">
                                <p class="entry-prompt">Prompt: ${entry.prompt_text}</p>
                                <p class="entry-response">Response: ${entry.response_text}</p>
                            </div>
                        </li>`;
                });

                // Reapply event listeners for the toggling feature
                attachEntryToggleListeners();
            } else {
                console.error('Failed to fetch entries:', response.statusText);
            }
        } catch (err) {
            console.error('Error fetching entries:', err);
        }
    });
} else {
    console.warn("Filter dropdown not found, skipping filter setup.");
}

// Attach event listeners for toggling entry details
function attachEntryToggleListeners() {
    document.querySelectorAll('.entry-summary').forEach(summary => {
        summary.addEventListener('click', () => {
            console.log('Toggling entry details for:', summary);
            const details = summary.nextElementSibling;
            if (details) {
                details.classList.toggle('hidden');
            } else {
                console.warn('No sibling found for:', summary);
            }
        });
    });
}

// Initial setup to ensure toggling works for preloaded entries
document.addEventListener('DOMContentLoaded', attachEntryToggleListeners);
