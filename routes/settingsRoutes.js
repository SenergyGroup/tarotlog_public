const express = require('express');
const router = express.Router();
const { updateGeneralSettings, getUserSettings, downloadUserData  } = require('../controllers/settingsController');
const { checkUser } = require('../middleware/authMiddleware'); // Ensure user is authenticated
const User = require('../models/User');

router.get('/', checkUser, async (req, res) => {
    try {
      // Fetch user data
        const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
        if (!userId) {
          return res.redirect('/');
        }
        const foundUser = await User.findOne({
            where: { user_id: userId },
            attributes: ['focus', 'deck_preference', 'deck_back']
        });

        res.render('settings', {
          focus: foundUser?.focus,
          deck_preference: foundUser?.deck_preference,
          deck_back: foundUser?.deck_back
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error rendering settings');
    }
  });

// Route to get user settings
router.get('/general', checkUser, getUserSettings);

// Route to update general settings
router.post('/general', checkUser, updateGeneralSettings);

router.get('/download-data', checkUser, downloadUserData);

module.exports = router;
