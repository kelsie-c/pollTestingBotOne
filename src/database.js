import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'poll-bot.db');

// Create data directory if it doesn't exist
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Create tables
await dbRun(`
    CREATE TABLE IF NOT EXISTS server_configs (
        guild_id TEXT PRIMARY KEY,
        bot_name TEXT DEFAULT 'Poll Bot',
        poll_channel_id TEXT,
        embed_color TEXT DEFAULT '00AE86',
        default_emojis TEXT DEFAULT '1️⃣,2️⃣,3️⃣,4️⃣,5️⃣,6️⃣,7️⃣,8️⃣,9️⃣,🔟',
        poll_role_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Database functions
export async function getServerConfig(guildId) {
    try {
        let config = await dbGet('SELECT * FROM server_configs WHERE guild_id = ?', [guildId]);
        
        if (!config) {
            // Create default config if none exists
            await dbRun('INSERT OR IGNORE INTO server_configs (guild_id) VALUES (?)', [guildId]);
            config = await dbGet('SELECT * FROM server_configs WHERE guild_id = ?', [guildId]);
        }
        
        return config;
    } catch (error) {
        console.error('Error getting server config:', error);
        // Return default config if database error
        return {
            guild_id: guildId,
            bot_name: 'Poll Bot',
            poll_channel_id: null,
            embed_color: '00AE86',
            default_emojis: '1️⃣,2️⃣,3️⃣,4️⃣,5️⃣,6️⃣,7️⃣,8️⃣,9️⃣,🔟',
            poll_role_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
}

export async function updateServerConfig(guildId, updates) {
    try {
        const currentConfig = await getServerConfig(guildId);
        
        const newConfig = {
            botName: updates.botName || currentConfig.bot_name,
            pollChannelId: updates.pollChannelId || currentConfig.poll_channel_id,
            embedColor: updates.embedColor || currentConfig.embed_color,
            defaultEmojis: updates.defaultEmojis || currentConfig.default_emojis,
            pollRoleId: updates.pollRoleId || currentConfig.poll_role_id
        };
        
        await dbRun(`
            INSERT OR REPLACE INTO server_configs 
            (guild_id, bot_name, poll_channel_id, embed_color, default_emojis, poll_role_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            guildId,
            newConfig.botName,
            newConfig.pollChannelId,
            newConfig.embedColor,
            newConfig.defaultEmojis,
            newConfig.pollRoleId
        ]);
        
        return await getServerConfig(guildId);
    } catch (error) {
        console.error('Error updating server config:', error);
        return await getServerConfig(guildId);
    }
}

export async function getAllServerConfigs() {
    try {
        return await dbAll('SELECT * FROM server_configs');
    } catch (error) {
        console.error('Error getting all server configs:', error);
        return [];
    }
}

// Helper function to parse emojis
export function parseEmojis(emojiString) {
    if (!emojiString) return ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojiString.split(',').map(emoji => emoji.trim());
}

// Helper function to parse color
export function parseColor(colorString) {
    if (!colorString) return 0x00AE86;
    // Remove # if present and parse as hex
    const cleanColor = colorString.replace('#', '');
    return parseInt(cleanColor, 16);
}

// Clean shutdown
process.on('exit', () => db.close());
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

export default db;