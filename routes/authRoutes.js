const { Router }    = require('express')
const authConroller = require('../controllers/authController')

const router = Router()

router.get('/signup', authConroller.signup_get)
router.post('/signup', authConroller.signup_post)
router.get('/login', authConroller.login_get)
router.post('/login', authConroller.login_post)
router.get('/tarot', (req, res) => {
    res.render('tarot', { user: res.locals.user }); 
  });
router.get('/entries', (req, res) => {
  res.render('tarot', { user: res.locals.user }); 
});

module.exports = router