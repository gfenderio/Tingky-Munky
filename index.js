"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_discord3 = require("discord.js");
var import_node_cron = __toESM(require("node-cron"));
var import_dotenv = __toESM(require("dotenv"));

// src/nitip.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_discord = require("discord.js");
function formatRupiah(amount) {
  return "Rp " + amount.toLocaleString("id-ID");
}
var DATA_FILE = path.join(__dirname, "..", "data", "nitip.json");
function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function loadData() {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  }
  const defaultData = {
    currentBatch: {
      number: 1,
      status: "open",
      orders: []
    }
  };
  saveData(defaultData);
  return defaultData;
}
function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function buildMainEmbed(data) {
  const batch = data.currentBatch;
  const statusEmoji = batch.status === "open" ? "\u{1F7E2} BUKA" : "\u{1F534} TUTUP";
  const embed = new import_discord.EmbedBuilder().setTitle(`\u{1F4E6} DAFTAR NITIP \u2014 Batch #${batch.number}`).setColor(batch.status === "open" ? 65280 : 16711680).setFooter({ text: `Status: ${statusEmoji}` }).setTimestamp();
  if (batch.orders.length === 0) {
    embed.setDescription("Belum ada yang nitip.");
  } else {
    let desc = "";
    let totalHarga = 0;
    batch.orders.forEach((order, i) => {
      desc += `**${i + 1}.** <@${order.userId}> \u2014 ${order.pesanan} \u2022 **${formatRupiah(order.harga)}**`;
      if (order.catatan) {
        desc += `
   \u{1F4DD} ${order.catatan}`;
      }
      desc += "\n";
      totalHarga += order.harga;
    });
    desc += `
**Total: ${batch.orders.length} titipan**`;
    desc += `
\u{1F4B0} **Total Harga: ${formatRupiah(totalHarga)}**`;
    embed.setDescription(desc);
  }
  return embed;
}
function buildMainButtons(data) {
  const batch = data.currentBatch;
  const isOpen = batch.status === "open";
  const row1 = new import_discord.ActionRowBuilder().addComponents(
    new import_discord.ButtonBuilder().setCustomId("nitip_tambah").setLabel("Tambah Titipan").setEmoji("\u2795").setStyle(import_discord.ButtonStyle.Success).setDisabled(!isOpen),
    new import_discord.ButtonBuilder().setCustomId("nitip_list").setLabel("Lihat List").setEmoji("\u{1F4CB}").setStyle(import_discord.ButtonStyle.Primary),
    new import_discord.ButtonBuilder().setCustomId("nitip_hapus").setLabel("Hapus Titipan").setEmoji("\u274C").setStyle(import_discord.ButtonStyle.Danger).setDisabled(!isOpen || batch.orders.length === 0)
  );
  const row2 = new import_discord.ActionRowBuilder().addComponents(
    new import_discord.ButtonBuilder().setCustomId("nitip_tutup").setLabel("Tutup Batch").setEmoji("\u{1F512}").setStyle(import_discord.ButtonStyle.Secondary).setDisabled(!isOpen),
    new import_discord.ButtonBuilder().setCustomId("nitip_buka").setLabel("Buka Batch Baru").setEmoji("\u{1F513}").setStyle(import_discord.ButtonStyle.Secondary)
  );
  return [row1, row2];
}
async function handleNitipCommand(interaction) {
  const data = loadData();
  const embed = buildMainEmbed(data);
  const buttons = buildMainButtons(data);
  await interaction.reply({
    embeds: [embed],
    components: buttons
  });
}
async function handleNitipButton(interaction) {
  const customId = interaction.customId;
  if (customId === "nitip_tambah") {
    await handleTambah(interaction);
  } else if (customId === "nitip_list") {
    await handleList(interaction);
  } else if (customId === "nitip_hapus") {
    await handleHapusMenu(interaction);
  } else if (customId === "nitip_tutup") {
    await handleTutup(interaction);
  } else if (customId === "nitip_buka") {
    await handleBukaBaru(interaction);
  }
}
async function handleNitipModal(interaction) {
  if (interaction.customId !== "nitip_modal") return;
  const nama = interaction.fields.getTextInputValue("nitip_nama");
  const pesanan = interaction.fields.getTextInputValue("nitip_pesanan");
  const hargaRaw = interaction.fields.getTextInputValue("nitip_harga");
  const catatan = interaction.fields.getTextInputValue("nitip_catatan") || "";
  const harga = parseInt(hargaRaw.replace(/\D/g, "")) || 0;
  const data = loadData();
  if (data.currentBatch.status === "closed") {
    await interaction.reply({ content: "\u274C Batch sudah ditutup! Tidak bisa menambah titipan.", ephemeral: true });
    return;
  }
  const newOrder = {
    userId: interaction.user.id,
    userName: nama,
    pesanan,
    harga,
    catatan,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  data.currentBatch.orders.push(newOrder);
  saveData(data);
  const embed = buildMainEmbed(data);
  const buttons = buildMainButtons(data);
  await interaction.reply({
    content: `\u2705 Titipan untuk **${nama}** berhasil ditambahkan!`,
    embeds: [embed],
    components: buttons
  });
}
async function handleNitipSelect(interaction) {
  if (interaction.customId !== "nitip_hapus_select") return;
  const index = parseInt(interaction.values[0]);
  const data = loadData();
  if (index < 0 || index >= data.currentBatch.orders.length) {
    await interaction.reply({ content: "\u274C Titipan tidak ditemukan.", ephemeral: true });
    return;
  }
  const removed = data.currentBatch.orders.splice(index, 1)[0];
  saveData(data);
  const embed = buildMainEmbed(data);
  const buttons = buildMainButtons(data);
  await interaction.reply({
    content: `\u{1F5D1}\uFE0F Titipan **${removed.userName}** \u2014 *${removed.pesanan}* berhasil dihapus!`,
    embeds: [embed],
    components: buttons
  });
}
async function handleTambah(interaction) {
  const modal = new import_discord.ModalBuilder().setCustomId("nitip_modal").setTitle("Tambah Titipan");
  const namaInput = new import_discord.TextInputBuilder().setCustomId("nitip_nama").setLabel("Nama (otomatis nama kamu, bisa diganti)").setStyle(import_discord.TextInputStyle.Short).setValue(interaction.user.displayName || interaction.user.username).setRequired(true).setMaxLength(50);
  const pesananInput = new import_discord.TextInputBuilder().setCustomId("nitip_pesanan").setLabel("Pesanan").setPlaceholder("Contoh: Nasi Goreng Spesial + Es Teh").setStyle(import_discord.TextInputStyle.Short).setRequired(true).setMaxLength(200);
  const hargaInput = new import_discord.TextInputBuilder().setCustomId("nitip_harga").setLabel("Harga (Rupiah)").setPlaceholder("Contoh: 15000").setStyle(import_discord.TextInputStyle.Short).setRequired(true).setMaxLength(20);
  const catatanInput = new import_discord.TextInputBuilder().setCustomId("nitip_catatan").setLabel("Catatan (opsional)").setPlaceholder("Contoh: Ga pake sambal, Level 5").setStyle(import_discord.TextInputStyle.Short).setRequired(false).setMaxLength(200);
  modal.addComponents(
    new import_discord.ActionRowBuilder().addComponents(namaInput),
    new import_discord.ActionRowBuilder().addComponents(pesananInput),
    new import_discord.ActionRowBuilder().addComponents(hargaInput),
    new import_discord.ActionRowBuilder().addComponents(catatanInput)
  );
  await interaction.showModal(modal);
}
async function handleList(interaction) {
  const data = loadData();
  const embed = buildMainEmbed(data);
  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
async function handleHapusMenu(interaction) {
  const data = loadData();
  if (data.currentBatch.orders.length === 0) {
    await interaction.reply({ content: "\u{1F4ED} Tidak ada titipan untuk dihapus.", ephemeral: true });
    return;
  }
  const options = data.currentBatch.orders.map((order, i) => ({
    label: `${order.userName} \u2014 ${order.pesanan}`.substring(0, 100),
    description: `${formatRupiah(order.harga)}${order.catatan ? " | " + order.catatan : ""}`.substring(0, 100),
    value: i.toString()
  }));
  const select = new import_discord.StringSelectMenuBuilder().setCustomId("nitip_hapus_select").setPlaceholder("Pilih titipan yang mau dihapus...").addOptions(options);
  const row = new import_discord.ActionRowBuilder().addComponents(select);
  await interaction.reply({
    content: "\u{1F5D1}\uFE0F Pilih titipan yang ingin dihapus:",
    components: [row],
    ephemeral: true
  });
}
async function handleTutup(interaction) {
  const data = loadData();
  if (data.currentBatch.status === "closed") {
    await interaction.reply({ content: "\u274C Batch sudah ditutup.", ephemeral: true });
    return;
  }
  data.currentBatch.status = "closed";
  saveData(data);
  const embed = buildMainEmbed(data);
  const buttons = buildMainButtons(data);
  const totalHarga = data.currentBatch.orders.reduce((sum, o) => sum + o.harga, 0);
  await interaction.reply({
    content: `\u{1F512} **Batch #${data.currentBatch.number} sudah DITUTUP!** Total ${data.currentBatch.orders.length} titipan \u2014 \u{1F4B0} ${formatRupiah(totalHarga)}`,
    embeds: [embed],
    components: buttons
  });
}
async function handleBukaBaru(interaction) {
  const data = loadData();
  const newBatchNumber = data.currentBatch.number + 1;
  data.currentBatch = {
    number: newBatchNumber,
    status: "open",
    orders: []
  };
  saveData(data);
  const embed = buildMainEmbed(data);
  const buttons = buildMainButtons(data);
  await interaction.reply({
    content: `\u{1F513} **Batch #${newBatchNumber} sudah DIBUKA!** Silakan mulai nitip.`,
    embeds: [embed],
    components: buttons
  });
}

// src/gacha.ts
var import_discord2 = require("discord.js");
var foodList = [
  "nasi geprek murah meriah",
  "nasi padang jereng",
  "ketoprak coklat",
  "mie ayam",
  "soto",
  "batagor gapake tahu jadi bagor",
  "batagor pake tahu",
  "pop es",
  "somay",
  "kebab israel",
  "kebab bang aji pake sausnya aji",
  "cimol kentang",
  "cimol kentang tapi cimolnya aja",
  "cimol kentang tapi kentangtingtangtingtung",
  "papeda",
  "cilor tana apid yang ditusuk",
  "cilor yang dibenyek",
  "es teh yang ijo",
  "es teh yang ijo tapi udah luntur jadi merah",
  "cireng yang bikin gilang mencret jadi gaikut main mecha chameleon",
  "grabfood aja biar keren kaya mas shinwe",
  "daging kodok dapur hociak",
  "ayam penyet yang bannernya ai slop",
  "es teh panas manis tawar"
];
function getRandomFood(currentFood) {
  let newFood = currentFood;
  if (foodList.length > 1) {
    while (newFood === currentFood) {
      const randomIndex = Math.floor(Math.random() * foodList.length);
      newFood = foodList[randomIndex];
    }
  } else {
    newFood = foodList[0];
  }
  return newFood || "Tidak ada makanan di list";
}
function buildGachaComponents() {
  return new import_discord2.ActionRowBuilder().addComponents(
    new import_discord2.ButtonBuilder().setCustomId("gacha_ganti").setLabel("Gamau ah").setEmoji("\u{1F504}").setStyle(import_discord2.ButtonStyle.Danger),
    new import_discord2.ButtonBuilder().setCustomId("gacha_fix").setLabel("Ini aja deh").setEmoji("\u2705").setStyle(import_discord2.ButtonStyle.Success)
  );
}
async function handleMakanApaCommand(interaction) {
  const food = getRandomFood();
  const row = buildGachaComponents();
  await interaction.reply({
    content: `\u{1F3B2} Hari ini makan **${food}** aja! Gimana?`,
    components: [row],
    ephemeral: true
    // Hanya terlihat oleh yang manggil
  });
}
async function handleGachaButton(interaction) {
  if (interaction.customId === "gacha_ganti") {
    const currentMessage = interaction.message.content;
    const currentFoodMatch = currentMessage.match(/\*\*(.*?)\*\*/);
    const currentFood = currentFoodMatch ? currentFoodMatch[1] : void 0;
    const newFood = getRandomFood(currentFood);
    const row = buildGachaComponents();
    await interaction.update({
      content: `\u{1F3B2} Kalo gitu makan **${newFood}** aja! Gimana?`,
      components: [row]
    });
  } else if (interaction.customId === "gacha_fix") {
    const currentMessage = interaction.message.content;
    const currentFoodMatch = currentMessage.match(/\*\*(.*?)\*\*/);
    const currentFood = currentFoodMatch ? currentFoodMatch[1] : "makanan misterius";
    await interaction.update({
      content: `\u2705 Mantap! Pilihanmu sudah diumumkan.`,
      components: []
    });
    if (interaction.channel && "send" in interaction.channel) {
      await interaction.channel.send(`Si <@${interaction.user.id}> mau beli **${currentFood}**`);
    }
  }
}

// src/index.ts
var import_http = __toESM(require("http"));
import_dotenv.default.config();
var token = process.env.DISCORD_TOKEN;
var channelId = process.env.CHANNEL_ID;
var targetUserId = process.env.TARGET_USER_ID;
var stickerId = process.env.STICKER_ID;
if (!token || !channelId || !targetUserId || !stickerId) {
  console.error("Missing required environment variables.");
  process.exit(1);
}
var client = new import_discord3.Client({
  intents: [
    import_discord3.GatewayIntentBits.Guilds,
    import_discord3.GatewayIntentBits.GuildMessages
  ],
  rest: {
    timeout: 6e4,
    retries: 5
  }
});
process.on("unhandledRejection", (error) => {
  console.error("[Anti-Crash] Unhandled Rejection:", error);
});
process.on("uncaughtException", (error) => {
  console.error("[Anti-Crash] Uncaught Exception:", error);
});
client.on("error", (error) => {
  console.error("[Anti-Crash] Client Error:", error);
});
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "mung-joget") {
        await interaction.reply("https://klipy.com/gifs/dog-dance-brazil-dance");
      }
      if (interaction.commandName === "asik") {
        await interaction.reply({
          content: "LO ASIK BANG",
          files: ["./assets/asik.png"]
        });
      }
      if (interaction.commandName === "makan-siang") {
        const messageOptions = {
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
          await interaction.reply({ content: `<@${targetUserId}>
*(Catatan: Gambar gagal dimuat)*`, ephemeral: true }).catch(() => {
          });
        }
      }
      if (interaction.commandName === "nitip") {
        await handleNitipCommand(interaction);
      }
      if (interaction.commandName === "makan-apa") {
        await handleMakanApaCommand(interaction);
      }
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith("nitip_")) {
      await handleNitipButton(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith("gacha_")) {
      await handleGachaButton(interaction);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === "nitip_modal") {
      await handleNitipModal(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === "nitip_hapus_select") {
      await handleNitipSelect(interaction);
      return;
    }
  } catch (error) {
    console.error("[Anti-Crash] Interaction error:", error);
  }
});
client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user?.tag}!`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased() && "guildId" in channel) {
      const guildId = channel.guildId;
      const clientId = client.user?.id;
      if (guildId && clientId) {
        const rest = new import_discord3.REST({ version: "10" }).setToken(token);
        const commands = [
          new import_discord3.SlashCommandBuilder().setName("mung-joget").setDescription("Menampilkan GIF Mung joget").toJSON(),
          new import_discord3.SlashCommandBuilder().setName("makan-siang").setDescription("Menampilkan gambar makan siang 11:50").toJSON(),
          new import_discord3.SlashCommandBuilder().setName("asik").setDescription("Menampilkan GIF Coach Justin").toJSON(),
          new import_discord3.SlashCommandBuilder().setName("nitip").setDescription("Buka panel nitip \u2014 tambah, lihat, hapus titipan").toJSON(),
          new import_discord3.SlashCommandBuilder().setName("makan-apa").setDescription("Gacha makanan random buat makan siang").toJSON()
        ];
        console.log("Started refreshing application (/) commands.");
        await rest.put(
          import_discord3.Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        console.log("Successfully reloaded application (/) commands.");
      }
    }
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
  const fs2 = await import("fs");
  const pathMod = await import("path");
  const TRACK_FILE = pathMod.join(__dirname, "..", "data", "sent_today.json");
  function getTodayDate() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  }
  function loadTracker() {
    try {
      const dir = pathMod.dirname(TRACK_FILE);
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
      if (fs2.existsSync(TRACK_FILE)) {
        const data = JSON.parse(fs2.readFileSync(TRACK_FILE, "utf-8"));
        if (data.date === getTodayDate()) return data;
      }
    } catch (e) {
    }
    return { date: getTodayDate(), reminder1: false, reminder2: false, reminderJumatan: false };
  }
  function saveTracker(tracker2) {
    const dir = pathMod.dirname(TRACK_FILE);
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    fs2.writeFileSync(TRACK_FILE, JSON.stringify(tracker2, null, 2), "utf-8");
  }
  function isFriday() {
    const now2 = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return now2.getDay() === 5;
  }
  function isSunday() {
    const now2 = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return now2.getDay() === 0;
  }
  async function retry(fn, maxAttempts = 5, delayMs = 15e3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.error(`[Retry] Attempt ${attempt}/${maxAttempts} failed: ${error.code || error.message}`);
        if (attempt === maxAttempts) throw error;
        console.log(`[Retry] Waiting ${delayMs / 1e3}s before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error("Retry failed");
  }
  async function sendReminder1() {
    if (isSunday() || isFriday()) {
      console.log(`Hari ${isSunday() ? "Minggu" : "Jumat"}, skip reminder 1 (makan siang).`);
      const tracker2 = loadTracker();
      tracker2.reminder1 = true;
      saveTracker(tracker2);
      return;
    }
    try {
      console.log("Executing scheduled task 1 (11:50)...");
      await retry(async () => {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const messageOptions = {
            content: `<@${targetUserId}>`
          };
          if (process.env.IMAGE_URL) {
            messageOptions.files = [process.env.IMAGE_URL];
          } else if (stickerId) {
            messageOptions.stickers = [stickerId];
          }
          await channel.send(messageOptions);
        }
      });
      console.log("Reminder 1 sent successfully.");
      const tracker2 = loadTracker();
      tracker2.reminder1 = true;
      saveTracker(tracker2);
    } catch (error) {
      console.error("Failed to execute reminder 1 after all retries:", error);
    }
  }
  async function sendReminder2() {
    if (isSunday()) {
      console.log("Hari Minggu, skip reminder 2 (eskrim).");
      const tracker2 = loadTracker();
      tracker2.reminder2 = true;
      saveTracker(tracker2);
      return;
    }
    try {
      console.log("Executing scheduled task 2 (17:30)...");
      await retry(async () => {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const messageOptions = {};
          if (process.env.IMAGE_URL_2) {
            messageOptions.files = [process.env.IMAGE_URL_2];
          } else {
            messageOptions.content = "Waktunya beli eskrim!";
          }
          await channel.send(messageOptions);
        }
      });
      console.log("Reminder 2 sent successfully.");
      const tracker2 = loadTracker();
      tracker2.reminder2 = true;
      saveTracker(tracker2);
    } catch (error) {
      console.error("Failed to execute reminder 2 after all retries:", error);
    }
  }
  async function sendJumatan() {
    try {
      console.log("Executing Jumatan reminder (11:45)...");
      await retry(async () => {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await channel.send({
            files: ["./assets/jumatan.jpg"]
          });
        }
      });
      console.log("Jumatan reminder sent successfully.");
      const tracker2 = loadTracker();
      tracker2.reminderJumatan = true;
      saveTracker(tracker2);
    } catch (error) {
      console.error("Failed to send Jumatan reminder after all retries:", error);
    }
  }
  const now = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const tracker = loadTracker();
  if (isFriday() && (currentHour > 11 || currentHour === 11 && currentMinute >= 45) && !tracker.reminderJumatan) {
    console.log("[Catch-up] Jumatan (11:45) belum terkirim hari ini! Mengirim sekarang...");
    await sendJumatan();
  }
  if ((currentHour > 11 || currentHour === 11 && currentMinute >= 50) && !tracker.reminder1) {
    console.log("[Catch-up] Reminder 1 (11:50) belum terkirim hari ini! Mengirim sekarang...");
    await sendReminder1();
  }
  if ((currentHour > 17 || currentHour === 17 && currentMinute >= 30) && !tracker.reminder2) {
    console.log("[Catch-up] Reminder 2 (17:30) belum terkirim hari ini! Mengirim sekarang...");
    await sendReminder2();
  }
  import_node_cron.default.schedule("45 11 * * 5", async () => {
    await sendJumatan();
  }, { timezone: "Asia/Jakarta" });
  import_node_cron.default.schedule("50 11 * * *", async () => {
    await sendReminder1();
  }, { timezone: "Asia/Jakarta" });
  import_node_cron.default.schedule("30 17 * * *", async () => {
    await sendReminder2();
  }, { timezone: "Asia/Jakarta" });
  console.log("Cron job scheduled for 11:45 (Jumat), 11:50, and 17:30 WIB.");
  setInterval(() => {
    console.log(`[Heartbeat] Bot alive \u2014 ${(/* @__PURE__ */ new Date()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`);
  }, 5 * 60 * 1e3);
});
var server = import_http.default.createServer((req, res) => {
  res.writeHead(200);
  res.end("Tingky Munky is alive!");
});
server.listen(process.env.PORT || 3e3, () => {
  console.log("Keep-alive server running.");
});
client.login(token);
