const User = require('../models/User'); // Your User model
const { checkUser } = require('../middleware/authMiddleware'); // Ensures authentication
const { pool } = require('../config/database');
const { Parser } = require('json2csv');
const { decrypt } = require('../utils/encryption');


const updateGeneralSettings = async (req, res) => {
    const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
        if (!userId) {
          console.error("[ERROR] User is not authenticated.");
          return res.status(401).json({ error: "User not authenticated" });
        }
  
    const { focus, deck_preference, deck_back } = req.body;

    try {
      // Update both 'focus' and 'deck_preference' columns
      await User.update(
        { 
          focus, 
          deck_preference,
          deck_back,
        },
        { where: { user_id: userId } }
      );
  
      res.redirect('/settings');
    } catch (error) {
      console.error('Error updating general settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  };
  

const getUserSettings = async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findOne({
        where: { user_id: userId },
        attributes: ['focus', 'deck_preference', 'deck_back']
        });

        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }

        // Render settings.ejs and pass the user's focus + deck_preference
        res.render('settings', {
          focus: user.focus,
          deck_preference: user.deck_preference,
          deck_back: user.deck_back
        });
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
};


const downloadUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    const responsesResult = await pool.query(
      `SELECT r.response_id, r.prompt_text, r.response_text, r.created_at, r.orientation, t.card_name 
       FROM responses r 
       JOIN tarot_cards t ON r.card_id = t.card_id 
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const responses = responsesResult.rows.map(row => {
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

    // Convert responses to CSV using json2csv
    const fields = ['response_id', 'prompt_text', 'response_text', 'created_at', 'orientation', 'card_name'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(responses);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('my_data.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Error downloading data:', error);
    res.status(500).send('Error downloading data');
  }
};
  

module.exports = { updateGeneralSettings, getUserSettings, downloadUserData };
  