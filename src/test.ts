import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
    try {
        console.log("Test bot ready, sending message...");
        const channel = await client.channels.fetch(process.env.CHANNEL_ID!);
        if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({
                content: `Halo <@${process.env.TARGET_USER_ID}>, ini test gambar!`,
                files: [process.env.IMAGE_URL!]
            });
            console.log("Test success!");
        }
    } catch (e) {
        console.error("Test failed:", e);
    }
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
