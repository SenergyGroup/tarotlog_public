// controllers/feedbackController.js
const { pool } = require('../config/database');

// Handle feedback submission
const submitFeedback = async (req, res) => {
  const { feedback, user_id } = req.body;

  if (!feedback) {
    return res.status(400).json({ error: 'Please enter feedback or navigate back to the main app.' });
  }

  try {
    // Insert feedback into a 'feedback' table (make sure this table exists in your database)
    const result = await pool.query(
      `INSERT INTO feedback (user_id, feedback, created_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [user_id || null, feedback]
    );

    return res.status(201).json({
      message: 'Thank you for your feedback!',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({ error: 'Unable to submit feedback right now. Please try again later.' });
  }
};

module.exports = { submitFeedback };
