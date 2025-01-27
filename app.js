const OpenAI = require("openai");
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
const { encrypt } = require('./utils/encryption');



// Neon Database Backend and API
const app = express();
const port = process.env.PORT || 3000;

//GPT API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Check current draw count
    const { rows } = await pool.query(
      'SELECT draw_count FROM user_draws WHERE user_id = $1 AND draw_date = $2',
      [userId, today]
    );

    let drawCount = rows[0]?.draw_count || 0;

    if (drawCount >= 5) {
      alert(`You have reached your daily card draw limit.`);
      return res.status(403).json({ error: 'Daily card draw limit reached.' });
    }

    // Increment draw count
    if (rows.length === 0) {
        await pool.query(
            'INSERT INTO user_draws (user_id, draw_date, draw_count) VALUES ($1, $2, 1)',
            [userId, today]
        );
    } else {
        await pool.query(
            'UPDATE user_draws SET draw_count = draw_count + 1 WHERE user_id = $1 AND draw_date = $2',
            [userId, today]
        );
    }

    const result = await pool.query(
      'SELECT * FROM tarot_cards ORDER BY RANDOM() LIMIT 1'
    );
    const card = result.rows[0];

    // Validate the `card_id` exists in the database
    if (!card || !card.card_id) {
      throw new Error('Card ID missing in database response.');
    }
    
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
  const { user_id, card_id, prompt_text, response_text, orientation, selected_meanings, mood } = req.body;

  if (!user_id || !card_id || !prompt_text || !response_text || !orientation || mood === undefined) {
    console.error('Missing required fields:', req.body);
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Validate `card_id` matches a record in `tarot_cards`
    const cardExists = await pool.query('SELECT 1 FROM tarot_cards WHERE card_id = $1', [card_id]);
    if (cardExists.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    const encryptedResponse = encrypt(response_text);

    const result = await pool.query(
      `INSERT INTO responses (user_id, card_id, prompt_text, response_text, created_at, updated_at, orientation, selected_meanings, mood)
             VALUES ($1, $2, $3, $4, NOW(), NOW(),  $5, $6, $7) RETURNING *`,
            [user_id, card_id, prompt_text, encryptedResponse, orientation, selected_meanings, mood]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: error.message || 'Database error' });
  }
});


app.post('/api/generate-prompt', async (req, res) => {
  const { cardName, orientation, meanings } = req.body;

  if (!cardName || !orientation || !meanings) {
    console.error('Missing required fields:', { cardName, orientation, meanings });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if the app is in testing mode
  if (process.env.TEST_MODE === 'true') {
    console.log('TEST_MODE enabled. Returning a static testing prompt.');
    return res.json({ aiPrompt: 'This is a testing prompt for debugging purposes.' });
  }

  const prePrompt = `
    You are a tarot guide. Your task is to create a journaling prompt and a short description based on a tarot card drawn. 

    For each card:
    1. Write a 3-4 sentence description explaining the card's meaning and symbolism, considering its orientation (upright or reversed).
    2. Create a journaling prompt that:
      - Uses simple, clear language.
      - Directly relates to the card's themes and orientation.
      - Encourages personal reflection and growth.
      - Has a tone that is supportive, thoughtful, and inspiring.

    Output should follow this structure:
    1. A short description of the card's meaning (3-4 sentences).
    2. The journaling prompt, starting with "Journaling Prompt:" on a new line.
  `;

  const dynamicPrompt = `
    Card Drawn: ${cardName} (${orientation})
    Meanings: ${meanings.join(', ')}
  `;

  const fullPrompt = `${prePrompt}\n\n${dynamicPrompt}`;

  try {
    console.log('Calling OpenAI API with prompt:', fullPrompt);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: fullPrompt,
            },
          ],
        },
      ],
    });

    const choice = response.choices[0];
    const aiPrompt = choice?.message?.content?.trim() || 'No journaling prompt could be generated.';

    res.json({ aiPrompt });
  } catch (error) {
    console.error('Error generating prompt:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate prompt' });
  }
});


