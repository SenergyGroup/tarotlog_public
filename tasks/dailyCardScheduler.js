// tasks/dailyCardScheduler.js
const cron = require('node-cron');
const { pool } = require('../config/database'); // Adjust the path if needed

cron.schedule('0 0 * * *', async () => { // Runs at midnight every day
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Check if today's card is already set
    const existing = await pool.query('SELECT * FROM daily_card WHERE date = $1', [today]);
    if (existing.rows.length === 0) {
      // Try to select a card that hasn't been used yet
      const cardResult = await pool.query(
        `SELECT * FROM tarot_cards
         WHERE card_id NOT IN (SELECT card_id FROM daily_card)
         ORDER BY RANDOM() LIMIT 1`
      );
      
      let card;
      if (cardResult.rows.length === 0) {
        // All cards have been used, so reset the cycle
        const resetResult = await pool.query(
          'SELECT * FROM tarot_cards ORDER BY RANDOM() LIMIT 1'
        );
        card = resetResult.rows[0];
      } else {
        card = cardResult.rows[0];
      }
      
      // Define your premade motto for the card (this can be static or generated dynamically)
      const cardMotto = "Your journey awaits"; 
      
      // Insert the new daily card record
      await pool.query(
        'INSERT INTO daily_card (date, card_id, card_motto) VALUES ($1, $2, $3)',
        [today, card.card_id, cardMotto]
      );
      console.log(`Daily card set for ${today}: Card ID ${card.card_id}`);
    }
  } catch (error) {
    console.error('Error setting daily card:', error);
  }
});
