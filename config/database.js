const { Sequelize } = require('sequelize');
const { Pool } = require('pg');

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
});

sequelize
  .authenticate()
  .then(() => console.log('Connection established with PostgreSQL'))
  .catch(err => console.error('Unable to connect to PostgreSQL:', err));


// Initialize pg Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false },
});

module.exports = { sequelize, pool };