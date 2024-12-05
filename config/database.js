const { Sequelize } = require('sequelize');

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

module.exports = sequelize;


const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false },
});

module.exports = pool;