// Route to handle API response and fetch card details
app.post("/get-tarot-card", async (req, res) => {
  try {
    console.log("[INFO] Received request to /get-tarot-card");

    const userId = req.user?.id; // Use optional chaining to handle cases where req.user might be undefined
    if (!userId) {
      console.error("[ERROR] User is not authenticated.");
      return res.status(401).json({ error: "User not authenticated" });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check the request count for the user for today
    const rateLimitQuery = `
      SELECT request_count 
      FROM user_requests 
      WHERE user_id = $1 AND request_date = $2
    `;
    console.log(`[INFO] Executing rate limit query: ${rateLimitQuery}, user_id: ${userId}, request_date: ${today}`);
    const { rows } = await pool.query(rateLimitQuery, [userId, today]);
    console.log(`[INFO] Query result: ${JSON.stringify(rows)}`);
    const requestCount = rows[0]?.request_count || 0;

    const REQUEST_LIMIT = 5; // Set your desired daily limit here

    if (requestCount >= REQUEST_LIMIT) {
      alert(`You have reached your daily open journal limit.`);
      return res.status(403).json({ error: "Open journal request limit reached." });
    }

    // Update or insert the request count
    if (rows.length === 0) {
      const insertQuery = `
        INSERT INTO user_requests (user_id, request_date, request_count)
        VALUES ($1, $2, 1)
      `;
      await pool.query(insertQuery, [userId, today]);
    } else {
      const updateQuery = `
        UPDATE user_requests 
        SET request_count = request_count + 1 
        WHERE user_id = $1 AND request_date = $2
      `;
      await pool.query(updateQuery, [userId, today]);
    }

    console.log("[INFO] User request count updated.");

    const { journalEntry, mood, title } = req.body;
    if (!journalEntry || !mood || !title) {
      alert("Please fill in the title and journal entry before saving.");
      return res.status(400).json({ error: "All fields are required" });
    }

    console.log("[INFO] Journal entry received:", journalEntry);

    

    // Generate a response from OpenAI
    const prompt = `
      You are a tarot guide. Based on the journal entry below, recommend the tarot card that aligns most. Please use upright and reverse meanings in your classifcation. Once you have a result, respond with exactly the format as follows with no bullets or textual accents, just plain text:
      - [card_name]
      - orientation of card (upright or reversed)
      - A small paragraph on your reasoning
      Exceptions:
      - For Major Arcana card that most align still do: [card_name]
      - For Lesser Arcana card that most aligns do: [number(digit, not spelled out unless an ace)_of_suit]
      Examples:
      - If the card was a Major Arcana: the_fool then a new line upright then a new line with your small paragraph reasoning.
      - If the card was a Lesser Arcana: 2_of_wands then a new line reversed then a new line with your small paragraph reasoning.
      User's journal entry: ${journalEntry}
    `;

    console.log("[INFO] Generated OpenAI prompt:", prompt);
    let responseText;

    try {
      console.log("[INFO] Calling OpenAI API...");
      const openAIResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });
      console.log("[INFO] OpenAI raw response:", openAIResponse);

      responseText = openAIResponse.choices?.[0]?.message?.content;
      console.log("[INFO] OpenAI response received:", responseText);

      if (!responseText) {
        console.error("[ERROR] OpenAI response did not include valid content:", openAIResponse.data?.choices?.[0]?.message);
        throw new Error("Empty response from OpenAI.");
      }
    } catch (error) {
      console.error("[ERROR] Failed to fetch response from OpenAI API:", error.response?.data || error.message);
      return res.status(500).json({ error: "Failed to generate tarot card recommendation." });
    }

    // Define normalization functions
    const normalizeCardName = (cardName) => {
      return cardName.trim().replace(/^- /, '').toLowerCase();
    };

    const normalizeOrientation = (orientation) => {
      return orientation.trim().replace(/^- /, '').toLowerCase();
    };

    const normalizeReasoning = (reasoning) => {
      return reasoning.trim().replace(/^- /, '');
    };

    // Parse the OpenAI response
    console.log("[INFO] Parsing OpenAI response...");
    const parseResponse = (responseText) => {
      const lines = responseText.split("\n").map((line) => line.trim());
      return {
        search_name: lines[0],
        orientation: lines[1],
        reasoning: lines.slice(2).join(" "),
      };
    };

    let { search_name, orientation, reasoning } = parseResponse(responseText);

    if (!search_name || !orientation || !reasoning) {
      console.error("[ERROR] Parsed response is invalid:", { search_name, orientation, reasoning });
      return res.status(400).json({ error: "Invalid response from OpenAI" });
    }

    // Normalize the parsed values
    const normalizedSearchName = normalizeCardName(search_name);
    const normalizedOrientation = normalizeOrientation(orientation);
    const normalizedReasoning = normalizeReasoning(reasoning);

    console.log("[INFO] Parsed response:", { normalizedSearchName, normalizedOrientation, normalizedReasoning });

    // Query the database for the card
    console.log("[INFO] Querying database for card:", normalizedSearchName);
    
    try {
      const query = `
        SELECT * FROM tarot_cards
        WHERE search_name = $1
      `;

      const result = await pool.query(query, [normalizedSearchName]);

      if (result.rows.length === 0) {
        console.error("[ERROR] No card found in database for card_name:", normalizedSearchName);
        return res.status(404).json({ error: "Card not found in database" });
      }

    const card = result.rows[0];
    console.log("[INFO] Card fetched from database:", card);

    // Insert the journal entry into the responses table
    try {
      const encryptedResponse = encrypt(journalEntry);
      
      const insertQuery = `
        INSERT INTO responses (
          user_id, card_id, prompt_text, response_text, created_at, updated_at, orientation, selected_meanings, mood
        ) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7)
        RETURNING *;
      `;
      const insertValues = [
        userId,
        card.card_id,
        title, // prompt_text is the title of their prompt
        encryptedResponse, // response_text is the journal entry
        normalizedOrientation, // From OpenAI response
        null, // selected_meanings is null for now
        mood, // Captured from the request body
      ];

      const insertResult = await pool.query(insertQuery, insertValues);
      console.log("[INFO] Journal entry saved:", insertResult.rows[0]);
    } catch (error) {
      console.error("[ERROR] Failed to save journal entry:", error.message);
      return res.status(500).json({ error: "Failed to save journal entry." });
    }

    // Send the response to the frontend
    res.json({
      card_name: card.card_name,
      orientation: normalizedOrientation,
      reasoning: normalizedReasoning,
      image_data: card.image_data,
    });

    console.log("[INFO] Response sent to frontend:", {
      card_name: card.card_name,
      orientation: normalizedOrientation,
      reasoning: normalizedReasoning,
      image_data: card.image_data,
    });

    } catch (error) {
      console.error("[ERROR] Database query failed:", error.message);
      return res.status(500).json({ error: "Database error" });
    }

  } catch (error) {
    console.error("[FATAL ERROR] An unexpected error occurred:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});


const dataController = require('./controllers/dataController'); 
const storeController = require('./controllers/storeController');

//EJS Routes
app.get('/', (req, res) => res.render('home'));
app.get('/tarot', (req, res) => {
  res.render('tarot', { user: res.locals.user });
});
app.get('/open-journal', (req, res) => res.render('openJournal'));

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
// Need to fix bug on cleanup
//cleanupExpiredTokens();



// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});