let drawnCard = null;

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = '';

    const moodSlider = document.getElementById("mood-slider");
    const cardImage = document.getElementById('drawn-card');
    const saveResponseBtn = document.getElementById('save-response-btn');

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

    let isDrawing = false; // Prevent multiple requests

    // Add event listener for draw-card-btn
    if (cardImage) {
        cardImage.addEventListener('click', async () => {
            if (!isDrawing) {
                isDrawing = true;
                spinner.style.display = 'block';

                try {
                    const response = await fetch(`${API_BASE_URL}/api/draw-card`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to fetch card');
                    }

                    const card = await response.json();
                    await updateCardUI(card);
                } catch (error) {
                    console.error('Can not draw a card:', error);
                    alert(`Can not draw a card right now. Please try again later.`);
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
            const moodValue = moodSlider.value;

            if (!response1 || !promptText) {
                console.warn('Missing fields:', { response1, promptText });
                return;
            }

            // Collect selected meanings
            const selectedMeanings = Array.from(document.querySelectorAll('.meaning-bubble.selected')).map(bubble => bubble.textContent.trim());

            const payload = {
                user_id: user.user_id,
                card_id: drawnCard.card_id,
                prompt_text: promptText,
                response_text: response1,
                orientation: drawnCard.orientation,
                selected_meanings: selectedMeanings,
                mood: parseInt(moodValue, 10),
            };

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
                alert(`Failed to save responses. Please try again later.`);
            }
        });
    }

    async function updateCardUI(card) {
        drawnCard = card;

        const cardImage = document.getElementById('drawn-card');
        const cardTitleElement = document.getElementById('card-title');
        const cardHeaderElement = document.querySelector('.card-header');

        const cardPrompt = document.getElementById('card-prompt');
        const responseBox = document.getElementById('response-1');
        const saveButton = document.getElementById('save-response-btn');
        const promptSection = document.querySelector('.prompt-section');

        // Get meanings based on orientation
        const isReversed = card.orientation.toLowerCase() === 'reversed';
        const meanings = isReversed
            ? card.meaning_reversed.split(',').map(m => m.trim())
            : card.meaning_upright.split(',').map(m => m.trim());

        // Call the backend to generate the AI prompt
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cardName: card.card_name,
                orientation: card.orientation,
                meanings: meanings,
            }),
            });

            if (!response.ok) {
            throw new Error('Failed to generate AI prompt');
            }

            const data = await response.json();
            cardPrompt.innerText = data.aiPrompt;
        } catch (error) {
            console.error('Error fetching AI-generated prompt:', error);
            cardPrompt.innerText = 'An error occurred while generating your journaling prompt. Please try again.';
        }

        // Clear any existing meanings
        const existingMeanings = document.querySelector('.meanings-container');
        if (existingMeanings) {
            existingMeanings.remove();
        }

        const meaningsContainer = document.createElement('div');
        meaningsContainer.className = 'meanings-container';

        // Track selected meanings
        const selectedMeanings = new Set();

        if (card.meanings) {
            card.meanings.forEach(meaning => {
            const bubble = document.createElement('div');
            bubble.className = 'meaning-bubble';
            bubble.textContent = meaning.trim();

            // Add click listener to toggle selection
            bubble.addEventListener('click', () => {
                if (selectedMeanings.has(meaning.trim())) {
                selectedMeanings.delete(meaning.trim());
                bubble.classList.remove('selected');
                } else {
                selectedMeanings.add(meaning.trim());
                bubble.classList.add('selected');
                }
            });

            meaningsContainer.appendChild(bubble);
            });
        }

        // Append meaningsContainer after cardPrompt
        cardPrompt.insertAdjacentElement('afterend', meaningsContainer);

        // Safety checks
        if (!cardImage || !cardTitleElement || !cardPrompt || !cardHeaderElement) {
            console.error('UI elements for card display not found.');
            return;
        }

        if (cardImage && cardTitleElement && cardHeaderElement && cardPrompt && responseBox && saveButton) {
            // If the card is reversed, pre-set the transform so it appears upside down.
            if (isReversed) {
                cardImage.style.transform = 'rotateZ(180deg)';
                cardImage.classList.add('flip-reversed');
                cardImage.addEventListener('animationend', () => {
                cardImage.classList.remove('flip-reversed');
                }, { once: true });
            } else {
                cardImage.style.transform = 'rotateY(0deg)';
                cardImage.classList.add('flip');
                cardImage.addEventListener('animationend', () => {
                cardImage.classList.remove('flip');
                }, { once: true });
            }
            cardImage.src = card.image_data;
            cardImage.dataset.cardId = card.card_id;

            cardTitleElement.innerText = `${card.suit}: ${card.card_name} (${card.orientation})`;

            cardHeaderElement.classList.remove('hidden');
            cardTitleElement.classList.remove('hidden');
            promptSection.classList.remove('hidden');
            responseBox.classList.remove('hidden');
            saveButton.classList.remove('hidden');
        } else {
            console.error('UI elements for card display not found.');
        }
    }

    function resetCardUI() {
        const cardImage = document.getElementById('drawn-card');
        const cardTitleContainer = document.querySelector('.card-header');
        const promptSection = document.querySelector('.prompt-section');

        if (cardImage) {
            const deckBack = user && user.deck_back ? user.deck_back : 'image_back_4';
            cardImage.src = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/deck_backs/${deckBack}.png`;
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
});