const User = require('../models/User'); // Your User model
const { checkUser } = require('../middleware/authMiddleware'); // Ensures authentication


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
  

module.exports = { updateGeneralSettings, getUserSettings };
  