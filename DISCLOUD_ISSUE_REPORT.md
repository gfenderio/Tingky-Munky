# 📋 Comprehensive Discloud Deployment & Runtime Issue Report

> **Project:** Tingky Munky (Discord Bot)  
> **Repository:** `gfenderio/Tingky-Munky`  
> **Platform:** Discloud (Free Tier, 100MB RAM)  
> **Runtime Environment:** Node.js (TypeScript compiled to JS) / discord.js v14  
> **Report Timestamp:** 2026-09-02  
> **Author/Context:** Diagnostic Report for Claude / External Agents  

---

## 1. Project Overview & Architecture

### Purpose
Tingky Munky is a private Discord server bot designed to automate daily scheduled reminders, interactive food ordering (/nitip), and randomized lunch picker (/makan-apa).

### Core Features & Scheduled Tasks
1. **Daily Reminders (Timezone: `Asia/Jakarta`):**
   - **Mon–Thu & Sat (11:50 WIB):** Sends lunch reminder `<@TARGET_USER_ID>` with attachment `./assets/asds.png`.
   - **Fri (11:45 WIB):** Sends Jumatan reminder with `./assets/jumatan.jpg`. Skips the 11:50 lunch reminder.
   - **Mon–Sat (17:30 WIB):** Sends ice cream reminder with `./assets/eskrim.png`.
   - **Sun:** Complete silence (all reminders skipped).
2. **State & Catch-up System:**
   - Persists daily sent state in `./data/sent_today.json` (`{ date: "YYYY-MM-DD", reminder1: boolean, reminder2: boolean, reminderJumatan: boolean }`).
   - On startup/restart, checks if the current time has passed 11:45/11:50/17:30 without being sent today. If missed, immediately triggers catch-up sending.
3. **Keep-Alive & Anti-Freeze:**
   - Internal 5-minute interval heartbeat logging.
   - Built-in HTTP server listening on `process.env.PORT || 3000` responding with HTTP 200 `Tingky Munky is alive!`.
4. **Interactive Features:**
   - `/nitip`: Modal, button, and select menu ordering system saved in `./data/nitip.json`.
   - `/makan-apa`: Ephemeral reroll button system that publicly announces the selected food when confirmed.
   - `/mung-joget`, `/asik`: Static slash commands.

---

## 2. Directory Structure & Key File Paths

```
Tingky Munky/
├── assets/
│   ├── asds.png          (1.7 MB - Lunch reminder image)
│   ├── asik.png          (0.2 MB - /asik image)
│   ├── banner.png        (2.5 MB - Repo banner for README)
│   ├── eskrim.png        (1.0 MB - Ice cream reminder image)
│   └── jumatan.jpg       (0.03 MB - Friday prayer image)
├── data/                 (Generated at runtime)
│   ├── nitip.json        (Persistent order batch data)
│   └── sent_today.json   (Daily reminder tracking)
├── src/
│   ├── index.ts          (Entry point, Client setup, event router, cron schedules)
│   ├── nitip.ts          (Nitip ordering business logic & UI components)
│   └── gacha.ts          (Makan-apa randomizer & interaction handlers)
├── index.js              (Standalone bundled single-file output via esbuild)
├── discloud.config       (Discloud container manifest)
├── package.json          (npm package manifest)
├── tsconfig.json         (TypeScript configuration)
├── .env                  (Discord token, Channel ID, Target User ID, Sticker ID, Asset paths)
└── bot.zip               (Deployment archive uploaded to Discloud web console)
```

---

## 3. Configuration Files Details

### `discloud.config`
```ini
NAME=Tingky-Munky
TYPE=bot
MAIN=index.js
RAM=100
AUTORESTART=true
VERSION=20
```

### `package.json`
```json
{
  "name": "tingky-munky",
  "version": "1.0.0",
  "description": "Tingky Munky Discord Bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.27.0",
    "dotenv": "^17.4.2",
    "node-cron": "^4.6.0"
  }
}
```

### `.env` (Structure)
```ini
DISCORD_TOKEN=<DISCORD_BOT_TOKEN>
CHANNEL_ID=1043393889475764224
TARGET_USER_ID=1050274433459290213
STICKER_ID=1531168585165176882
IMAGE_URL=./assets/asds.png
IMAGE_URL_2=./assets/eskrim.png
```

---

## 4. Issue Breakdown & Error Logs

Two distinct issues have occurred:

### Issue A: Runtime Network Timeout on Discloud (`UND_ERR_CONNECT_TIMEOUT`)

#### What Happens:
The bot runs continuously in Discloud (e.g., heartbeat logs fire normally every 5 minutes). However, when a scheduled reminder or catch-up execution attempts to send a Discord REST request (`client.channels.fetch` or `channel.send`), it times out after 10,000ms.

