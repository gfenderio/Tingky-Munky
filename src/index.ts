import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';

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

client.once('clientReady', () => {
    console.log(`Bot logged in as ${client.user?.tag}!`);

    // Schedule the task for 11:50 AM every day
    // The timezone is set to WIB (Asia/Jakarta)
    cron.schedule('50 11 * * *', async () => {
        try {
            console.log("Executing scheduled task...");
            const channel = await client.channels.fetch(channelId);
            
            if (channel && channel.isTextBased()) {
                await (channel as TextChannel).send({
                    content: `Halo <@${targetUserId}>, ini reminder harianmu!`,
                    stickers: [stickerId]
                });
                console.log("Reminder sent successfully.");
            } else {
                console.error("Channel not found or is not a text channel.");
            }
        } catch (error) {
            console.error("Failed to send reminder:", error);
        }
    }, {
        timezone: "Asia/Jakarta"
    });
    
    console.log("Cron job scheduled for 11:50 AM WIB.");
});

client.login(token);
