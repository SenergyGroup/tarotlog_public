const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true, // Automatically generates a unique ID
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Username is required' },
        notEmpty: { msg: 'Username cannot be empty' }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Email is required' },
        isEmail: { msg: 'Please enter a valid email' }, // Sequelize built-in email validator
        isLowercase: true // Ensure email is lowercase
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Password is required' },
        len: {
          args: [6, 100], // Minimum length of 6 characters
          msg: 'Minimum password length is 6 characters'
        }
      },
      field: 'password_hash'
    }
}, {
    tableName: 'users', 
    timestamps: true,
    hooks: {
      // Hash password before saving the user (on create and update)
      beforeCreate: async (user) => {
        console.log('Before create hook:', user);
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) { // Hash only if password has been updated
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

// static method to login user
User.login = async function(email, password){
  const user = await User.findOne({ where: { email } });

  if (!user) {
    throw new Error('No email associated with account.');
  }

  const auth = await bcrypt.compare(password, user.password); // Compare provided password with hashed password
  
  if (!auth) {
    throw new Error('Incorrect password.');
  }

  return user;
};


module.exports = User;