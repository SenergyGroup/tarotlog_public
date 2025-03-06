const express = require('express');
const router = express.Router();
const { updateGeneralSettings, getUserSettings } = require('../controllers/settingsController');
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
            attributes: ['focus']
        });

        res.render('settings', { focus: foundUser?.focus });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error rendering settings');
    }
  });

// Route to get user settings
router.get('/general', checkUser, getUserSettings);

// Route to update general settings
router.post('/general', checkUser, updateGeneralSettings);

module.exports = router;
