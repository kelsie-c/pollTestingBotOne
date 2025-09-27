import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

// Define the poll slash command (same as deploy-commands.js)
// const commands = [];
const commands = [
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll with custom options')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true)
                .setMaxLength(256))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('First poll option')
                .setRequired(true)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Second poll option')
                .setRequired(true)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Third poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Fourth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Fifth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sixth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Seventh poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Eighth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Ninth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Tenth poll option')
                .setRequired(false)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('emojis')
                .setDescription('Custom emojis for options (comma-separated, e.g. 🔥,💯,⭐)')
                .setRequired(false)
                .setMaxLength(200))
        .toJSON(),
    
    new SlashCommandBuilder()
        .setName('pollconfig')
        .setDescription('Configure poll bot settings for this server (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the default channel for polls')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel where polls will be posted')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set the role to ping for new polls')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to mention when polls are created')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('color')
                .setDescription('Set the embed color (hex code)')
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code (e.g. FF5733, 9B59B6)')
                        .setRequired(true)
                        .setMaxLength(6)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('emojis')
                .setDescription('Set default emojis for polls')
                .addStringOption(option =>
                    option.setName('emojis')
                        .setDescription('Comma-separated emojis (e.g. 🔥,💯,⭐,❤️)')
                        .setRequired(true)
                        .setMaxLength(200)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('name')
                .setDescription('Set the bot name for this server')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The display name for the bot')
                        .setRequired(true)
                        .setMaxLength(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current poll bot settings'))
        .toJSON()
];

// Create hash of commands to detect changes
function getCommandsHash() {
    return crypto.createHash('md5').update(JSON.stringify(commands)).digest('hex');
}

// Check if commands have changed
function commandsChanged() {
    const currentHash = getCommandsHash();
    const hashFile = 'data/commands-hash.txt';
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync('data')) {
        fs.mkdirSync('data', { recursive: true });
    }
    
    let previousHash = '';
    if (fs.existsSync(hashFile)) {
        previousHash = fs.readFileSync(hashFile, 'utf8').trim();
    }
    
    if (currentHash !== previousHash) {
        fs.writeFileSync(hashFile, currentHash);
        return true;
    }
    
    return false;
}

// REST instance
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Smart deploy function
async function smartDeploy() {
    // Skip if no token (development without env vars)
    if (!process.env.DISCORD_TOKEN) {
        console.log('No Discord token found, skipping command deployment');
        return;
    }
    
    // Check if commands have changed
    if (!commandsChanged()) {
        console.log('Commands unchanged, skipping deployment');
        return;
    }
    
    try {
        console.log('Commands changed, deploying...');
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        let deployRoute;
        if (process.env.GUILD_ID && process.env.NODE_ENV === 'development') {
            deployRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
            console.log('Deploying to guild (development mode)');
        } else {
            deployRoute = Routes.applicationCommands(process.env.CLIENT_ID);
            console.log('Deploying globally (production mode)');
        }

        const data = await rest.put(deployRoute, { body: commands });

        console.log(`Successfully deployed ${data.length} application (/) commands.`);
        data.forEach(command => {
            console.log(`   /${command.name} - ${command.description}`);
        });
        
    } catch (error) {
        console.error('Error deploying commands:', error);
        // Don't fail the build, just log the error
    }
}

smartDeploy();