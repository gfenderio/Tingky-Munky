import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, Interaction } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { handleNitipCommand, handleNitipButton, handleNitipModal, handleNitipSelect } from './nitip';
import { handleMakanApaCommand, handleGachaButton } from './gacha';

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

// === GLOBAL ERROR HANDLERS (anti-crash) ===
process.on('unhandledRejection', (error) => {
    console.error('[Anti-Crash] Unhandled Rejection:', error);
});
process.on('uncaughtException', (error) => {
    console.error('[Anti-Crash] Uncaught Exception:', error);
});
client.on('error', (error) => {
    console.error('[Anti-Crash] Client Error:', error);
});

// Listener untuk semua interaction (slash command, button, modal, select menu)
client.on('interactionCreate', async (interaction: Interaction) => {
  try {
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
                await interaction.reply({ content: `<@${targetUserId}>\n*(Catatan: Gambar gagal dimuat)*`, ephemeral: true }).catch(() => {});
            }
        }

        if (interaction.commandName === 'nitip') {
            await handleNitipCommand(interaction);
        }

        if (interaction.commandName === 'makan-apa') {
            await handleMakanApaCommand(interaction);
        }

        return;
    }

    // === BUTTON INTERACTIONS ===
    if (interaction.isButton() && interaction.customId.startsWith('nitip_')) {
        await handleNitipButton(interaction);
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('gacha_')) {
        await handleGachaButton(interaction);
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
  } catch (error) {
    console.error('[Anti-Crash] Interaction error:', error);
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
                    new SlashCommandBuilder()
                        .setName('makan-apa')
                        .setDescription('Gacha makanan random buat makan siang')
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

    // === SISTEM TRACKING HARIAN ===
    const fs = await import('fs');
    const pathMod = await import('path');
    const TRACK_FILE = pathMod.join(__dirname, '..', 'data', 'sent_today.json');

    function getTodayDate(): string {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // format YYYY-MM-DD
    }

    function loadTracker(): { date: string; reminder1: boolean; reminder2: boolean; reminderJumatan: boolean } {
        try {
            const dir = pathMod.dirname(TRACK_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (fs.existsSync(TRACK_FILE)) {
                const data = JSON.parse(fs.readFileSync(TRACK_FILE, 'utf-8'));
                if (data.date === getTodayDate()) return data;
            }
        } catch (e) { /* ignore */ }
        return { date: getTodayDate(), reminder1: false, reminder2: false, reminderJumatan: false };
    }

    function saveTracker(tracker: { date: string; reminder1: boolean; reminder2: boolean; reminderJumatan: boolean }): void {
        const dir = pathMod.dirname(TRACK_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(TRACK_FILE, JSON.stringify(tracker, null, 2), 'utf-8');
    }

    function isFriday(): boolean {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        return now.getDay() === 5; // 5 = Jumat
    }

    function isSunday(): boolean {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        return now.getDay() === 0; // 0 = Minggu
    }

    // === FUNGSI KIRIM REMINDER ===
    async function sendReminder1(): Promise<void> {
        // Skip hari Minggu dan Jumat
        if (isSunday() || isFriday()) {
            console.log(`Hari ${isSunday() ? 'Minggu' : 'Jumat'}, skip reminder 1 (makan siang).`);
            const tracker = loadTracker();
            tracker.reminder1 = true;
            saveTracker(tracker);
            return;
        }
        try {
            console.log("Executing scheduled task 1 (11:50)...");
            const channel = await client.channels.fetch(channelId!);
            
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

                    const tracker = loadTracker();
                    tracker.reminder1 = true;
                    saveTracker(tracker);
                } catch (sendError: any) {
                    console.error(`Gagal mengirim lampiran (Code: ${sendError.code}). Mengirim ulang teks saja...`);
                    await (channel as TextChannel).send({
                        content: `Halo <@${targetUserId}>, ini reminder harianmu!\n*(Catatan: Gambar atau Stiker gagal dimuat)*`
                    });
                    const tracker = loadTracker();
                    tracker.reminder1 = true;
                    saveTracker(tracker);
                }
            }
        } catch (error) {
            console.error("Failed to execute reminder 1:", error);
        }
    }

    async function sendReminder2(): Promise<void> {
        // Skip hari Minggu
        if (isSunday()) {
            console.log("Hari Minggu, skip reminder 2 (eskrim).");
            const tracker = loadTracker();
            tracker.reminder2 = true;
            saveTracker(tracker);
            return;
        }
        try {
            console.log("Executing scheduled task 2 (17:30)...");
            const channel = await client.channels.fetch(channelId!);
            
            if (channel && channel.isTextBased()) {
                try {
                    const messageOptions: any = {};
                    
                    if (process.env.IMAGE_URL_2) {
                        messageOptions.files = [process.env.IMAGE_URL_2];
                    } else {
                        messageOptions.content = "Waktunya beli eskrim!";
                    }

                    await (channel as TextChannel).send(messageOptions);
                    console.log("Reminder 2 sent successfully.");

                    const tracker = loadTracker();
                    tracker.reminder2 = true;
                    saveTracker(tracker);
                } catch (sendError: any) {
                    console.error(`Gagal mengirim lampiran 2 (Code: ${sendError.code}). Mengirim ulang teks saja...`);
                    await (channel as TextChannel).send({
                        content: `<@${targetUserId}>\n*(Catatan: Gambar gagal dimuat)*`
                    });
                    const tracker = loadTracker();
                    tracker.reminder2 = true;
                    saveTracker(tracker);
                }
            }
        } catch (error) {
            console.error("Failed to execute reminder 2:", error);
        }
    }

    // === FUNGSI KIRIM JUMATAN ===
    async function sendJumatan(): Promise<void> {
        try {
            console.log("Executing Jumatan reminder (11:45)...");
            const channel = await client.channels.fetch(channelId!);
            
            if (channel && channel.isTextBased()) {
                await (channel as TextChannel).send({
                    files: ['./assets/jumatan.jpg']
                });
                console.log("Jumatan reminder sent successfully.");

                const tracker = loadTracker();
                tracker.reminderJumatan = true;
                saveTracker(tracker);
            }
        } catch (error) {
            console.error("Failed to send Jumatan reminder:", error);
        }
    }

    // === CATCH-UP: Cek apakah ada reminder yang kelewat hari ini ===
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const tracker = loadTracker();

    // Jumat: cek Jumatan (11:45)
    if (isFriday() && (currentHour > 11 || (currentHour === 11 && currentMinute >= 45)) && !tracker.reminderJumatan) {
        console.log("[Catch-up] Jumatan (11:45) belum terkirim hari ini! Mengirim sekarang...");
        await sendJumatan();
    }

    // Kalau sekarang sudah lewat 11:50 tapi reminder 1 belum terkirim hari ini
    if ((currentHour > 11 || (currentHour === 11 && currentMinute >= 50)) && !tracker.reminder1) {
        console.log("[Catch-up] Reminder 1 (11:50) belum terkirim hari ini! Mengirim sekarang...");
        await sendReminder1();
    }

    // Kalau sekarang sudah lewat 17:30 tapi reminder 2 belum terkirim hari ini
    if ((currentHour > 17 || (currentHour === 17 && currentMinute >= 30)) && !tracker.reminder2) {
        console.log("[Catch-up] Reminder 2 (17:30) belum terkirim hari ini! Mengirim sekarang...");
        await sendReminder2();
    }

    // === CRON JOBS ===
    cron.schedule('45 11 * * 5', async () => { await sendJumatan(); }, { timezone: "Asia/Jakarta" }); // Jumat 11:45
    cron.schedule('50 11 * * *', async () => { await sendReminder1(); }, { timezone: "Asia/Jakarta" });
    cron.schedule('30 17 * * *', async () => { await sendReminder2(); }, { timezone: "Asia/Jakarta" });
    
    console.log("Cron job scheduled for 11:45 (Jumat), 11:50, and 17:30 WIB.");

    // Heartbeat: log setiap 5 menit supaya Discloud tidak nge-freeze bot
    setInterval(() => {
        console.log(`[Heartbeat] Bot alive — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    }, 5 * 60 * 1000);
});

// Keep-alive HTTP server supaya Discloud tahu bot masih aktif
import http from 'http';
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Tingky Munky is alive!');
});
server.listen(process.env.PORT || 3000, () => {
    console.log('Keep-alive server running.');
});

client.login(token);
