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
      console.error("[ERROR] User is not authenticated.");
      return res.redirect('/');
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

      const totalResponsesQuery = `
        SELECT COUNT(*) AS total_responses
        FROM responses
        WHERE user_id = $1
      `;
      const totalResponsesResult = await pool.query(totalResponsesQuery, [userId]);
      const totalResponses = totalResponsesResult.rows[0].total_responses;

      // Query to count responses (journals) for the current month.
      const monthResponsesQuery = `
        SELECT COUNT(*) AS month_responses
        FROM responses
        WHERE user_id = $1
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `;
      const monthResponsesResult = await pool.query(monthResponsesQuery, [userId]);
      const monthResponses = monthResponsesResult.rows[0].month_responses;

      // Query to get the average mood for responses this month.
      const averageMoodQuery = `
        SELECT AVG(mood) AS avg_mood
        FROM responses
        WHERE user_id = $1
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `;
      const averageMoodResult = await pool.query(averageMoodQuery, [userId]);
      const avgMood = averageMoodResult.rows[0].avg_mood;
      const formattedAvgMood = avgMood ? Number(avgMood).toFixed(1) : null;

      // Query to determine the most pulled card for the user.
      const mostPulledCardQuery = `
        SELECT tc.card_name, COUNT(*) AS count
        FROM responses r
        JOIN tarot_cards tc ON r.card_id = tc.card_id
        WHERE r.user_id = $1
        GROUP BY tc.card_name
        ORDER BY count DESC
        LIMIT 1
      `;
      const mostPulledCardResult = await pool.query(mostPulledCardQuery, [userId]);
      const mostPulledCard = mostPulledCardResult.rows.length ? mostPulledCardResult.rows[0].card_name : null;

      // Query for today's daily card
      const today = new Date().toISOString().slice(0, 10);
      const dailyCardQuery = `
        SELECT dc.date, dc.mottos, tc.*
        FROM daily_card dc
        JOIN tarot_cards tc ON dc.card_id = tc.card_id
        WHERE dc.date = $1
      `;
      let dailyCardResult = await pool.query(dailyCardQuery, [today]);
      let dailyCard = dailyCardResult.rows.length ? dailyCardResult.rows[0] : null;

      // If no daily card exists for today, populate it with an initial card
      if (!dailyCard) {
        console.log("No daily card found for today. Inserting initial card...");
        const cardResult = await pool.query('SELECT * FROM tarot_cards ORDER BY RANDOM() LIMIT 1');
        if (cardResult.rows.length) {
          const card = cardResult.rows[0];
          const cardMotto = card.mottos || "Your journey awaits"; // Default if missing
          await pool.query(
            'INSERT INTO daily_card (date, card_id, mottos ) VALUES ($1, $2, $3)',
            [today, card.card_id, cardMotto]
          );
          // Retrieve the inserted daily card
          dailyCardResult = await pool.query(
            `SELECT dc.date, dc.mottos, tc.*
            FROM daily_card dc
            JOIN tarot_cards tc ON dc.card_id = tc.card_id
            WHERE dc.date = $1`, [today]
          );
          dailyCard = dailyCardResult.rows.length ? dailyCardResult.rows[0] : null;
        } else {
          console.error("Error: No card found in the tarot_cards table to set as daily card.");
        }
      }

      // Update dailyCard image_data based on the user's current deck preference
      if (dailyCard) {
        const deckQuery = `SELECT deck_preference FROM users WHERE user_id = $1`;
        const deckResult = await pool.query(deckQuery, [userId]);
        const userDeck = deckResult.rows[0]?.deck_preference || 'rider_white';
        // Use the card_id as the card number
        const cardNumber = dailyCard.card_id;
        const imageURL = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;
        dailyCard.image_data = imageURL;
      }

      // Get the 5 latest entries (date + card name).
        const latestFiveQuery = `
        SELECT r.created_at, tc.card_name
        FROM responses r
        JOIN tarot_cards tc ON r.card_id = tc.card_id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT 5
      `;
      const latestFiveResult = await pool.query(latestFiveQuery, [userId]);
      const latestEntries = latestFiveResult.rows; // Could be 0 to 5 records

      // Also get the single most recent
      const singleLatestQuery = `
        SELECT r.prompt_text, r.response_text, r.created_at, tc.card_name
        FROM responses r
        JOIN tarot_cards tc ON r.card_id = tc.card_id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1
      `;
      const singleLatestResult = await pool.query(singleLatestQuery, [userId]);
      let latestEntry = singleLatestResult.rows[0] || null;
      if (latestEntry) {
        try {
          latestEntry.response_text = decrypt(latestEntry.response_text);
        } catch (err) {
          console.error("Error decrypting response_text:", err);
          latestEntry.response_text = '[Error decrypting response]';
        }
      }
  
      // Render the dashboard and pass the computed daily streak
      res.render('dashboard', { 
        dailyStreak,
        totalResponses,
        monthResponses,
        formattedAvgMood,
        mostPulledCard,
        dailyCard,
        latestEntries,
        latestEntry
      });
      
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
