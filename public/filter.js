document.addEventListener('DOMContentLoaded', () => {

    // Filter-related functionality
    const filterDropdown = document.getElementById('filter-dropdown');
    const searchBar = document.getElementById('search-bar'); 
    const searchButton = document.getElementById('search-button'); 


    if (filterDropdown) {
        filterDropdown.addEventListener('change', fetchAndRenderEntries);
    } else {
        console.warn("Filter dropdown not found, skipping filter setup.");
    }

    if (searchButton) {
        searchButton.addEventListener('click', fetchAndRenderEntries);
    } else {
        console.warn("Search button not found, skipping search setup.");
    }

    async function fetchAndRenderEntries() {
        const filter = filterDropdown?.value || 'most-recent'; // Default to 'most-recent' if dropdown is missing
        const searchQuery = searchBar?.value.trim(); // Get search query, if any

        // Construct URL with filter and search parameters
        let url = `/entries?filter=${filter}`;
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }

        try {
            const response = await fetch(url, {
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

                if (entries.length > 0) {
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
                } else {
                    entriesList.innerHTML = '<li>No entries found.</li>';
                }

                // Reapply event listeners for the toggling feature
                attachEntryToggleListeners();
            } else {
                console.error('Failed to fetch entries:', response.statusText);
            }
        } catch (err) {
            console.error('Error fetching entries:', err);
        }
    }

    // Attach event listeners for toggling entry details
    function attachEntryToggleListeners() {
        document.querySelectorAll('.entry-summary').forEach(summary => {
            summary.addEventListener('click', () => {
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
    attachEntryToggleListeners();

});