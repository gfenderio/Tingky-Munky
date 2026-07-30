import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, Interaction } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { handleNitipCommand, handleNitipButton, handleNitipModal, handleNitipSelect } from './nitip';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const targetUserId = process.env.TARGET_USER_ID;
const stickerId = process.env.STICKER_ID;

if (!token || !channelId || !targetUserId || !stickerId) {
    console.error("Missing required environment variables.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Listener untuk semua interaction (slash command, button, modal, select menu)
client.on('interactionCreate', async (interaction: Interaction) => {

    // === SLASH COMMANDS ===
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'mung-joget') {
            await interaction.reply('https://klipy.com/gifs/dog-dance-brazil-dance');
        }

        if (interaction.commandName === 'asik') {
            await interaction.reply({
                content: 'LO ASIK BANG',
                files: ['./assets/asik.png']
            });
        }

        if (interaction.commandName === 'makan-siang') {
            const messageOptions: any = {
                content: `<@${targetUserId}>`
            };
            
            if (process.env.IMAGE_URL) {
                messageOptions.files = [process.env.IMAGE_URL];
            } else if (stickerId) {
                messageOptions.stickers = [stickerId];
            }

            try {
                await interaction.reply(messageOptions);
            } catch (error) {
                console.error("Error responding to /makan-siang:", error);
                await interaction.reply({ content: `<@${targetUserId}>\n*(Catatan: Gambar gagal dimuat)*`, ephemeral: true });
            }
        }

        if (interaction.commandName === 'nitip') {
            await handleNitipCommand(interaction);
        }

        return;
    }

    // === BUTTON INTERACTIONS ===
    if (interaction.isButton() && interaction.customId.startsWith('nitip_')) {
        await handleNitipButton(interaction);
        return;
    }

    // === MODAL SUBMIT ===
    if (interaction.isModalSubmit() && interaction.customId === 'nitip_modal') {
        await handleNitipModal(interaction);
        return;
    }

    // === SELECT MENU ===
    if (interaction.isStringSelectMenu() && interaction.customId === 'nitip_hapus_select') {
        await handleNitipSelect(interaction);
        return;
    }
});

client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user?.tag}!`);

    // Mendaftarkan Slash Command ke Server (Guild)
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased() && 'guildId' in channel) {
            const guildId = (channel as any).guildId;
            const clientId = client.user?.id;
            
            if (guildId && clientId) {
                const rest = new REST({ version: '10' }).setToken(token);
                
                const commands = [
                    new SlashCommandBuilder()
                        .setName('mung-joget')
                        .setDescription('Menampilkan GIF Mung joget')
                        .toJSON(),
                    new SlashCommandBuilder()
                        .setName('makan-siang')
                        .setDescription('Menampilkan gambar makan siang 11:50')
                        .toJSON(),
                    new SlashCommandBuilder()
                        .setName('asik')
                        .setDescription('Menampilkan GIF Coach Justin')
                        .toJSON(),
                    new SlashCommandBuilder()
                        .setName('nitip')
                        .setDescription('Buka panel nitip — tambah, lihat, hapus titipan')
                        .toJSON(),
                ];

                console.log('Started refreshing application (/) commands.');
                await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: commands },
                );
                console.log('Successfully reloaded application (/) commands.');
            }
        }
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }

    // Reminder 1: Jam 11:50 WIB
    cron.schedule('50 11 * * *', async () => {
        try {
            console.log("Executing scheduled task 1 (11:50)...");
            const channel = await client.channels.fetch(channelId);
            
            if (channel && channel.isTextBased()) {
                try {
                    const messageOptions: any = {
                        content: `<@${targetUserId}>`
                    };
                    
                    if (process.env.IMAGE_URL) {
                        messageOptions.files = [process.env.IMAGE_URL];
                    } else if (stickerId) {
                        messageOptions.stickers = [stickerId];
                    }

                    await (channel as TextChannel).send(messageOptions);
                    console.log("Reminder 1 sent successfully.");
                } catch (sendError: any) {
                    console.error(`Gagal mengirim lampiran (Code: ${sendError.code}). Mengirim ulang teks saja...`);
                    await (channel as TextChannel).send({
                        content: `Halo <@${targetUserId}>, ini reminder harianmu!\n*(Catatan: Gambar atau Stiker gagal dimuat)*`
                    });
                }
            }
        } catch (error) {
            console.error("Failed to execute reminder 1:", error);
        }
    }, {
        timezone: "Asia/Jakarta"
    });

    // Reminder 2: Jam 17:30 WIB
    cron.schedule('30 17 * * *', async () => {
        try {
            console.log("Executing scheduled task 2 (17:30)...");
            const channel = await client.channels.fetch(channelId);
            
            if (channel && channel.isTextBased()) {
                try {
                    const messageOptions: any = {};
                    
                    if (process.env.IMAGE_URL_2) {
                        messageOptions.files = [process.env.IMAGE_URL_2];
                    } else {
                        messageOptions.content = "Waktunya beli eskrim!"; // Fallback jika gambar hilang
                    }

                    await (channel as TextChannel).send(messageOptions);
                    console.log("Reminder 2 sent successfully.");
                } catch (sendError: any) {
                    console.error(`Gagal mengirim lampiran 2 (Code: ${sendError.code}). Mengirim ulang teks saja...`);
                    await (channel as TextChannel).send({
                        content: `<@${targetUserId}>\n*(Catatan: Gambar gagal dimuat)*`
                    });
                }
            }
        } catch (error) {
            console.error("Failed to execute reminder 2:", error);
        }
    }, {
        timezone: "Asia/Jakarta"
    });
    
    console.log("Cron job scheduled for 11:50 AM WIB.");
});

client.login(token);
