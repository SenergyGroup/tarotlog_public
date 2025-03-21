const OpenAI = require("openai");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const testRoutes = require('./routes/testRoutes');
const { checkUser } = require('./middleware/authMiddleware');
// const cleanupExpiredTokens = require('./tasks/cleanupExpiredTokens');
const { encrypt } = require('./utils/encryption');
require('./tasks/dailyCardScheduler');



// Neon Database Backend and API
const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = ['https://www.mytarottales.com', 'https://mytarottales.com', 
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));

app.options('*', cors());

app.set('trust proxy', true);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

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
app.use(cookieParser());
app.use(checkUser);

// View engine
app.set('view engine', 'ejs');

// Sync user model with database
const User = require('./models/User');

sequelize.sync({ force: false }) // Set force to true to drop and recreate tables during development
  .then(() => console.log('Database synced'))
  .catch(err => console.error('Error syncing database:', err));

/**
 * Serve a random card without daily-limit logic
 */
async function serveRandomCardNoLimit(pool, res) {
  try {
    // Pull a random card from the database
    const result = await pool.query(
      'SELECT * FROM tarot_cards ORDER BY RANDOM() LIMIT 1'
    );
    const card = result.rows[0];

    if (!card || !card.card_id) {
      throw new Error('Card ID missing in database response.');
    }

    // Randomly determine orientation
    const isReversed = Math.random() < 0.5; // 50% chance

    // For non-logged-in users, default to some deck, e.g. "rider_white"
    const userDeck = 'rider_white';

    // Build an image URL or use the same logic from your code
    const cardNumber = card.card_id;
    const imageURL = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;

    // Build the final response object
    const cardWithOrientation = {
      ...card,
      orientation: isReversed ? 'Reversed' : 'Upright',
      description: isReversed ? card.description_reversed : card.description_upright,
      meanings: isReversed
        ? card.meaning_reversed.split(',')
        : card.meaning_upright.split(','),
      image_data: imageURL,
    };

    // Return JSON directly
    return res.json(cardWithOrientation);
  } catch (error) {
    console.error('Error fetching card:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}

// Route to draw a random card
app.get('/api/draw-card', async (req, res) => {
  // If no user => skip the draw limit
  if (!req.user) {
    // Just serve a random card with orientation
    return serveRandomCardNoLimit(pool, res);
  }

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
      return res.status(403).json({ error: `You have reached your daily card draw limit.` });
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

    // Code to build image URL from deck choice
    const deckQuery = `
        SELECT deck_preference 
        FROM users 
        WHERE user_id = $1
      `;
    const deckResult = await pool.query(deckQuery, [userId]);
    const userDeck = deckResult.rows[0]?.deck_preference || 'rider_white'; // Default deck if none is set

    // Build image URL from deck preference + card_number
    // NOTE: Ensure your tarot_cards table has a 'card_number' column
    const cardNumber = card.card_id; 
    const imageURL = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;

    // Add orientation and appropriate description to the response
    const cardWithOrientation = {
      ...card,
      orientation: isReversed ? 'Reversed' : 'Upright',
      description: isReversed ? card.description_reversed : card.description_upright,
      meanings: isReversed ? card.meaning_reversed.split(',') : card.meaning_upright.split(','),
      image_data: imageURL
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


app.post('/api/generate-prompt', checkUser, async (req, res) => {
  const { cardName, orientation, meanings } = req.body;
  const userId = req.user?.id;

  if (!cardName || !orientation || !meanings) {
    console.error('Missing required fields:', { cardName, orientation, meanings });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if the app is in testing mode
  if (process.env.TEST_MODE === 'true') {
    console.log('TEST_MODE enabled. Returning a static testing prompt.');
    return res.json({ aiPrompt: 'This is a testing prompt for debugging purposes.' });
  }

  let userFocus = 'general'; // a fallback if user has no focus
  try {
    const user = await User.findOne({
      where: { user_id: userId },
      attributes: ['focus']
    });
    if (user && user.focus) {
      userFocus = user.focus;
    }
  } catch (err) {
    console.error('Error fetching user focus:', err.message);
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

    Keep in mind the user's chosen focus for their journaling is: "${userFocus}".
    Incorporate the essence of this focus into both the description and journaling prompt wherever possible.

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

    const normalizeOrientation = (orientation) => {
      return orientation.trim().replace(/^- /, '').toLowerCase();
    };

    const normalizeReasoning = (reasoning) => {
      return reasoning.trim().replace(/^- /, '');
    };

    // Parse the OpenAI response
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
      return res.status(400).json({ error: "Unable to pair you with a card right now." });
    }

    const normalizedSearchName = normalizeCardName(search_name);
    const normalizedOrientation = normalizeOrientation(orientation);
    const normalizedReasoning = normalizeReasoning(reasoning);
    
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

    // Code to build image URL from deck choice
    const deckQuery = `
        SELECT deck_preference 
        FROM users 
        WHERE user_id = $1
      `;
    const deckResult = await pool.query(deckQuery, [userId]);
    const userDeck = deckResult.rows[0]?.deck_preference || 'rider_white'; // Default deck if none is set

    // Build image URL from deck preference + card_number
    // NOTE: Ensure your tarot_cards table has a 'card_number' column
    const cardNumber = card.card_id; 
    const imageURL = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;

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
        normalizedReasoning, // prompt_text is the reasoning
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
      image_data: imageURL,
    });

    console.log("[INFO] Response sent to frontend:", {
      card_name: card.card_name,
      orientation: normalizedOrientation,
      reasoning: normalizedReasoning,
      image_data: imageURL,
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

// Offline tarot card generation route (skip DB insertion)
app.post("/api/get-tarot-card-offline", async (req, res) => {
  try {
    const { journalEntry, mood, title } = req.body;
    if (!journalEntry || !mood || !title) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Generate the OpenAI prompt (as in your main route)
    const prompt = `
      You are a tarot guide. Based on the journal entry below, recommend the tarot card that aligns most. Please use upright and reverse meanings in your classifcation. Once you have a result, respond with exactly the format as follows with no bullets or textual accents, just plain text:
      [card_name]
      orientation of card (upright or reversed)
      A small paragraph on your reasoning
      Exceptions:
      - For Major Arcana card that most align still do: [card_name]
      - For Lesser Arcana card that most aligns do: [number(digit, not spelled out unless an ace)_of_suit]
      Examples:
      - If the card was a Major Arcana: the_fool then a new line upright then a new line with your small paragraph reasoning.
      - If the card was a Lesser Arcana: 2_of_wands then a new line reversed then a new line with your small paragraph reasoning.
      User's journal entry: ${journalEntry}
    `;
    
    // Call the OpenAI API (using your existing logic)
    const openAIResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = openAIResponse.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenAI.");
    } else {
      console.log(responseText)
    }

    const lines = responseText.split("\n").map(line => line.trim());
    const search_name = lines[0];
    const orientation = lines[1];
    const reasoning = lines.slice(2).join(" ");
    const normalizedSearchName = normalizeCardName(search_name);
    const normalizedOrientation = orientation.toLowerCase();
    const normalizedReasoning = reasoning;

    // console.log("1. ", lines,"2. ", search_name,"3. ", orientation,"4. ", reasoning,"5. ", normalizedSearchName,"6. ", normalizedOrientation,"7. ", normalizedReasoning)

    // Query the database for the card
    const query = `SELECT * FROM tarot_cards WHERE search_name = $1`;
    const result = await pool.query(query, [normalizedSearchName]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Card not found in database" });
    }
    const card = result.rows[0];

    // Use a default deck for offline users
    const userDeck = 'rider_white';
    const cardNumber = card.card_id;
    const imageURL = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;

    // Return the generated card data without saving it to the DB
    res.json({
      card_name: card.card_name,
      orientation: normalizedOrientation,
      reasoning: normalizedReasoning,
      image_data: imageURL,
    });
  } catch (error) {
    console.error("Error in offline tarot route:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Parse and normalize the response
function normalizeCardName(cardName) {
  return cardName
    .trim()                           // Remove surrounding whitespace
    .replace(/^[-\*\u2022\s]+/, '')     // Remove leading bullets or special characters
    .replace(/\[|\]/g, '')             // Remove any square brackets
    .toLowerCase()                    // Convert to lowercase
    .replace(/\s+/g, '_');             // Replace spaces with underscores
}


const dataController = require('./controllers/dataController'); 
const storeController = require('./controllers/storeController');
const dashboardController = require('./controllers/dashboardController');
const entriesController = require('./controllers/entriesController');

//EJS Routes
app.get('/', checkUser, (req, res) => {
  // If the user is authenticated, req.user will be set by checkUser
  if (req.user) {
    return res.redirect('/dashboard');
  }
  // Otherwise, render the home page
  res.render('home');
});


app.get('/tarot', async (req, res) => {
  if (req.user) {
    try {
      const fullUser = await User.findOne({
        where: { user_id: req.user.id },
        attributes: ['user_id', 'username', 'deck_back']  // include deck_back here
      });
      res.render('tarot', { user: fullUser });
    } catch (error) {
      console.error('Error fetching user data for tarot:', error);
      res.render('tarot', { user: req.user }); // fallback
    }
  } else {
    res.render('tarot', { user: null });
  }
});

app.get('/open-journal', (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.redirect('/');
  }

  res.render('openJournal', { user: res.locals.user });
});

// Card Glossary
app.get('/card-glossary', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.redirect('/');
  }

  try {
    // 1) Fetch the user's deck_preference
    const deckResult = await pool.query(`
      SELECT deck_preference 
      FROM users
      WHERE user_id = $1
    `, [userId]);
    const userDeck = deckResult.rows[0]?.deck_preference || 'rider_white';
    
    const query = `
      SELECT t.*,
             COALESCE(r.entry_count, 0) AS total_entries
      FROM tarot_cards t
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS entry_count
        FROM responses
        WHERE user_id = $1
        GROUP BY card_id
      ) r ON t.card_id = r.card_id
      ORDER BY t.card_id
    `;
    const { rows } = await pool.query(query, [userId]);

    for (const card of rows) {
      const cardNumber = card.card_id;  // Must be in the 'tarot_cards' table
      card.image_url = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${cardNumber}.jpg`;
    }

    res.render('cardGlossary', { cards: rows, user: res.locals.user });
  } catch (error) {
    console.error('Error fetching all cards:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/card-entry-count/:card_id', async (req, res) => {
  const userId = req.user.id;
  const cardId = req.params.card_id;
  try {
    const result = await pool.query(
      `SELECT orientation, COUNT(*) AS entry_count 
       FROM responses 
       WHERE user_id = $1 AND card_id = $2 
       GROUP BY orientation`,
      [userId, cardId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching entry counts:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/top-cards', async (req, res) => {
  const userId = req.user.id;
  try {
    // 1) Fetch the user's deck_preference
    const deckResult = await pool.query(`
      SELECT deck_preference 
      FROM users
      WHERE user_id = $1
    `, [userId]);
    const userDeck = deckResult.rows[0]?.deck_preference || 'rider_white';

    const { rows } = await pool.query(`
      SELECT t.card_id, t.card_name, t.image_data, COUNT(*) AS total_entries
      FROM responses r
      JOIN tarot_cards t ON r.card_id = t.card_id
      WHERE r.user_id = $1
      GROUP BY t.card_id, t.card_name, t.image_data
      ORDER BY total_entries DESC
      LIMIT 10
    `, [userId]);

    // 3) Build an image_url for each card
    rows.forEach(card => {
      card.image_url = `https://raw.githubusercontent.com/SenergyGroup/tarotlog_assets/refs/heads/main/tarot_decks/${userDeck}/image_${card.card_id}.jpg`;
    });

    // Return them in JSON
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top cards:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

//Artists Routes
app.get('/artists', checkUser, (req, res) => {
  res.render('artists');
});

//About Route
app.get('/about', checkUser, (req, res) => {
  res.render('about');
});

// Route files
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardController);
app.use('/entries', entriesController);
app.use('/data', dataController);
app.get('/store', storeController.store_get);
app.use('/settings', settingsRoutes);
app.use('/test', testRoutes);

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