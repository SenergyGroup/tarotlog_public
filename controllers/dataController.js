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

        const suitQuery = `
            SELECT t.suit, COUNT(*) as count
            FROM responses r
            JOIN tarot_cards t ON r.card_id = t.card_id
            WHERE r.user_id = $1
            GROUP BY t.suit;
        `;

        const moodQuery = `
            SELECT created_at, mood 
            FROM responses 
            WHERE user_id = $1 
            ORDER BY created_at ASC;
        `;


        const [suitResult, moodResult] = await Promise.all([
            pool.query(suitQuery, [userId]),
            pool.query(moodQuery, [userId])
        ]);

        res.render('data', { 
            suitsData: suitResult.rows,
            moodsData: moodResult.rows 
        });
    } catch (err) {
        console.error('Error in /data route:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});
  

module.exports = router;
