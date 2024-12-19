document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = 'https://tarotlog-public.onrender.com';

    const drawCardBtn = document.getElementById('draw-card-btn');
    const saveResponseBtn = document.getElementById('save-response-btn');
    const profileCircle = document.querySelector("#profile-circle");
    const dropdownMenu = document.querySelector("#dropdown-menu");
    const filterDropdown = document.getElementById('filter-dropdown');

    // Add a spinner element at the top
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    spinner.style.display = 'none';
    spinner.style.position = 'absolute';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.border = '4px solid rgba(0,0,0,0.1)';
    spinner.style.borderTop = '4px solid #f3f3f3';
    spinner.style.borderRadius = '50%';
    spinner.style.width = '40px';
    spinner.style.height = '40px';
    spinner.style.animation = 'spin 1s linear infinite';
    document.body.appendChild(spinner);

    // Add CSS animation for the spinner
    const style = document.createElement('style');
    style.innerHTML = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }`;
    document.head.appendChild(style);

    let drawnCard;
    let isDrawing = false; // Prevent multiple requests

    // Add event listener for draw-card-btn
    if (drawCardBtn) {
        drawCardBtn.addEventListener('click', async () => {
            if (!isDrawing) {
                isDrawing = true;
                spinner.style.display = 'block';

                try {
                    console.log("Starting card draw...");
                    const response = await fetch(`${API_BASE_URL}/api/draw-card`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch card');
                    }

                    const randomCard = await response.json();
                    console.log('Fetched Card Data:', randomCard);
                    
                    drawnCard = randomCard;
                    updateCardUI(randomCard);

                } catch (error) {
                    console.error('Error drawing card:', error);
                    alert(`Failed to draw card: ${error.message}`);
                } finally {
                    isDrawing = false;
                    spinner.style.display = 'none';
                }
            }
        });
    }

    // Add event listener for save-response-btn
    if (saveResponseBtn) {
        saveResponseBtn.addEventListener('click', async () => {
            if (!drawnCard) {
                console.warn('No card drawn, aborting save.');
                return;
            }

            const response1 = document.getElementById('response-1')?.value.trim();
            const promptText = document.getElementById('card-prompt')?.innerText.trim();

            if (!response1 || !promptText) {
                console.warn('Missing fields:', { response1, promptText });
                return;
            }

            console.log('Payload being sent to API:', {
                user_id: user?.id,
                card_id: drawnCard.card_id,
                prompt_text: promptText,
                response_text: response1,
                orientation: drawnCard.orientation
            });
            console.log('Payload to be sent:', payload);

            try {
                const response = await fetch(`${API_BASE_URL}/api/save-response`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server Error:', response.status, errorText);
                    throw new Error(errorText);
                }

                alert('Responses saved successfully!');
                resetCardUI();
            } catch (error) {
                console.error('Error saving response:', error);
                alert(`Failed to save responses: ${error.message}`);
            }
        });
    }

    // Profile menu toggle
    if (profileCircle && dropdownMenu) {
        profileCircle.addEventListener("click", (event) => {
            dropdownMenu.classList.toggle("show");
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
                const details = summary.nextElementSibling;
                details.classList.toggle('hidden');
            });
        });
    }

    function updateCardUI(card) {
        const cardImage = document.getElementById('drawn-card');
        const cardTitleElement = document.getElementById('card-title');
        const cardPrompt = document.getElementById('card-prompt');
        const responseBox = document.getElementById('response-1');
        const saveButton = document.getElementById('save-response-btn');

        if (cardImage && cardTitleElement && cardPrompt && responseBox && saveButton) {
            cardImage.src = card.image_data;
            cardImage.dataset.cardId = card.card_id;
            cardImage.style.transform = card.orientation === 'Reversed' ? 'rotate(180deg)' : 'rotate(0deg)';

            cardTitleElement.innerText = `${card.suit}: ${card.card_name} (${card.orientation})`;
            cardPrompt.innerText = card.orientation === 'Reversed' ? card.meaning_reversed : card.meaning_upright;

            responseBox.classList.remove('hidden');
            saveButton.classList.remove('hidden');
        } else {
            console.error('UI elements for card display not found.');
        }
    }

    // Initial setup to ensure toggling works for preloaded entries
    attachEntryToggleListeners();

    /*
    async function drawCard() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/draw-card`);
            if (!response.ok) {
                throw new Error('Failed to fetch card');
            }

            const randomCard = await response.json();
            drawnCard = randomCard;

            // Debugging log
            console.log('Random Card Data:', randomCard);

            // Update UI elements
            const cardImage = document.getElementById('drawn-card');
            const cardTitleElement = document.getElementById('card-title');
            const cardHeader = document.querySelector('.card-header');
            const cardPrompt = document.getElementById('card-prompt');

            if (cardImage && cardTitleElement && cardHeader && cardPrompt) {
                cardImage.src = randomCard.image_data;
                cardImage.dataset.cardId = randomCard.card_id; // Set card ID for consistency

                cardImage.style.transform = randomCard.orientation === 'Reversed' ? 'rotate(180deg)' : 'rotate(0deg)';

                cardTitleElement.innerText = `${randomCard.suit}: ${randomCard.card_name} (${randomCard.orientation})`;
                cardPrompt.innerText = randomCard.orientation === 'Reversed' 
                    ? randomCard.meaning_reversed 
                    : randomCard.meaning_upright;

                cardHeader.classList.remove('hidden');
            } else {
                console.error('UI elements for card display not found.');
            }

            // Show response text boxes and save button
            const responseBox = document.getElementById('response-1');
            const promptSection = document.getElementById('prompt-section');

            if (responseBox && promptSection) {
                promptSection.classList.remove('hidden');
                responseBox.classList.remove('hidden');
                responseBox.classList.add('response-box');
            } else {
                console.error('Response box or prompt section not found!');
            }

        } catch (error) {
            console.error('Error drawing card:', error);
            alert(`Failed to draw card: ${error.message}`);
        } finally {
            isDrawing = false;
            spinner.style.display = 'none';
        }
    }
    */

    /*
    async function saveResponses() {
        if (!drawnCard) {
            alert('No card drawn. Please draw a card before saving responses.');
            return;
        }

        const response1 = document.getElementById('response-1')?.value.trim();
        const promptText = document.getElementById('card-prompt')?.innerText.trim();
        const cardId = drawnCard.card_id; // Use drawnCard as the source of truth

        if (!response1 || !promptText || isNaN(cardId)) {
            alert('All fields must be filled out.');
            return;
        }

        console.log('Payload being sent to API:', {
            user_id: user?.id,
            card_id: cardId,
            prompt_text: promptText,
            response_text: response1,
            orientation: drawnCard.orientation
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/save-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user?.id,
                    card_id: cardId,
                    prompt_text: promptText,
                    response_text: response1,
                    orientation: drawnCard.orientation
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend Error:', errorText);
                throw new Error(`Server Error: ${response.status} - ${errorText}`);
            }

            alert('Responses saved successfully!');
            resetCardUI();
        } catch (error) {
            console.error('Error saving response:', error.message);
            alert(`Failed to save responses: ${error.message}`);
        }
    }
    */

    function resetCardUI() {
        const cardImage = document.getElementById('drawn-card');
        const cardTitleContainer = document.querySelector('.card-header');
        const promptSection = document.querySelector('.prompt-section');

        if (cardImage) {
            cardImage.src = 'https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/image_back.png';
            cardImage.alt = 'Facedown Card';
        }

        if (document.getElementById('response-1')) {
            document.getElementById('response-1').value = '';
        }

        if (cardTitleContainer) {
            cardTitleContainer.classList.add('hidden');
        }
        if (promptSection) {
            promptSection.classList.add('hidden');
        }

        drawnCard = null;
    }

    fetch('/api/draw-card')
        .then(response => response.json())
        .then(data => {
            console.assert(data.card_id, 'Card ID should exist');
            console.assert(data.card_id > 0, 'Card ID should be valid');
            console.log('Test Passed:', data);
        })
        .catch(error => console.error('Test Failed:', error));
});
