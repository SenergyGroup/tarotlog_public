// Render signup page
const testJournal_get = (req, res) => {
    res.render('testJournal');
  };

// Render signup page
const testDraw_get = (req, res) => {
    res.render('testDraw');
  };  


module.exports = {
    testJournal_get,
    testDraw_get
    };