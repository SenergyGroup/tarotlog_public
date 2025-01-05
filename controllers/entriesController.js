const express = require('express');
const router = express.Router();
const { pool } = require('../config/database'); // PostgreSQL connection pool
const { checkUser: authenticateToken } = require('../middleware/authMiddleware');
const { decrypt } = require('../utils/encryption');


// Fetch entries for logged-in user with optional filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from JWT
        const filter = req.query.filter || 'most-recent'; // Get the filter parameter from query string
        const searchQuery = req.query.search ? `%${req.query.search}%` : null;

        const page = parseInt(req.query.page) || 1; // Get the page number, default to 1
        const limit = 10; // Number of entries per page
        const offset = (page - 1) * limit; // Calculate offset

        // Default query: Most Recent
        let query = `
            SELECT 
                r.response_id, r.prompt_text, r.response_text, r.created_at, r.orientation,
                t.card_name, r.mood
            FROM responses r 
            JOIN tarot_cards t ON r.card_id = t.card_id 
            WHERE r.user_id = $1
        `;
        let countQuery = `
            SELECT COUNT(*) AS total_entries
            FROM responses r 
            WHERE r.user_id = $1
        `;

        let params = [userId];

        // Add search condition if provided
        if (searchQuery) {
            query += ` AND (r.prompt_text ILIKE $2 OR r.response_text ILIKE $2)`;
            countQuery += ` AND (r.prompt_text ILIKE $2 OR r.response_text ILIKE $2)`;
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

        // Add pagination
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
       
        // Execute queries
        const [entriesResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params.slice(0, params.length - 2))
        ]);

        const totalEntries = parseInt(countResult.rows[0].total_entries);
        const totalPages = Math.ceil(totalEntries / limit);

        const decryptedRows = entriesResult.rows.map(row => {
            try {
                return {
                    ...row,
                    response_text: decrypt(row.response_text) // Decrypt all response_text
                };
            } catch (err) {
                console.error(`Failed to decrypt response_text for response_id ${row.response_id}:`, err);
                return {
                    ...row,
                    response_text: '[Error decrypting response]'
                };
            }
        });

        // Process rows to parse the prompt text
        decryptedRows.forEach(row => {
            const cleanedPrompt = row.prompt_text.replace(/\s+/g, ' ').trim();
            const promptIndex = cleanedPrompt.indexOf('Journaling Prompt: ');
            row.parsed_prompt_text = promptIndex !== -1
                ? cleanedPrompt.substring(promptIndex + 'Journaling Prompt: '.length).trim()
                : cleanedPrompt;
        });

        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            // Return JSON response for API requests
            return res.json({
                entries: decryptedRows,
                currentPage: page,
                totalPages,
                filter
            });
        } else {
            // Render the entries page for standard requests
            return res.render('entries', {
                entries: decryptedRows,
                user: req.user,
                currentPage: page,
                totalPages,
                filter
            });
        }

    } catch (err) {
        console.error('Error fetching entries:', err.stack);
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }
        res.status(500).send('<h1>Internal Server Error</h1>');
    }
});


module.exports = router;