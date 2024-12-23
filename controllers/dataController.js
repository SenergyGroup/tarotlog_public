const express = require('express');
const { pool } = require('../config/database'); // Ensure database connection
const { checkUser } = require('../middleware/authMiddleware'); // For authentication

const router = express.Router();

router.get('/', checkUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // Mock data for now or query the database
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

        res.render('data', { data });
    } catch (err) {
        console.error('Error in /data route:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
