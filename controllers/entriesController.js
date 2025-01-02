const express = require('express');
const router = express.Router();
const { pool } = require('../config/database'); // PostgreSQL connection pool
const { checkUser: authenticateToken } = require('../middleware/authMiddleware');



// Fetch entries for logged-in user with optional filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from JWT
        const filter = req.query.filter || 'most-recent'; // Get the filter parameter from query string
        const searchQuery = req.query.search ? `%${req.query.search}%` : null;

        let query;
        let params = [userId];

        // Default query: Most Recent
        query = `
            SELECT 
                r.response_id, r.prompt_text, r.response_text, r.created_at, r.orientation,
                t.card_name, r.mood
            FROM responses r 
            JOIN tarot_cards t ON r.card_id = t.card_id 
            WHERE r.user_id = $1
        `;

        // Add search condition if provided
        if (searchQuery) {
            query += ` AND (r.prompt_text ILIKE $2 OR r.response_text ILIKE $2)`;
            params.push(searchQuery);
        }

        // Apply filtering based on the filter value
        if (filter === 'oldest') {
            query += ` ORDER BY r.created_at ASC`;
        } else if (filter === 'card') {
            query += ` ORDER BY t.card_id ASC`;
        } else {
            query += ` ORDER BY r.created_at DESC`;
        }
       
        // Execute query
        const { rows } = await pool.query(query, params);

        // Process rows to parse the prompt text
        rows.forEach(row => {
            const cleanedPrompt = row.prompt_text.replace(/\s+/g, ' ').trim();

            // Check for "Journaling Prompt:" in the cleaned string
            const promptIndex = cleanedPrompt.indexOf('Journaling Prompt: ');
            if (promptIndex !== -1) {
                // Extract everything after "Journaling Prompt: "
                row.parsed_prompt_text = cleanedPrompt.substring(promptIndex + 'Journaling Prompt: '.length).trim();
            } else {
                // Default to the full text if no "Journaling Prompt:" found
                row.parsed_prompt_text = cleanedPrompt;
            }
        });

        if (rows.length === 0) {
            console.log('No entries found for user:', userId);
            return res.render('entries', { entries: [], user: req.user });
        }

        if (req.headers['content-type'] === 'application/json') {
            // Respond with JSON if the request comes from fetch
            return res.json(rows);
        } else {
            // Render HTML for regular browser requests
            return res.render('entries', { entries: rows, user: req.user });
        }

    } catch (err) {
        console.error('Error fetching entries:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;