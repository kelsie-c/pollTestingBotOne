import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import dotenv from 'dotenv';
import { getServerConfig, updateServerConfig, parseEmojis, parseColor } from './database.js';

// Load environment variables
dotenv.config();

// Bot configuration from environment (fallback defaults)
const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID
};

// Temporary storage for poll data (15 minute expiry)
const pollStorage = new Map();

// Clean up expired poll data every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of pollStorage.entries()) {
        if (now - data.createdAt > 15 * 60 * 1000) { // 15 minutes
            pollStorage.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Helper functions for poll editing
function storePollData(messageId, pollData) {
    pollStorage.set(messageId, {
        ...pollData,
        createdAt: Date.now()
    });
}

function getPollData(messageId) {
    return pollStorage.get(messageId);
}

function createEditButton(messageId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_poll_${messageId}`)
                .setLabel('Edit Poll')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️')
        );
}

function createEditModal(pollData) {
    const modal = new ModalBuilder()
        .setCustomId(`edit_modal_${pollData.messageId}`)
        .setTitle('Edit Your Poll');

    // Question input
    const questionInput = new TextInputBuilder()
        .setCustomId('question')
        .setLabel('Poll Question')
        .setStyle(TextInputStyle.Short)
        .setValue(pollData.question)
        .setMaxLength(256)
        .setRequired(true);

    // Options input (combine all options into one text area)
    const optionsText = pollData.options.join('\n');
    const optionsInput = new TextInputBuilder()
        .setCustomId('options')
        .setLabel('Poll Options (one per line, max 10)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(optionsText)
        .setMaxLength(1000)
        .setRequired(true);

    // Emojis input with short label
    const emojisText = pollData.emojis.join(',');
    const emojisInput = new TextInputBuilder()
        .setCustomId('emojis')
        .setLabel('Custom Emojis (Win+. / Cmd+Ctrl+Space)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(emojisText)
        .setPlaceholder('🔥,💯,⭐,❤️,🎉,👍,💪,🚀')
        .setMaxLength(300)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(questionInput),
        new ActionRowBuilder().addComponents(optionsInput),
        new ActionRowBuilder().addComponents(emojisInput)
    );

    return modal;
}

// Helper function to get server-specific config
async function getConfig(guildId) {
    const serverConfig = await getServerConfig(guildId);
    return {
        botName: serverConfig.bot_name,
        defaultEmojis: parseEmojis(serverConfig.default_emojis),
        pollChannelId: serverConfig.poll_channel_id,
        pollRoleId: serverConfig.poll_role_id,
        embedColor: parseColor(serverConfig.embed_color)
    };
}

// Utility function to create poll embed
async function createPollEmbed(question, options, emojis, author, guildId) {
    const serverConfig = await getConfig(guildId);
    
    const embed = new EmbedBuilder()
        .setTitle(`${question}`)
        .setColor(serverConfig.embedColor)
        .setTimestamp()
        .setFooter({ text: `Created by ${author.displayName}`, iconURL: author.displayAvatarURL() });

    // Create description with emoji bullet points
    let description = '** ** ** **\n';
    options.forEach((option, index) => {
        const emoji = emojis[index] || serverConfig.defaultEmojis[index] || '❓';
        description += `${emoji} ${option}\n`;
    });
    description += `\n⋅ ⋅ ⋅ ⋅ ⋅ ⋅ ⋅ ⋅`;
    
    embed.setDescription(description);

    return embed;
}

// Create a new client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ] 
});

// When the client is ready, run this code
client.once('ready', () => {
    console.log('Poll Bot is online!');
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Connected to ${client.guilds.cache.size} server(s)`);
    
    // Set bot activity
    client.user.setActivity('Creating polls! Use /poll');
});

// When bot joins a new server
client.on('guildCreate', async (guild) => {
    console.log(`Bot added to new server: ${guild.name} (ID: ${guild.id})`);
    
    // Create default config for new server
    await getServerConfig(guild.id);
    
    // Try to send a welcome message to the system channel or first available channel
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('Thanks for adding Poll Bot!')
        .setDescription(`Hello! I'm ready to help you create awesome polls in **${guild.name}**.

**Quick Start:**
• Use \`/poll\` to create your first poll
• Use \`/pollconfig view\` to see current settings
• Use \`/pollconfig\` commands to customize me for your server

**Need to configure me?**
Admins can use these commands:
• \`/pollconfig channel\` - Set poll channel
• \`/pollconfig role\` - Set notification role  
• \`/pollconfig color\` - Set embed color
• \`/pollconfig emojis\` - Set default emojis
• \`/pollconfig name\` - Set bot nickname

Let's create some engaging polls!`)
        .setColor(0x00AE86)
        .setTimestamp();

    try {
        const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages'));
        if (channel) {
            await channel.send({ embeds: [welcomeEmbed] });
        }
    } catch (error) {
        console.log('Could not send welcome message, but that\'s okay!');
    }
});

