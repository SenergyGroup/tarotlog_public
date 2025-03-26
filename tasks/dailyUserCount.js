// tasks/dailyCardScheduler.js
const cron = require('node-cron');
const { sequelize  } = require('../config/database'); 

cron.schedule('0 17 * * *', async () => { // Runs at midnight every day
    try {
        // Count distinct users who logged in today.
        const [results] = await sequelize.query(`
          SELECT COUNT(*) AS dailyCount
          FROM users
          WHERE DATE("lastlogin") = CURRENT_DATE
        `);
        const dailyCount = Number(rows[0].dailycount);
        
        // Insert the daily count into the daily_user_count table.
        await sequelize.query(`
          INSERT INTO daily_user_count (date, count)
          VALUES (CURRENT_DATE, $1)
          ON CONFLICT (date) DO UPDATE SET count = EXCLUDED.count`,
          { bind: [dailyCount] }
        );
        
        console.log(`Stored daily user count: ${dailyCount}`);
      } catch (error) {
        console.error("Error updating daily user count:", error);
    }
},
{ timezone: 'America/Chicago' }
);
