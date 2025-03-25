// tasks/dailyCardScheduler.js
const cron = require('node-cron');
const { sequelize  } = require('../config/database'); // Adjust the path if needed

cron.schedule('0 22 * * *', async () => { // Runs at midnight every day
    try {
        // Count distinct users who logged in today.
        // NOTE: Adjust the query if you have a separate login log or need to account for timezone issues.
        const [results] = await sequelize.query(`
          SELECT COUNT(*) AS dailyCount
          FROM users
          WHERE DATE("lastlogin") = CURRENT_DATE
        `);
        const dailyCount = results[0].dailyCount;
        
        // Insert the daily count into the daily_user_count table.
        // This example uses an UPSERT to update the row if it already exists.
        await sequelize.query(`
          INSERT INTO daily_user_count (date, count)
          VALUES (CURRENT_DATE, ${dailyCount})
          ON CONFLICT (date) DO UPDATE SET count = EXCLUDED.count
        `);
        
        console.log(`Stored daily user count: ${dailyCount}`);
      } catch (error) {
        console.error("Error updating daily user count:", error);
    }
});
