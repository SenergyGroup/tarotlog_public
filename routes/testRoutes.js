const express = require('express');
const router = express.Router();

// Route for test draw page
router.get('/draw', (req, res) => {
    res.render('testDraw', { user: res.locals.user });
});

// Route for test journal page
router.get('/journal', (req, res) => {
    res.render('testJournal', { user: res.locals.user });
});

module.exports = router;
