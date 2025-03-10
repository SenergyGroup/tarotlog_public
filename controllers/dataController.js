const express = require('express');
const { pool } = require('../config/database'); // Ensure database connection
const { checkUser } = require('../middleware/authMiddleware'); // For authentication

const router = express.Router();

router.get('/', checkUser, async (req, res) => {
    try {
        const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
        if (!userId) return res.redirect('/');

        // Retrieve any query params (start, end, monthly)
        let { start, end } = req.query;

        if (!start) {
            const now = new Date();
            // Create date like YYYY-MM-01
            const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            start = firstDayCurrentMonth.toISOString().split('T')[0]; 
          }
        
        // If no end date, use the current day
        if (!end) {
            const now = new Date();
            end = now.toISOString().split('T')[0];
        }

        // Daily data query, constrained by start/end
            const moodQuery = `
            SELECT created_at AS date, mood
            FROM responses
            WHERE user_id = $1
            AND created_at::date BETWEEN $2 AND $3
            ORDER BY created_at ASC
        `;

        // Provide userId, start, end
        const moodResult = await pool.query(moodQuery, [userId, start, end]);

        const suitQuery = `
            SELECT t.suit, COUNT(*) as count
            FROM responses r
            JOIN tarot_cards t ON r.card_id = t.card_id
            WHERE r.user_id = $1
            GROUP BY t.suit;
        `;

        const suitResult = await pool.query(suitQuery, [userId]);

        res.render('data', {
            suitsData: suitResult.rows,
            moodsData: moodResult.rows,
            start,
            end,
          });
    } catch (err) {
        console.error('Error in /data route:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/api/calendar-entries', checkUser, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
      /*
        1) Query daily counts from the DB
           E.g.: SELECT CAST(created_at AS DATE) as day, COUNT(*) as entries
                 FROM responses
                 WHERE user_id = $1
                 GROUP BY 1
                 ORDER BY 1
      */
      const sql = `
        SELECT CAST(created_at AS DATE) AS day, COUNT(*) AS total
        FROM responses
        WHERE user_id = $1
        GROUP BY 1
        ORDER BY 1;
      `;
      const { rows } = await pool.query(sql, [userId]);
  
      /*
        2) Transform the result into an object keyed by YYYY-MM-DD,
           where the value is a numeric count.
           Example: { '2025-01-01': 2, '2025-01-02': 0, ... }
      */
        const dataArray = rows.map(row => {
        // Ensure we have a proper Date object (row.day might be a string)
        const dateObj = new Date(row.day);
        if (isNaN(dateObj)) return null;
        // Convert to UNIX timestamp in seconds
        const timestamp = Math.floor(dateObj.getTime() / 1000);
        return { timestamp: timestamp, value: Number(row.total) };
        }).filter(Boolean);

      // Return the object as JSON
      res.json(dataArray);
    } catch (err) {
      console.error('Error in /api/calendar-entries route:', err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  

module.exports = router;
