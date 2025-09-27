import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'poll-bot.db');

// Create data directory if it doesn't exist
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Create tables
db.exec(`
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

// Prepared statements for better performance
const statements = {
    getServerConfig: db.prepare('SELECT * FROM server_configs WHERE guild_id = ?'),
    upsertServerConfig: db.prepare(`
        INSERT INTO server_configs (guild_id, bot_name, poll_channel_id, embed_color, default_emojis, poll_role_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(guild_id) DO UPDATE SET
            bot_name = excluded.bot_name,
            poll_channel_id = excluded.poll_channel_id,
            embed_color = excluded.embed_color,
            default_emojis = excluded.default_emojis,
            poll_role_id = excluded.poll_role_id,
            updated_at = CURRENT_TIMESTAMP
    `),
    createDefaultConfig: db.prepare(`
        INSERT OR IGNORE INTO server_configs (guild_id)
        VALUES (?)
    `)
};

// Database functions
export function getServerConfig(guildId) {
    const config = statements.getServerConfig.get(guildId);
    
    if (!config) {
        // Create default config if none exists
        statements.createDefaultConfig.run(guildId);
        return statements.getServerConfig.get(guildId);
    }
    
    return config;
}

export function updateServerConfig(guildId, updates) {
    const currentConfig = getServerConfig(guildId);
    
    const newConfig = {
        botName: updates.botName || currentConfig.bot_name,
        pollChannelId: updates.pollChannelId || currentConfig.poll_channel_id,
        embedColor: updates.embedColor || currentConfig.embed_color,
        defaultEmojis: updates.defaultEmojis || currentConfig.default_emojis,
        pollRoleId: updates.pollRoleId || currentConfig.poll_role_id
    };
    
    statements.upsertServerConfig.run(
        guildId,
        newConfig.botName,
        newConfig.pollChannelId,
        newConfig.embedColor,
        newConfig.defaultEmojis,
        newConfig.pollRoleId
    );
    
    return getServerConfig(guildId);
}

export function getAllServerConfigs() {
    return db.prepare('SELECT * FROM server_configs').all();
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