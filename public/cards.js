function loadTopCards() {
    const container = document.getElementById('topCardsContainer');
    container.innerHTML = '<p>Loading top cards...</p>';
    
    fetch('/api/top-cards')
      .then(response => response.json())
      .then(data => {
        const container = document.getElementById('topCardsContainer');

        if (!data.length) {
          container.innerHTML = '<p>No entries found yet.</p>';
        } else {
          let html = '';
          data.forEach(card => {
            html += `
              <div class="card" onclick="openModal('${card.card_id}')">
              <div class="card-content">
                <img src="${card.image_url}" alt="${card.card_name}">
                <h3>${card.card_name}</h3>
              </div>
              <div class="card-footer">
                <p>Total entries: ${card.total_entries}</p>
              </div>
              </div>
            `;
          });
          container.innerHTML = html;
        }
      })
      .catch(error => {
        console.error('Error fetching top cards:', error);
        container.innerHTML = '<p>Error loading top cards.</p>';
      });
  }

// Example in cardGlossary.js
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const navItems = document.querySelectorAll('.settings-nav li');
    const sections = document.querySelectorAll('.settings-section');
  
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));
  
        item.classList.add('active');
        const sectionId = item.getAttribute('data-section');
        document.getElementById(sectionId).classList.add('active')

        if (sectionId === 'top') {
            loadTopCards();
        }
      });
    });
  });
  
  // Modal logic
  const modal = document.getElementById('cardModal');
  const modalText = document.getElementById('modal-text');
  
  function openModal(cardId) {
    const modalTextEl = document.getElementById('modal-text');
    modalTextEl.innerHTML = '';
  
    const cardElement = document.querySelector(`[onclick="openModal('${cardId}')"]`);
    if (!cardElement) return;
  
    const cardName = cardElement.getAttribute('data-name') || 'Unknown Card';
    const descriptionUpright = cardElement.getAttribute('data-upright') || '';
    const descriptionReversed = cardElement.getAttribute('data-reversed') || '';
  
    // Build initial modal content
    let modalContent = `<h2 class="modal-title">${cardName}</h2>`;
    if (descriptionUpright) {
      modalContent += `<p><strong>Upright:</strong> ${descriptionUpright}</p>`;
    }
    if (descriptionReversed) {
      modalContent += `<p><strong>Reversed:</strong> ${descriptionReversed}</p>`;
    }
    modalTextEl.innerHTML = modalContent;
  
    // Fetch entry counts
    fetch(`/api/card-entry-count/${cardId}`)
      .then(response => response.json())
      .then(data => {
        let uprightCount = 0, reversedCount = 0;
  
        data.forEach(entry => {
          // Handle null or extra spaces
          const orientationStr = (entry.orientation || '').trim().toLowerCase();
          if (orientationStr === 'upright') {
            uprightCount += parseInt(entry.entry_count, 10);
          } else if (orientationStr === 'reversed') {
            reversedCount += parseInt(entry.entry_count, 10);
          } else {
            console.warn('Unknown orientation:', entry.orientation);
          }
        });
  
        const countsHtml = `
          <h4>Entry Counts:</h4>
          <div class="entry-counts">
            <span class="upright-count">Upright: ${uprightCount}</span>
            <span class="reversed-count">Reversed: ${reversedCount}</span>
          </div>
        `;
        modalTextEl.innerHTML += countsHtml;
      })
      .catch(error => {
        console.error('Error fetching entry counts:', error);
        // Show 0 if there's an error
        const errorHtml = `
          <h4>Entry Counts:</h4>
          <div class="entry-counts">
            <span class="upright-count">Upright: 0</span>
            <span class="reversed-count">Reversed: 0</span>
          </div>
        `;
        modalTextEl.innerHTML += errorHtml;
      });
  
    // Show modal
    document.getElementById('cardModal').style.display = 'flex';
  }
  
  
  function closeModal() {
    document.getElementById('cardModal').style.display = 'none';
  }
  
  // Close if user clicks outside content
  window.onclick = function(event) {
    if (event.target === modal) {
      closeModal();
    }
  };