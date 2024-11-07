require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Neon Backend
const http = require("http");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const requestHandler = async (req, res) => {
  const result = await sql`SELECT version()`;
  const { version } = result[0];
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(version);
};

http.createServer(requestHandler).listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});


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

  try {
    const result = await pool.query(
      `INSERT INTO responses (user_id, card_id, prompt_text, response_text, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [user_id, card_id, prompt_text, response_text]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

console.log('Database URL:', process.env.DATABASE_URL);


// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
