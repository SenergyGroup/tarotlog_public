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
    console.log('Request body:', req.body);
    const { user: username, email, password} = req.body;
    console.log('Extracted fields:', { username, email, password });

    try {
        // Attempt to create a new user
        const userData = { username, email, password };
        console.log('Data passed to User.create:', userData); // Log data before creating
        const newUser = await User.create(userData);
        console.log('User created:', newUser);
        const token = createToken(newUser.id);
        res.cookie('jwt', token, { httpOnly: true, maxAgeCookie});
        res.status(201).json({ message: 'User created successfully', user: newUser });

      } catch (error) {
        console.error('Error creating user:', error);
        // Catch validation or uniqueness errors
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => ({
                message: err.message,
                path: err.path,
                value: err.value
              }));
          return res.status(400).json({ errors });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email is already registered' });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
      
}


module.exports.login_post = (req, res) => {
    const { email, password} = req.body;

    console.log(email, password);

    res.send('user login')
}