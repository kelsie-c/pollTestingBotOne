import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// Define the poll slash command
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

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
async function deployCommands() {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        console.log('Slash commands deployed successfully!');
        
        // List the deployed commands
        data.forEach(command => {
            console.log(`   /${command.name} - ${command.description}`);
        });
        
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

deployCommands();