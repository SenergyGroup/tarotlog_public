const User = require('../models/User');
const jwt = require('jsonwebtoken');

// JWT function
const maxAge = 7 *24 * 60 * 60
const maxAgeCookie = maxAge * 1000
const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: maxAge
    })
}



module.exports.signup_get = (req, res) => {
    res.render('signup');
}


module.exports.login_get = (req, res) => {
    res.render('login');
}


module.exports.signup_post = async (req, res) => {
    const { username, email, password} = req.body;

    try {
        // Attempt to create a new user
        const userData = { username, email, password };
        const newUser = await User.create(userData);
        const token = createToken(newUser.id);
        res.cookie('jwt', token, { httpOnly: true, maxAgeCookie});
        res.status(201).json({ message: 'User created successfully', user: newUser });

      } catch (error) {
        let errors = {};

        // Catch validation or uniqueness errors
        if (error.name === 'SequelizeValidationError') {
            error.errors.forEach(err => {
                errors[err.path] = err.message;
            });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            errors.email = 'This email is already registered';
        }

        res.status(400).json({ errors });
      }
      
};


module.exports.login_post = (req, res) => {
    const { email, password} = req.body;

    console.log(email, password);

    res.send('user login')
}