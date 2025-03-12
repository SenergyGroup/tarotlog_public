const { Router }    = require('express')
const authController = require('../controllers/authController');

const router = Router()

router.get('/signup', authController.signup_get);
router.post('/signup', authController.signup_post);
router.get('/login', authController.login_get);
router.post('/login', authController.login_post);
router.get('/tarot', (req, res) => {
    res.render('tarot', { user: res.locals.user }); 
});
router.get('/logout', authController.logout);

router.get('/forgot-password', authController.forgotPassword_get);
router.post('/forgot-password', authController.forgotPassword_post);
router.get('/reset-password/:token', authController.resetPassword_get);
router.post('/reset-password', authController.resetPassword_post);

// Change password
router.get('/change-password', authController.changePassword_get);

module.exports = router