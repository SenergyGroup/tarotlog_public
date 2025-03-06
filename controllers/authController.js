const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// JWT function
const maxAge = 7 * 24 * 60 * 60;
const maxAgeCookie = maxAge * 1000;

// Helper to set the JWT cookie dynamically
const setJwtCookie = (req, res, token, maxAgeCookieValue) => {
  const cookieOptions = {
    httpOnly: true,
    maxAge: maxAgeCookieValue,
    secure: true,
    sameSite: 'lax'
  };

  // If running on your custom domain, set the domain option.
  if (req.hostname && req.hostname.includes('www.mytarottales.com')) {
    cookieOptions.domain = 'www.mytarottales.com';
  }
  
  res.cookie('jwt', token, cookieOptions);
};

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: maxAge,
  });
};

// Render signup page
const signup_get = (req, res) => {
  res.render('signup');
};

// Render login page
const login_get = (req, res) => {
  res.render('login', { resetSuccess: req.query.resetSuccess });
};

// Handle signup
const signup_post = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userData = { 
      username, 
      email: email.trim().toLowerCase(), 
      password 
    };
    const newUser = await User.create(userData);
    const token = createToken(newUser.user_id);
    setJwtCookie(req, res, token, maxAgeCookie);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('Signup error details:', error);
    let errors = {};

    if (error.name === 'SequelizeValidationError') {
      error.errors.forEach((err) => {
        errors[err.path] = err.message;
      });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      error.errors.forEach((errorItem) => {
        if (errorItem.path === 'email') {
          errors.email = 'This email is already registered';
        } else if (errorItem.path === 'username') {
          errors.username = 'This username is already taken';
        }
      });
    }

    res.status(400).json({ errors });
  }
};

// Handle login
const login_post = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.login(email, password);
    const token = jwt.sign({ id: user.user_id, username: user.username }, process.env.JWT_SECRET, { expiresIn: maxAge });
    setJwtCookie(req, res, token, 3 * 24 * 60 * 60 * 1000);
    res.status(200).json({ userID: user.user_id, username: user.username });
  } catch (err) {
    if (err.message.includes('No email associated')) {
      return res.status(401).json({ error: 'Email not found.' });
    } else if (err.message.includes('Incorrect password')) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
};

// Log out
const logout = (req, res) => {
  try {
    setJwtCookie(req, res, '', 1);
    res.redirect('/');
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ message: 'Error during logout' });
  }
};

// Forgot Password
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Generate token
const generateToken = () => crypto.randomBytes(32).toString('hex');

const forgotPassword_post = async (req, res) => {
  const { email } = req.body;
  try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        console.error('No user found with this email:', email);
        return res.status(400).send('No user with this email found.');
      }

      const token = generateToken();
      user.resetToken = token;
      user.tokenExpiration = Date.now() + 3600000; // 1-hour expiration
      await user.save();

      const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });

      await transporter.sendMail({
          from: `"TarotLog" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Password Reset Request',
          html:  `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #4CAF50;">TarotLog Password Reset</h2>
              <p>Hello,</p>
              <p>You requested a password reset. Click the button below to reset your password:</p>
              <a href="http://${req.headers.host}/auth/reset-password/${token}" style="display: inline-block; padding: 10px 20px; margin: 10px 0; color: white; background-color: #4CAF50; text-decoration: none; border-radius: 5px;">Reset Password</a>
              <p>If you didn’t request this, please ignore this email. This link will expire in 1 hour.</p>
              <p>Thanks,<br>The TarotLog Team</p>
          </div>
      `,
      });

      res.redirect('/auth/forgot-password?success=true');
  } catch (err) {
      console.error(err);
      res.status(500).send('Error sending email.');
  }
};


const resetPassword_get = async (req, res) => {
  const { token } = req.params;

    try {
        const user = await User.findOne({
            where: {
                resetToken: token,
                tokenExpiration: { [Op.gt]: Date.now() }, // Check if token is still valid
            },
        });

        if (!user) {
            return res.status(400).send('Token is invalid or expired.');
        }

        res.render('resetPassword', { token }); // Pass the token to the view
    } catch (err) {
        console.error('Error during reset password:', err);
        res.status(500).send('Internal Server Error');
    }
};

const resetPassword_post = async (req, res) => {
  const { token, password } = req.body;
  try {
      const user = await User.findOne({ 
        where: { 
          resetToken: token, 
          tokenExpiration: { [Op.gt]: Date.now() },
        },
      });
      if (!user) return res.status(400).send('Token invalid or expired.');

      user.password = password; // Will trigger bcrypt hashing via model hooks
      user.resetToken = null;
      user.tokenExpiration = null;
      await user.save();

      res.redirect('/auth/login?resetSuccess=true');
  } catch (err) {
      console.error(err);
      res.status(500).send('Error resetting password.');
  }
};

const forgotPassword_get = (req, res) => {
  res.render('forgotPassword', { success: req.query.success });
};

module.exports = {
  signup_get,
  login_get,
  signup_post,
  login_post,
  logout,
  forgotPassword_get,
  forgotPassword_post,
  resetPassword_get,
  resetPassword_post,
};