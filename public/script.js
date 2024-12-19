let drawnCard = null;

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = 'https://tarotlog-public.onrender.com';

    const drawCardBtn = document.getElementById('draw-card-btn');
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

                    const card = await response.json();
                    console.log('Fetched Card Data:', card);

                    updateCardUI(card);

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

            const payload = {
                user_id: user?.id,
                card_id: drawnCard.card_id,
                prompt_text: promptText,
                response_text: response1,
                orientation: drawnCard.orientation,
            };
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

    function updateCardUI(card) {
        drawnCard = card;

        const cardImage = document.getElementById('drawn-card');

        console.log('Searching for card-title element...');
        const cardTitleElement = document.getElementById('card-title');
        console.log('Found card-title element:', cardTitleElement);

        console.log('Searching for card-title element...');
        const cardHeaderElement = document.getElementById('card-header');
        console.log('Found card-title element:', cardHeaderElement);

        const cardPrompt = document.getElementById('card-prompt');
        const responseBox = document.getElementById('response-1');
        const saveButton = document.getElementById('save-response-btn');
        const promptSection = document.querySelector('.prompt-section');

        if (!cardImage || !cardTitleElement || !cardPrompt || !cardHeaderElement) {
            console.error('UI elements for card display not found.');
            return;
        }

        if (cardImage && cardTitleElement && cardHeaderElement && cardPrompt && responseBox && saveButton) {
            cardImage.src = card.image_data;
            cardImage.dataset.cardId = card.card_id;
            cardImage.style.transform = card.orientation === 'Reversed' ? 'rotate(180deg)' : 'rotate(0deg)';

            cardTitleElement.innerText = `${card.suit}: ${card.card_name} (${card.orientation})`;
            cardPrompt.innerText = card.orientation === 'Reversed' ? card.meaning_reversed : card.meaning_upright;

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
});