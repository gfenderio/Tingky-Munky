import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, Interaction } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { handleNitipCommand, handleNitipButton, handleNitipModal, handleNitipSelect } from './nitip';
import { handleMakanApaCommand, handleGachaButton } from './gacha';
import { dataFile, assetFile, resolveAssetPath } from './paths';

dotenv.config();

// === PERBAIKAN UND_ERR_CONNECT_TIMEOUT ===
// Error `Connect Timeout Error (attempted address: discord.com:443, timeout: 10000ms)`
// datang dari fase CONNECT-nya undici, bukan dari timeout request discord.js.
// Opsi `rest.timeout` TIDAK menyentuh angka 10 detik itu — harus lewat Agent undici.
//
// 1. Utamakan IPv4. Container Discloud sering tidak punya rute IPv6, tapi Node
//    mencoba alamat IPv6 duluan lalu menggantung sampai timeout.
try {
    dns.setDefaultResultOrder('ipv4first');
} catch { /* Node lama tidak punya API ini */ }

// 2. Naikkan connect timeout 10s -> 60s, dan pakai keep-alive supaya koneksi
//    yang sudah jadi dipakai ulang (mayoritas request tidak connect ulang).
const discordAgent = new Agent({
    connect: { timeout: 60_000 },
    connectTimeout: 60_000,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 120_000,
});
setGlobalDispatcher(discordAgent);

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
    ],
    rest: {
        timeout: 60000,   // batas satu request
        retries: 5,       // ulang otomatis untuk error 5xx / timeout
        agent: discordAgent
    }
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
                files: [assetFile('asik.png')]
            });
        }

        if (interaction.commandName === 'makan-siang') {
            const messageOptions: any = {
                content: `<@${targetUserId}>`
            };
            
            if (process.env.IMAGE_URL) {
                messageOptions.files = [resolveAssetPath(process.env.IMAGE_URL)];
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
    const TRACK_FILE = dataFile('sent_today.json');

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

    // === RETRY HELPER ===
    async function retry<T>(fn: () => Promise<T>, maxAttempts: number = 5, delayMs: number = 15000): Promise<T> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                console.error(`[Retry] Attempt ${attempt}/${maxAttempts} failed: ${error.code || error.message}`);
                if (attempt === maxAttempts) throw error;
                console.log(`[Retry] Waiting ${delayMs / 1000}s before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        throw new Error('Retry failed');
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
            await retry(async () => {
                const channel = await client.channels.fetch(channelId!);
                
                if (channel && channel.isTextBased()) {
                    const messageOptions: any = {
                        content: `<@${targetUserId}>`
                    };
                    
                    if (process.env.IMAGE_URL) {
                        messageOptions.files = [resolveAssetPath(process.env.IMAGE_URL)];
                    } else if (stickerId) {
                        messageOptions.stickers = [stickerId];
                    }

                    await (channel as TextChannel).send(messageOptions);
                }
            });
            console.log("Reminder 1 sent successfully.");

            const tracker = loadTracker();
            tracker.reminder1 = true;
            saveTracker(tracker);
        } catch (error) {
            console.error("Failed to execute reminder 1 after all retries:", error);
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
            await retry(async () => {
                const channel = await client.channels.fetch(channelId!);
                
                if (channel && channel.isTextBased()) {
                    const messageOptions: any = {};
                    
                    if (process.env.IMAGE_URL_2) {
                        messageOptions.files = [resolveAssetPath(process.env.IMAGE_URL_2)];
                    } else {
                        messageOptions.content = "Waktunya beli eskrim!";
                    }

                    await (channel as TextChannel).send(messageOptions);
                }
            });
            console.log("Reminder 2 sent successfully.");

            const tracker = loadTracker();
            tracker.reminder2 = true;
            saveTracker(tracker);
        } catch (error) {
            console.error("Failed to execute reminder 2 after all retries:", error);
        }
    }

    // === FUNGSI KIRIM JUMATAN ===
    async function sendJumatan(): Promise<void> {
        try {
            console.log("Executing Jumatan reminder (11:45)...");
            await retry(async () => {
                const channel = await client.channels.fetch(channelId!);
                
                if (channel && channel.isTextBased()) {
                    await (channel as TextChannel).send({
                        files: [assetFile('jumatan.jpg')]
                    });
                }
            });
            console.log("Jumatan reminder sent successfully.");

            const tracker = loadTracker();
            tracker.reminderJumatan = true;
            saveTracker(tracker);
        } catch (error) {
            console.error("Failed to send Jumatan reminder after all retries:", error);
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
