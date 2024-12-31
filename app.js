require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const entriesController = require('./controllers/entriesController');
const { checkUser } = require('./middleware/authMiddleware');
const cleanupExpiredTokens = require('./tasks/cleanupExpiredTokens');


// Neon Database Backend and API
const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(checkUser);


// View engine
app.set('view engine', 'ejs');

// Sync user model with database
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

    // Validate the `card_id` exists in the database
    if (!card || !card.card_id) {
      throw new Error('Card ID missing in database response.');
    }

    // Debugging log for validation
    console.log('Fetched Card:', card);
    
    // Randomly determine orientation
    const isReversed = Math.random() < 0.5; // 50% chance for reversed

    // Add orientation and appropriate description to the response
    const cardWithOrientation = {
      ...card,
      orientation: isReversed ? 'Reversed' : 'Upright',
      description: isReversed ? card.description_reversed : card.description_upright,
      meanings: isReversed ? card.meaning_reversed.split(',') : card.meaning_upright.split(','),
    };

    res.json(cardWithOrientation);
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Route to save a response
app.post('/api/save-response', async (req, res) => {
  const { user_id, card_id, prompt_text, response_text, orientation } = req.body;
  console.log('Received Payload:', req.body);

  if (!user_id || !card_id || !prompt_text || !response_text || !orientation) {
    console.error('Missing required fields:', req.body);
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Validate `card_id` matches a record in `tarot_cards`
    const cardExists = await pool.query('SELECT 1 FROM tarot_cards WHERE card_id = $1', [card_id]);
    if (cardExists.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    const result = await pool.query(
      `INSERT INTO responses (user_id, card_id, prompt_text, response_text, created_at, updated_at, orientation)
             VALUES ($1, $2, $3, $4, NOW(), NOW(),  $5) RETURNING *`,
            [user_id, card_id, prompt_text, response_text, orientation]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: error.message || 'Database error' });
  }
});

const dataController = require('./controllers/dataController'); 
const storeController = require('./controllers/storeController');

//EJS Routes
app.get('/', (req, res) => res.render('home'));
app.get('/tarot', (req, res) => {
  res.render('tarot', { user: res.locals.user });
});

// Route files
app.use('/auth', authRoutes);
app.use('/entries', entriesController);
app.use('/data', dataController);
app.get('/store', storeController.store_get);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).send('Something broke!');
});

// Runing cleanup handler
cleanupExpiredTokens();



// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});