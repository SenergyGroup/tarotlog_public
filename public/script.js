document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = 'https://tarotlog-public.onrender.com';

    const drawCardBtn = document.getElementById('draw-card-btn');
    const saveResponseBtn = document.getElementById('save-response-btn');
    const profileCircle = document.querySelector("#profile-circle");
    const dropdownMenu = document.querySelector("#dropdown-menu");

    let drawnCard;

    // Add event listener for draw-card-btn
    if (drawCardBtn) {
        drawCardBtn.addEventListener('click', drawCard);
    }

    // Add event listener for save-response-btn
    if (saveResponseBtn) {
        saveResponseBtn.addEventListener('click', saveResponses);
    }

    // Profile menu toggle
    if (profileCircle && dropdownMenu) {
        profileCircle.addEventListener("click", (event) => {
            dropdownMenu.classList.toggle("show");
            console.log("Dropdown toggled:", dropdownMenu.classList.contains("show"));
            event.stopPropagation();
        });

        document.addEventListener("click", (event) => {
            if (!dropdownMenu.contains(event.target) && !profileCircle.contains(event.target)) {
                dropdownMenu.classList.remove("show");
            }
        });
    } else {
        console.error("Profile circle or dropdown menu not found!");
    }


    // Filtering entries based on dropdown selection
    document.getElementById('filter-dropdown').addEventListener('change', async (event) => {
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

    // Attach event listeners for toggling entry details
    function attachEntryToggleListeners() {
        document.querySelectorAll('.entry-summary').forEach(summary => {
            summary.addEventListener('click', () => {
                const details = summary.nextElementSibling;
                details.classList.toggle('hidden');
            });
        });
    }

    // Initial setup to ensure toggling works for preloaded entries
    attachEntryToggleListeners();

    async function drawCard() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/draw-card`);
            if (!response.ok) {
                throw new Error('Failed to fetch card');
            }

            const randomCard = await response.json();
            drawnCard = randomCard;

            const cardImage = document.getElementById('drawn-card');
            cardImage.src = randomCard.image_data;
            cardImage.dataset.cardId = randomCard.card_id; // Store card_id for later
            cardImage.classList.remove('hidden');

            console.log('Card drawn:', drawnCard);

            // Apply orientation (upright or reversed)
            if (randomCard.orientation === 'Reversed') {
                cardImage.style.transform = 'rotate(180deg)';
            } else {
                cardImage.style.transform = 'rotate(0deg)';
            }

            // Display card title and prompt
            const cardTitle = `${randomCard.suit}: ${randomCard.card_name} (${randomCard.orientation})`;
            document.getElementById('card-title').innerText = cardTitle;
            document.querySelector('.card-header').classList.remove('hidden');
            document.getElementById('card-prompt').innerText = randomCard.description;
            

            // Show response text boxes and save button
            document.getElementById('save-response-btn').classList.remove('hidden');
            document.getElementById('response-1').classList.remove('hidden');
            document.getElementById('response-1').classList.add('response-box');
        } catch (error) {
            console.error('Error drawing card:', error);
        }
    }

    async function saveResponses() {
        const response1 = document.getElementById('response-1').value.trim();
        const promptText = document.getElementById('card-prompt').innerText.trim();
        const cardId = document.getElementById('drawn-card').dataset.cardId;
        
        if (!user || !user.id) {  // Use global 'user' object passed from server
            alert('User is not authenticated. Please log in.');
            return;
        }

        if (!response1 || !promptText || !cardId) {
            alert('All fields must be filled out.');
            return;
        }

        if (!drawnCard || !drawnCard.orientation) {
            alert('Card orientation is missing. Please draw a card again.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/save-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    card_id: cardId,
                    prompt_text: promptText,
                    response_text: response1,
                    orientation: drawnCard.orientation
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error: ${response.status} - ${errorText}`);
            }

            alert('Responses saved successfully!');
            document.getElementById('drawn-card').classList.add('hidden');
            document.getElementById('response-1').classList.add('hidden');
            document.getElementById('card-prompt').classList.add('hidden');
            document.getElementById('save-response-btn').classList.add('hidden');
            document.querySelector('.card-header').classList.add('hidden');

            clearResponseFields();
        } catch (error) {
            console.error('Error saving response:', error.message);
            alert(`Failed to save responses: ${error.message}`);
        }
    }

    function clearResponseFields() {
        document.getElementById('response-1').value = '';
    }
});