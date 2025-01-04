const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const IV_LENGTH = 16; // Initialization vector length

// Function to encrypt data
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH); // Generate random IV
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Function to decrypt data
function decrypt(encryptedText) {
    const [iv, encrypted] = encryptedText.split(':').map(part => Buffer.from(part, 'hex'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
