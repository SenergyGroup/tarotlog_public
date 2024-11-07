document.getElementById('draw-card-btn').addEventListener('click', drawCard);
document.getElementById('save-response-btn').addEventListener('click', saveResponses);

async function drawCard() {
    try {
        const response = await fetch('http://localhost:3000/api/draw-card');
        if (!response.ok) {
            throw new Error('Failed to fetch card');
        }

        const randomCard = await response.json();

        const cardImage = document.getElementById('drawn-card');
        cardImage.src = randomCard.image_data;
        cardImage.dataset.cardId = randomCard.card_id; // Store card_id for later
        cardImage.classList.remove('hidden');

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
    } catch (error) {
        console.error('Error drawing card:', error);
    }
}

async function saveResponses() {
    const response1 = document.getElementById('response-1').value;
    const promptText = document.getElementById('card-prompt').innerText;
    const cardId = document.getElementById('drawn-card').dataset.cardId;
    const userId = 1; // Placeholder until authentication is implemented

    try {
        const response = await fetch('http://localhost:3000/api/save-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                card_id: cardId,
                prompt_text: promptText,
                response_text: `${response1}`.trim(),
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save response');
        }

        alert('Responses saved successfully!');
        clearResponseFields();
    } catch (error) {
        console.error('Error saving response:', error);
        alert('Failed to save responses.');
    }
}

function clearResponseFields() {
    document.getElementById('response-1').value = '';
}