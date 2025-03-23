document.addEventListener("DOMContentLoaded", () => {
    const feedbackButton = document.getElementById('feedback-button');
    const feedbackModal = document.getElementById('feedback-modal');
    const closeFeedback = document.getElementById('close-feedback');
    const feedbackSubmit = document.getElementById('feedback-submit');
    const feedbackInput = document.getElementById('feedback-input');
  
    // Open modal when persistent button is clicked
    feedbackButton.addEventListener('click', () => {
      feedbackModal.classList.remove('hidden');
    });
  
    // Close modal when the close icon is clicked
    closeFeedback.addEventListener('click', () => {
      feedbackModal.classList.add('hidden');
    });
  
    // Submit feedback (you can adjust this to send data to your server)
    feedbackSubmit.addEventListener('click', () => {
      const feedback = feedbackInput.value.trim();
      if (feedback) {
        // Example: send feedback to your server via fetch
        fetch('/api/submit-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback, user_id: user?.id }) // user variable passed in from server-side
        })
        .then(response => response.json())
        .then(data => {
          alert('Thank you for your feedback!');
          feedbackInput.value = '';
          feedbackModal.classList.add('hidden');
        })
        .catch(err => {
          console.error('Feedback submission error:', err);
        });
      } else {
        alert('Please enter your feedback before submitting.');
      }
    });
  
    // Auto-trigger feedback modal on specific events using localStorage
    // Example: trigger on second login
    /*
    let loginCount = Number(localStorage.getItem('loginCount') || 0) + 1;
    localStorage.setItem('loginCount', loginCount);
    if (loginCount === 2) {
      setTimeout(() => {
        feedbackModal.classList.remove('hidden');
      }, 2000); // show after 2 seconds
    }
    */
  });
  