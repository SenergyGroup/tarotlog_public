// dashboardController.js
const express = require('express');
const { pool } = require('../config/database');
const { checkUser } = require('../middleware/authMiddleware');
const { decrypt } = require('../utils/encryption');
const router = express.Router();

// Render the dashboard page without entry data
router.get('/', checkUser, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send('User not authenticated');
    }
    
    try {
      // Get all entries for the user ordered by date descending.
      const entriesQuery = `
        SELECT created_at 
        FROM responses 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const entriesResult = await pool.query(entriesQuery, [userId]);
      const entries = entriesResult.rows;
  
      // Function to compute the daily streak
      const computeDailyStreak = (entries) => {
        let streak = 0;
        // Start from today's date at midnight
        let day = new Date();
        day.setHours(0, 0, 0, 0);
        
        // Convert each entry date to its midnight timestamp
        const entryDates = entries.map(row => {
          const d = new Date(row.created_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        });
        
        // Remove duplicate dates in case the user made multiple entries in a day
        const uniqueDates = Array.from(new Set(entryDates));
        
        // While there's an entry for the day, increment the streak and go to the previous day
        while (uniqueDates.includes(day.getTime())) {
          streak++;
          day.setDate(day.getDate() - 1);
        }
        
        return streak;
      };
  
      const dailyStreak = computeDailyStreak(entries);
  
      // Render the dashboard and pass the computed daily streak
      res.render('dashboard', { dailyStreak });
    } catch (err) {
      console.error('Dashboard query error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

// API endpoint to fetch the latest entry
router.get('/latest-entry', checkUser, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  try {
    const query = `
      SELECT prompt_text, response_text, created_at
      FROM responses
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [userId]);
    let latestEntry = result.rows[0] || null;
    
    if (latestEntry) {
      try {
        // Decrypt the encrypted response_text
        latestEntry.response_text = decrypt(latestEntry.response_text);
      } catch (err) {
        console.error("Error decrypting response_text:", err);
        latestEntry.response_text = '[Error decrypting response]';
      }
    }
    
    res.json({ latestEntry });
  } catch (err) {
    console.error('Dashboard latest-entry query error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
