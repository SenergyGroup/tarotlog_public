const { Router }    = require('express')
const authController = require('../controllers/authController')

const router = Router()

router.get('/signup', authConroller.signup_get)
router.post('/signup', authConroller.signup_post)
router.get('/login', authConroller.login_get)
router.post('/login', authConroller.login_post)
router.get('/tarot', (req, res) => {
    res.render('tarot', { user: res.locals.user }); 
  });
router.get('/logout', authConroller.logout);

router.get('/forgot-password', authController.forgotPassword_get);
router.post('/forgot-password', authController.forgotPassword_post);
router.get('/reset-password/:token', authController.resetPassword_get);
router.post('/reset-password', authController.resetPassword_post);


module.exports = router