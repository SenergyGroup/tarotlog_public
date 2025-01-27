const express = require('express');
const { pool } = require('../config/database'); // Ensure database connection
const { checkUser } = require('../middleware/authMiddleware'); // For authentication

const router = express.Router();

router.get('/', checkUser, async (req, res) => {
    try {
        const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
        if (!userId) {
          console.error("[ERROR] User is not authenticated.");
          return res.status(401).json({ error: "User not authenticated" });
        }

        const query = `
            SELECT t.suit, COUNT(*) as count
            FROM responses r
            JOIN tarot_cards t ON r.card_id = t.card_id
            WHERE r.user_id = $1
            GROUP BY t.suit;
        `;
        const { rows } = await pool.query(query, [userId]);

        // Mock data for now or query the database
        /*
        const data = {
        topCards: [
            { card_name: 'Placeholder Card 1', orientation: 'Upright', count: 10 },
            { card_name: 'Placeholder Card 2', orientation: 'Reversed', count: 8 },
            { card_name: 'Placeholder Card 3', orientation: 'Upright', count: 6 },
        ],
        totalEntries: 20,
        longestStreak: 5,
        totalWords: 1200,
        topTheme: 'Self-Reflection',
        };
        */

        res.render('data', { suitsData: rows });
    } catch (err) {
        console.error('Error in /data route:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});
  

module.exports = router;
