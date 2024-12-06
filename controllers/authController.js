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


module.exports.login_post = async (req, res) => {
    const { email, password} = req.body;

    try {
        const user = await User.login(email, password);
        const token = jwt.sign({ id: user.user_id, username: user.username }, process.env.JWT_SECRET, { expiresIn: maxAge });
        res.cookie('jwt', token, { httpOnly: true, maxAge: 3 * 24 * 60 * 60 * 1000 }); // Store token in a cookie

        res.status(200).json({ userID: user.user_id, username: user.username });
    }
    catch (err) {
        if (err.message.includes('No email associated')) {
            return res.status(401).json({ error: 'Email not found.' });
        } else if (err.message.includes('Incorrect password')) {
            return res.status(401).json({ error: 'Incorrect password.' });
        } 
        console.error('Login error:', err); // Log any unexpected errors
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};

// Log out
const logout = (req, res) => {
    try {
      // Clear the JWT cookie
      res.cookie('jwt', '', { httpOnly: true, maxAge: 1 }); // Set a past expiration
  
      // Optional: Update the database with the logout timestamp (replace User with your model)
      /*
      if (req.user && req.user.id) {
        // Assuming you have a User model with a method to update the logout time
        User.findByIdAndUpdate(req.user.id, { lastLogout: Date.now() })
          .then(() => {
            console.log("User's logout time updated");
          })
          .catch((err) => {
            console.error('Error updating logout time:', err);
          });
      }
        */
  
      // Redirect to home
      res.redirect('/');
    } catch (err) {
      console.error('Error during logout:', err);
      res.status(500).json({ message: 'Error during logout' });
    }
  };
  
  module.exports = { logout };