#### Raw Log Output:
```log
[Sep 01 11:50:00] Executing scheduled task 1 (11:50)...
[Sep 01 11:50:10] Gagal mengirim lampiran (Code: UND_ERR_CONNECT_TIMEOUT). Mengirim ulang teks saja...
[Sep 01 11:50:21] Failed to execute reminder 1: ConnectTimeoutError: Connect Timeout Error (attempted address: discord.com:443, timeout: 10000ms)
[Sep 01 11:50:21] at onConnectTimeout (/home/node/node_modules/undici/lib/core/connect.js:237:24)
[Sep 01 11:50:21] at Immediate._onImmediate (/home/node/node_modules/undici/lib/core/connect.js:206:11)
[Sep 01 11:50:21]     at process.processImmediate (node:internal/timers:534:21) {
[Sep 01 11:50:21] code: 'UND_ERR_CONNECT_TIMEOUT',
[Sep 01 11:50:21] Symbol(undici.error.UND_ERR): true,
[Sep 01 11:50:21] Symbol(undici.error.UND_ERR_CONNECT_TIMEOUT): true
[Sep 01 11:50:21] }
[Sep 01 11:52:47] [Heartbeat] Bot alive — 1/9/2026, 11.52.47
...
[Sep 01 12:23:43] [Anti-Crash] Unhandled Rejection: ConnectTimeoutError: Connect Timeout Error (attempted address: discord.com:443, timeout: 10000ms)
```

#### Cause:
Discord.js v14 uses `undici` for its REST requests with a default connect timeout of 10,000ms (10 seconds). Discloud's free container hosting occasionally experiences latency spikes to Discord API endpoints (`discord.com:443`) exceeding 10 seconds.

#### Code Fix Implemented in Repository:
1. **Client REST Configuration:**
   ```typescript
   const client = new Client({
       intents: [
           GatewayIntentBits.Guilds,
           GatewayIntentBits.GuildMessages,
       ],
       rest: {
           timeout: 60000, // Increased to 60 seconds
           retries: 5      // 5 automatic network retries
       }
   });
   ```
2. **Explicit Retry Wrapper:**
   ```typescript
   async function retry<T>(fn: () => Promise<T>, maxAttempts: number = 5, delayMs: number = 15000): Promise<T> {
       for (let attempt = 1; attempt <= maxAttempts; attempt++) {
           try {
               return await fn();
           } catch (error: any) {
               console.error(`[Retry] Attempt ${attempt}/${maxAttempts} failed: ${error.code || error.message}`);
               if (attempt === maxAttempts) throw error;
               await new Promise(resolve => setTimeout(resolve, delayMs));
           }
       }
       throw new Error('Retry failed');
   }
   ```

---

### Issue B: Discloud Web Builder Failure on Commit Upload (`Build process failed!`)

#### What Happens:
When uploading the updated `bot.zip` via Discloud Web Dashboard (`Commit` tab), the build process fails immediately during container setup with a red banner stating:
`We identified an error in your file package.json, correct it and try again.`

#### Raw Build Log:
```log
Initiating file download ...
Download completed successfully!
Checking commit files ...
Files uploaded to container successfully!
discloud-builder

#1 transferring discloud-builder: 599B 0.1s done
#1 DONE 0.1s
#2 ...
#3 DONE 0.0s
--------------------
   1 | >>> FROM node:lts-slim

   3 |     ENV DEBIAN_FRONTEND=noninteractive
--------------------
❌ Build process failed!
```

#### Key Observations on Issue B:
1. **The error occurs on `FROM node:lts-slim`**: The builder fails at Docker step 1 before it even runs `npm install` or reads `package.json`. Discloud's web interface displays `We identified an error in your file package.json` as a generic fallback message whenever `discloud-builder` returns a non-zero exit code.
2. **Current Zip Configuration:**
   - All TypeScript is pre-bundled into a single standalone `index.js` in the root (using `esbuild`).
   - `discloud.config` points to `MAIN=index.js`, `VERSION=20`.
   - `package.json` points to `"main": "index.js"`.
   - No `package-lock.json`, no `node_modules`, no `dist/` subfolder.
   - Archive size is reduced to ~2.9 MB.
   - Files inside `bot.zip`:
     - `index.js`
     - `discloud.config`
     - `package.json`
     - `.env`
     - `assets/asds.png`
     - `assets/asik.png`
     - `assets/eskrim.png`
     - `assets/jumatan.jpg`

---

## 5. Summary & Next Recommended Actions for Next Agent

1. **Deployment Mechanism:**
   - If Discloud's web UI builder continues to experience Docker Hub pulling issues on `FROM node:lts-slim`, check if uploading via Discloud CLI (`discloud commit`) or Discloud Discord bot (`.commit` command with `.zip`) produces different builder routing or provides verbose error output.
   - Alternatively, test alternative `VERSION=` values in `discloud.config` (e.g. `VERSION=current`, `VERSION=22`, `VERSION=18`).
2. **Runtime Verification:**
   - Verify that when deployed, the REST timeout of 60000ms prevents the `UND_ERR_CONNECT_TIMEOUT` failure and allows the catch-up mechanism to deliver any pending reminders immediately.
