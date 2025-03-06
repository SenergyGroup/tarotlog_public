const jwt = require('jsonwebtoken');

const checkUser = (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
      if (err) {
        console.log('JWT error:', err.message);
        res.locals.user = null;
        req.user = null
      } else {
        res.locals.user = { id: decodedToken.id, username: decodedToken.username };
        req.user = { id: decodedToken.id, username: decodedToken.username };
      }
      next();
    });
  } else {
    res.locals.user = null;
    req.user = null;
    next();
  }
};

module.exports = { checkUser };