// Legacy text command handler (keeping for backwards compatibility during transition)
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Simple poll command format: !poll "question" "option1" "option2" ...
    if (message.content.startsWith('!poll')) {
        try {
            // Delete the original message
            await message.delete();

            // Parse the poll command
            const args = message.content.slice(5).trim();
            const matches = args.match(/"([^"]+)"/g);
            
            if (!matches || matches.length < 3) {
                const errorMsg = await message.channel.send('Invalid poll format! Use: `!poll "question" "option1" "option2" ...`\nTry the new `/poll` slash command instead!');
                setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                return;
            }

            const question = matches[0].slice(1, -1); // Remove quotes
            const options = matches.slice(1).map(match => match.slice(1, -1)); // Remove quotes from options
            const serverConfig = await getConfig(message.guild.id);

            // Use default emojis for now
            const emojis = serverConfig.defaultEmojis.slice(0, options.length);

            // Create and send poll embed
            const pollEmbed = await createPollEmbed(question, options, emojis, message.member, message.guild.id);
            const pollMessage = await message.channel.send({ embeds: [pollEmbed] });

            // Add reactions for voting
            try {
                for (let i = 0; i < options.length; i++) {
                    await pollMessage.react(emojis[i]);
                }
            } catch (reactionError) {
                console.error('Error adding reactions:', reactionError);
                await message.channel.send('Poll created but couldn\'t add reaction emojis. Please add them manually!');
            }

            // Send role tag as separate message if configured
            try {
                if (serverConfig.pollRoleId) {
                    await message.channel.send(`<@&${serverConfig.pollRoleId}>`);
                }
            } catch (roleTagError) {
                console.error('Error sending role tag:', roleTagError);
            }

        } catch (error) {
            console.error('Error creating poll:', error);
            const errorMsg = await message.channel.send('There was an error creating the poll!');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('edit_poll_')) {
            const messageId = interaction.customId.replace('edit_poll_', '');
            const pollData = getPollData(messageId);
            
            if (!pollData) {
                return await interaction.reply({
                    content: '❌ This poll can no longer be edited (expired after 15 minutes).',
                    ephemeral: true
                });
            }
            
            // Check if user is the original author
            if (pollData.authorId !== interaction.user.id) {
                return await interaction.reply({
                    content: '❌ Only the poll creator can edit this poll.',
                    ephemeral: true
                });
            }
            
            const modal = createEditModal(pollData);
            await interaction.showModal(modal);
        }
        return;
    }
    
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('edit_modal_')) {
            const messageId = interaction.customId.replace('edit_modal_', '');
            const pollData = getPollData(messageId);
            
            if (!pollData) {
                return await interaction.reply({
                    content: '❌ This poll can no longer be edited (expired after 15 minutes).',
                    ephemeral: true
                });
            }
            
            try {
                // Immediately respond to avoid timeout
                await interaction.reply({
                    content: '⏳ Updating your poll...',
                    ephemeral: true
                });

                // Get updated data from modal
                const newQuestion = interaction.fields.getTextInputValue('question');
                const optionsText = interaction.fields.getTextInputValue('options');
                const emojisText = interaction.fields.getTextInputValue('emojis') || '';
                
                // Parse options
                const newOptions = optionsText.split('\n')
                    .map(opt => opt.trim())
                    .filter(opt => opt.length > 0);
                
                if (newOptions.length < 2) {
                    return await interaction.editReply({
                        content: '❌ You need at least 2 options for a poll!'
                    });
                }
                
                if (newOptions.length > 10) {
                    return await interaction.editReply({
                        content: '❌ Maximum 10 options allowed!'
                    });
                }
                
                // Parse emojis - do database call after responding
                const serverConfig = await getConfig(interaction.guild.id);
                let newEmojis = serverConfig.defaultEmojis.slice(0, newOptions.length);
                
                if (emojisText.trim()) {
                    const customEmojis = emojisText.split(',').map(emoji => emoji.trim());
                    if (customEmojis.length >= newOptions.length) {
                        newEmojis = customEmojis.slice(0, newOptions.length);
                    } else {
                        newEmojis = [...customEmojis, ...serverConfig.defaultEmojis.slice(customEmojis.length)].slice(0, newOptions.length);
                    }
                }
                
                // Create new poll embed
                const member = await interaction.guild.members.fetch(pollData.authorId);
                const newPollEmbed = await createPollEmbed(newQuestion, newOptions, newEmojis, member, interaction.guild.id);
                
                // Update the original message
                const originalMessage = await interaction.channel.messages.fetch(messageId);
                await originalMessage.edit({ embeds: [newPollEmbed] });
                
                // Clear old reactions and add new ones
                await originalMessage.reactions.removeAll();
                for (let i = 0; i < newOptions.length; i++) {
                    await originalMessage.react(newEmojis[i]);
                }
                
                // Update stored poll data
                storePollData(messageId, {
                    messageId: messageId,
                    question: newQuestion,
                    options: newOptions,
                    emojis: newEmojis,
                    authorId: pollData.authorId,
                    guildId: pollData.guildId
                });
                
                await interaction.editReply({
                    content: '✅ Poll updated successfully!'
                });
                
            } catch (error) {
                console.error('Error updating poll:', error);
                await interaction.editReply({
                    content: '❌ There was an error updating the poll!'
                });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'poll') {
        try {
            // Get the question and options from the interaction
            const question = interaction.options.getString('question');
            const options = [];
            
            // Collect all provided options (up to 10)
            for (let i = 1; i <= 10; i++) {
                const option = interaction.options.getString(`option${i}`);
                if (option) {
                    options.push(option);
                }
            }

            // Validate minimum options
            if (options.length < 2) {
                return await interaction.reply({
                    content: 'You need at least 2 options for a poll!',
                    ephemeral: true
                });
            }

            const serverConfig = await getConfig(interaction.guild.id);

            // Get custom emojis if provided
            const customEmojisString = interaction.options.getString('emojis');
            let emojis = serverConfig.defaultEmojis.slice(0, options.length);
            
            if (customEmojisString) {
                const customEmojis = customEmojisString.split(',').map(emoji => emoji.trim());
                if (customEmojis.length >= options.length) {
                    emojis = customEmojis.slice(0, options.length);
                } else {
                    // If not enough custom emojis, use custom ones first, then defaults
                    emojis = [...customEmojis, ...serverConfig.defaultEmojis.slice(customEmojis.length)].slice(0, options.length);
                }
            }

            // Create poll embed
            const pollEmbed = await createPollEmbed(question, options, emojis, interaction.member, interaction.guild.id);
            
            // Send the poll embed
            await interaction.reply({ embeds: [pollEmbed] });
            
            // Get the message to add reactions
            const pollMessage = await interaction.fetchReply();
            
            // Add reactions for voting
            try {
                for (let i = 0; i < options.length; i++) {
                    await pollMessage.react(emojis[i]);
                }
            } catch (reactionError) {
                console.error('Error adding reactions:', reactionError);
                await interaction.followUp({
                    content: 'Poll created but couldn\'t add reaction emojis. Please add them manually!',
                    ephemeral: true
                });
            }

            // Store poll data for editing and send edit button
            try {
                storePollData(pollMessage.id, {
                    messageId: pollMessage.id,
                    question: question,
                    options: options,
                    emojis: emojis,
                    authorId: interaction.user.id,
                    guildId: interaction.guild.id
                });

                const editButton = createEditButton(pollMessage.id);
                await interaction.followUp({
                    content: 'You can edit this poll for the next 15 minutes:',
                    components: [editButton],
                    ephemeral: true
                });
            } catch (editButtonError) {
                console.error('Error setting up edit functionality:', editButtonError);
                // Don't fail the whole poll if edit setup fails
            }

            // Send role tag as separate message if configured
            try {
                if (serverConfig.pollRoleId) {
                    await interaction.followUp(`<@&${serverConfig.pollRoleId}>`);
                }
            } catch (roleTagError) {
                console.error('Error sending role tag:', roleTagError);
            }

        } catch (error) {
            console.error('Error creating poll with slash command:', error);
            
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'There was an error creating the poll!',
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: 'There was an error creating the poll!',
                    ephemeral: true
                });
            }
        }
    }

    if (interaction.commandName === 'pollconfig') {
        // Check if user has administrator permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: 'You need Administrator permissions to configure the poll bot!',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'channel':
                    const channel = interaction.options.getChannel('channel');
                    if (channel.type !== 0) { // Not a text channel
                        return await interaction.reply({
                            content: 'Please select a text channel!',
                            ephemeral: true
                        });
                    }
                    
                    await updateServerConfig(interaction.guild.id, { pollChannelId: channel.id });
                    await interaction.reply({
                        content: `Poll channel set to ${channel}`,
                        ephemeral: true
                    });
                    break;

                case 'role':
                    const role = interaction.options.getRole('role');
                    await updateServerConfig(interaction.guild.id, { pollRoleId: role.id });
                    await interaction.reply({
                        content: `Poll notification role set to ${role}`,
                        ephemeral: true
                    });
                    break;

                case 'color':
                    const color = interaction.options.getString('color');
                    // Validate hex color
                    if (!/^[0-9A-F]{6}$/i.test(color)) {
                        return await interaction.reply({
                            content: 'Please provide a valid 6-digit hex color code (e.g., FF5733)',
                            ephemeral: true
                        });
                    }
                    
                    await updateServerConfig(interaction.guild.id, { embedColor: color });
                    
                    const colorEmbed = new EmbedBuilder()
                        .setTitle('Embed color updated!')
                        .setDescription('This is how your polls will look with the new color.')
                        .setColor(parseInt(color, 16));
                    
                    await interaction.reply({
                        embeds: [colorEmbed],
                        ephemeral: true
                    });
                    break;

                case 'emojis':
                    const emojis = interaction.options.getString('emojis');
                    const emojiArray = emojis.split(',').map(e => e.trim());
                    
                    if (emojiArray.length < 2) {
                        return await interaction.reply({
                            content: 'Please provide at least 2 emojis separated by commas!',
                            ephemeral: true
                        });
                    }
                    
                    await updateServerConfig(interaction.guild.id, { defaultEmojis: emojis });
                    await interaction.reply({
                        content: `Default emojis set to: ${emojiArray.join(' ')}`,
                        ephemeral: true
                    });
                    break;

                case 'name':
                    const name = interaction.options.getString('name');
                    
                    // Update database
                    await updateServerConfig(interaction.guild.id, { botName: name });
                    
                    // Set the bot's nickname in this server
                    try {
                        await interaction.guild.members.me.setNickname(name);
                        await interaction.reply({
                            content: `Bot name and nickname set to: **${name}**`,
                            ephemeral: true
                        });
                    } catch (nicknameError) {
                        console.error('Error setting nickname:', nicknameError);
                        // Fallback if nickname change fails (permissions issue)
                        await interaction.reply({
                            content: `Bot name saved as: **${name}**\nNote: Could not change server nickname (may need "Change Nickname" permission)`,
                            ephemeral: true
                        });
                    }
                    break;

                case 'view':
                    const currentConfig = await getServerConfig(interaction.guild.id);
                    const channel_mention = currentConfig.poll_channel_id ? `<#${currentConfig.poll_channel_id}>` : 'Not set';
                    const role_mention = currentConfig.poll_role_id ? `<@&${currentConfig.poll_role_id}>` : 'Not set';
                    
                    const configEmbed = new EmbedBuilder()
                        .setTitle(`Poll Bot Configuration for ${interaction.guild.name}`)
                        .addFields(
                            { name: 'Bot Name', value: currentConfig.bot_name, inline: true },
                            { name: 'Poll Channel', value: channel_mention, inline: true },
                            { name: 'Notification Role', value: role_mention, inline: true },
                            { name: 'Embed Color', value: `#${currentConfig.embed_color}`, inline: true },
                            { name: 'Default Emojis', value: parseEmojis(currentConfig.default_emojis).join(' '), inline: false }
                        )
                        .setColor(parseColor(currentConfig.embed_color))
                        .setTimestamp();
                    
                    await interaction.reply({
                        embeds: [configEmbed],
                        ephemeral: true
                    });
                    break;

                default:
                    await interaction.reply({
                        content: 'Unknown configuration option!',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error handling pollconfig command:', error);
            await interaction.reply({
                content: 'There was an error updating the configuration!',
                ephemeral: true
            });
        }
    }
});

// Handle errors
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(config.token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});