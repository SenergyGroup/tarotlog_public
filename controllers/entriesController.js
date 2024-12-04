const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // PostgreSQL connection pool


// Fetch entries for logged-in user with optional filters
router.get('/entries', async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from JWT
        const { filter } = req.query; // Get the filter parameter from query string
        let query;
        let params = [userId];

        // Default query: Most Recent
        query = `
            SELECT 
                r.response_id, r.prompt_text, r.response_text, r.created_at, 
                t.card_name 
            FROM responses r 
            JOIN tarot_cards t ON r.card_id = t.card_id 
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC`;

        // Apply filtering based on the filter value
        if (filter === 'oldest') {
            query = `
                SELECT 
                    r.response_id, r.prompt_text, r.response_text, r.created_at, 
                    t.card_name 
                FROM responses r 
                JOIN tarot_cards t ON r.card_id = t.card_id 
                WHERE r.user_id = $1
                ORDER BY r.created_at ASC`;
        } else if (filter === 'card') {
            query = `
                SELECT 
                    r.response_id, r.prompt_text, r.response_text, r.created_at, 
                    t.card_name 
                FROM responses r 
                JOIN tarot_cards t ON r.card_id = t.card_id 
                WHERE r.user_id = $1
                ORDER BY t.card_name ASC`;
        }

        // Execute query
        const { rows } = await pool.query(query, params);

        // Return the results as JSON
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;