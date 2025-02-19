const User = require('../models/User'); // Your User model
const { checkUser } = require('../middleware/authMiddleware'); // Ensures authentication


const updateGeneralSettings = async (req, res) => {
    const { focus } = req.body;
    const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
        if (!userId) {
          console.error("[ERROR] User is not authenticated.");
          return res.status(401).json({ error: "User not authenticated" });
        }
  
    try {
      await User.update({ focus }, { where: { user_id: userId } });
  
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
        attributes: ['focus'] // Add more fields if necessary
        });

        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
};
  

module.exports = { updateGeneralSettings, getUserSettings };
  