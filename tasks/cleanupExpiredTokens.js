const cron = require('node-cron');
const { User } = require('../models/User');
const { Op } = require('sequelize');

const batchSize = 1000;

const cleanupExpiredTokens = () => {
    cron.schedule('0 0 * * *', async () => { // Every day at midnight
        console.log('Running cleanup for expired tokens...');
        try {
            let rowsUpdated;
            do {
                const [result] = await User.update(
                    { resetToken: null, tokenExpiration: null },
                    { where: { tokenExpiration: { [Op.lt]: new Date() } }, limit: batchSize }
                );
                rowsUpdated = result;
                console.log(`Batch cleanup: ${rowsUpdated} rows updated.`);
            } while (rowsUpdated === batchSize);
            console.log('Cleanup completed successfully.');
        } catch (err) {
            console.error('Error cleaning up expired tokens:', err);
        }
    });
};


module.exports = cleanupExpiredTokens;