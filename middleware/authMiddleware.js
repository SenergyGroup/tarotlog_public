const jwt = require('jsonwebtoken');

const checkUser = (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
      if (err) {
        console.log(err.message);
        res.locals.user = null;
        next();
      } else {
        res.locals.user = { id: decodedToken.id, username: decodedToken.username };
        next();
      }
    });
  } else {
    res.locals.user = null;
    next();
  }
};

module.exports = { checkUser };
