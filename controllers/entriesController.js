const express = require('express');
const router = express.Router();
const pool = require('../config/database'); // PostgreSQL connection pool
const { checkUser: authenticateToken } = require('../middleware/authMiddleware');


pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
    } else {
        console.log('Database connected successfully for entries. Current time:', res.rows[0].now);
    }
});


// Fetch entries for logged-in user with optional filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('User from JWT:', req.user);
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
                ORDER BY t.card_id ASC`;
        }

        // Execute query
        const { rows } = await pool.query(query, params);

        console.log('Fetched entries:', rows);

        if (rows.length === 0) {
            console.log('No entries found for user:', userId);
        }

        // Return the results as JSON
        console.log('Fetched entries:', rows);
        res.render('entries', { entries: rows, user: req.user });

    } catch (err) {
        console.error('Error fetching entries:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;