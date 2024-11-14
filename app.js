require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const authRoutes = require('./routes/authRoutes');

// Neon Database Backend and API
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

// View engine
app.set('view engine', 'ejs');

// Sync user model with database
const sequelize = require('./config/database');
const User = require('./models/User');

sequelize.sync({ force: false }) // Set force to true to drop and recreate tables during development
  .then(() => console.log('Database synced'))
  .catch(err => console.error('Error syncing database:', err));

// Route to draw a random card
app.get('/api/draw-card', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tarot_cards ORDER BY RANDOM() LIMIT 1'
    );
    const card = result.rows[0];
    
    // Randomly determine orientation
    const isReversed = Math.random() < 0.5; // 50% chance for reversed

    // Add orientation and appropriate description to the response
    const cardWithOrientation = {
      ...card,
      orientation: isReversed ? 'Reversed' : 'Upright',
      description: isReversed ? card.description_reversed : card.description_upright,
    };

    res.json(cardWithOrientation);
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Route to save a response
app.post('/api/save-response', async (req, res) => {
  const { user_id, card_id, prompt_text, response_text } = req.body;

  if (!user_id || !card_id || !prompt_text || !response_text) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO responses (user_id, card_id, prompt_text, response_text, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
            [user_id, card_id, prompt_text, response_text]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: error.message || 'Database error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


//EJS Routes
app.get('/', (req, res) => res.render('home'));
app.get('/tarotlog', (req,res) => res.render('tarotlog'));
app.use(authRoutes);