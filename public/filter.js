document.addEventListener('DOMContentLoaded', () => {
    let isFetching = false;

    // Filter-related functionality
    const filterDropdown = document.getElementById('filter-dropdown');
    const searchBar = document.getElementById('search-bar'); 
    const searchButton = document.getElementById('search-button'); 

    async function fetchAndRenderEntries() {
        if (isFetching) {
            console.warn('Fetch request already in progress, skipping...');
            return;
        }
        isFetching = true;

        const filter = filterDropdown?.value || 'most-recent'; // Default to 'most-recent' if dropdown is missing
        const searchQuery = searchBar?.value.trim(); // Get search query, if any

        // Construct URL with filter and search parameters
        let url = `/entries?filter=${filter}`;
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }

        window.history.pushState({}, '', url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const entries = data.entries;

                const entriesList = document.querySelector('.entries-list');
                entriesList.innerHTML = ''; // Clear current entries

                if (entries.length > 0) {
                    entries.forEach(entry => {
                        entriesList.innerHTML += `
                            <li class="entry-item">
                                <div class="entry-summary" data-entry-id="${entry.response_id}">
                                    <span class="entry-date">${new Date(entry.created_at).toLocaleDateString()}</span>
                                    <span class="entry-card">${entry.card_name}</span>
                                    <span class="entry-orientation">${entry.orientation}</span>
                                </div>
                                <div class="entry-details hidden">
                                    <p class="entry-prompt"><strong>Prompt:</strong> ${entry.parsed_prompt_text}</p>
                                    <br>
                                    <p class="entry-response"><strong>Response:</strong> ${entry.response_text}</p>
                                </div>
                            </li>`;
                    });
                    attachEntryToggleListeners();
                } else {
                    entriesList.innerHTML = '<li>No entries found.</li>';
                }
            } else {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                alert('An error occurred while fetching entries. ${response.statusText}.');
            }
        } catch (err) {
            console.error('Error fetching entries:', err);
            // Handle only critical errors
            if (err.message.includes('NetworkError') || !navigator.onLine) {
                alert('Network error. Please check your connection.');
            } else {
                console.warn('Non-critical error occurred, see console for details.');
            }
        } finally {
            isFetching = false; // Reset flag
        }
    }

    if (filterDropdown) {
        filterDropdown.addEventListener('change', () => {
            fetchAndRenderEntries(); // Fetch immediately on dropdown change
        });
    } else {
        console.warn("Filter dropdown not found, skipping filter setup.");
    }

    if (searchButton) {
        searchButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission if inside a form
            fetchAndRenderEntries(); // Fetch on button click
        });
    } else {
        console.warn("Search button not found, skipping search setup.");
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

    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }

    // Initial setup to ensure toggling works for preloaded entries
    attachEntryToggleListeners();

});