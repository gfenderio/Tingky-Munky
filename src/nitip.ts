import * as fs from 'fs';
import * as path from 'path';
import { dataFile } from './paths';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';

// === DATA TYPES ===

interface Titipan {
    userId: string;
    userName: string;
    pesanan: string;
    harga: number;
    catatan: string;
    timestamp: string;
}

// === HELPER ===

function formatRupiah(amount: number): string {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

interface Batch {
    number: number;
    status: 'open' | 'closed';
    orders: Titipan[];
}

interface NitipData {
    currentBatch: Batch;
}

// === FILE PERSISTENCE ===

const DATA_FILE = dataFile('nitip.json');

function ensureDataDir(): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadData(): NitipData {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    // Default: belum ada batch
    const defaultData: NitipData = {
        currentBatch: {
            number: 1,
            status: 'open',
            orders: []
        }
    };
    saveData(defaultData);
    return defaultData;
}

function saveData(data: NitipData): void {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// === EMBED & BUTTONS ===

function buildMainEmbed(data: NitipData): EmbedBuilder {
    const batch = data.currentBatch;
    const statusEmoji = batch.status === 'open' ? '🟢 BUKA' : '🔴 TUTUP';

    const embed = new EmbedBuilder()
        .setTitle(`📦 DAFTAR NITIP — Batch #${batch.number}`)
        .setColor(batch.status === 'open' ? 0x00ff00 : 0xff0000)
        .setFooter({ text: `Status: ${statusEmoji}` })
        .setTimestamp();

    if (batch.orders.length === 0) {
        embed.setDescription('Belum ada yang nitip.');
    } else {
        let desc = '';
        let totalHarga = 0;
        batch.orders.forEach((order, i) => {
            desc += `**${i + 1}.** <@${order.userId}> — ${order.pesanan} • **${formatRupiah(order.harga)}**`;
            if (order.catatan) {
                desc += `\n   📝 ${order.catatan}`;
            }
            desc += '\n';
            totalHarga += order.harga;
        });
        desc += `\n**Total: ${batch.orders.length} titipan**`;
        desc += `\n💰 **Total Harga: ${formatRupiah(totalHarga)}**`;
        embed.setDescription(desc);
    }

    return embed;
}

function buildMainButtons(data: NitipData): ActionRowBuilder<ButtonBuilder>[] {
    const batch = data.currentBatch;
    const isOpen = batch.status === 'open';

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('nitip_tambah')
            .setLabel('Tambah Titipan')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isOpen),
        new ButtonBuilder()
            .setCustomId('nitip_list')
            .setLabel('Lihat List')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('nitip_hapus')
            .setLabel('Hapus Titipan')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!isOpen || batch.orders.length === 0),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('nitip_tutup')
            .setLabel('Tutup Batch')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isOpen),
        new ButtonBuilder()
            .setCustomId('nitip_buka')
            .setLabel('Buka Batch Baru')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary),
    );

    return [row1, row2];
}

// === HANDLERS ===

export async function handleNitipCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const data = loadData();
    const embed = buildMainEmbed(data);
    const buttons = buildMainButtons(data);

    await interaction.reply({
        embeds: [embed],
        components: buttons,
    });
}

export async function handleNitipButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'nitip_tambah') {
        await handleTambah(interaction);
    } else if (customId === 'nitip_list') {
        await handleList(interaction);
    } else if (customId === 'nitip_hapus') {
        await handleHapusMenu(interaction);
    } else if (customId === 'nitip_tutup') {
        await handleTutup(interaction);
    } else if (customId === 'nitip_buka') {
        await handleBukaBaru(interaction);
    }
}

export async function handleNitipModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'nitip_modal') return;

    const nama = interaction.fields.getTextInputValue('nitip_nama');
    const pesanan = interaction.fields.getTextInputValue('nitip_pesanan');
    const hargaRaw = interaction.fields.getTextInputValue('nitip_harga');
    const catatan = interaction.fields.getTextInputValue('nitip_catatan') || '';

    // Parse harga: hapus semua karakter non-digit
    const harga = parseInt(hargaRaw.replace(/\D/g, '')) || 0;

    const data = loadData();

    if (data.currentBatch.status === 'closed') {
        await interaction.reply({ content: '❌ Batch sudah ditutup! Tidak bisa menambah titipan.', ephemeral: true });
        return;
    }

    const newOrder: Titipan = {
        userId: interaction.user.id,
        userName: nama,
        pesanan: pesanan,
        harga: harga,
        catatan: catatan,
        timestamp: new Date().toISOString()
    };

    data.currentBatch.orders.push(newOrder);
    saveData(data);

    const embed = buildMainEmbed(data);
    const buttons = buildMainButtons(data);

    await interaction.reply({
        content: `✅ Titipan untuk **${nama}** berhasil ditambahkan!`,
        embeds: [embed],
        components: buttons,
    });
}

export async function handleNitipSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId !== 'nitip_hapus_select') return;

    const index = parseInt(interaction.values[0]);
    const data = loadData();

    if (index < 0 || index >= data.currentBatch.orders.length) {
        await interaction.reply({ content: '❌ Titipan tidak ditemukan.', ephemeral: true });
        return;
    }

    const removed = data.currentBatch.orders.splice(index, 1)[0];
    saveData(data);

    const embed = buildMainEmbed(data);
    const buttons = buildMainButtons(data);

    await interaction.reply({
        content: `🗑️ Titipan **${removed.userName}** — *${removed.pesanan}* berhasil dihapus!`,
        embeds: [embed],
        components: buttons,
    });
}

// === INTERNAL FUNCTIONS ===

async function handleTambah(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId('nitip_modal')
        .setTitle('Tambah Titipan');

    const namaInput = new TextInputBuilder()
        .setCustomId('nitip_nama')
        .setLabel('Nama (otomatis nama kamu, bisa diganti)')
        .setStyle(TextInputStyle.Short)
        .setValue(interaction.user.displayName || interaction.user.username)
        .setRequired(true)
        .setMaxLength(50);

    const pesananInput = new TextInputBuilder()
        .setCustomId('nitip_pesanan')
        .setLabel('Pesanan')
        .setPlaceholder('Contoh: Nasi Goreng Spesial + Es Teh')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200);

    const hargaInput = new TextInputBuilder()
        .setCustomId('nitip_harga')
        .setLabel('Harga (Rupiah)')
        .setPlaceholder('Contoh: 15000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

    const catatanInput = new TextInputBuilder()
        .setCustomId('nitip_catatan')
        .setLabel('Catatan (opsional)')
        .setPlaceholder('Contoh: Ga pake sambal, Level 5')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(namaInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(pesananInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hargaInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(catatanInput),
    );

    await interaction.showModal(modal);
}

async function handleList(interaction: ButtonInteraction): Promise<void> {
    const data = loadData();
    const embed = buildMainEmbed(data);

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handleHapusMenu(interaction: ButtonInteraction): Promise<void> {
    const data = loadData();

    if (data.currentBatch.orders.length === 0) {
        await interaction.reply({ content: '📭 Tidak ada titipan untuk dihapus.', ephemeral: true });
        return;
    }

    const options = data.currentBatch.orders.map((order, i) => ({
        label: `${order.userName} — ${order.pesanan}`.substring(0, 100),
        description: `${formatRupiah(order.harga)}${order.catatan ? ' | ' + order.catatan : ''}`.substring(0, 100),
        value: i.toString(),
    }));

    const select = new StringSelectMenuBuilder()
        .setCustomId('nitip_hapus_select')
        .setPlaceholder('Pilih titipan yang mau dihapus...')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({
        content: '🗑️ Pilih titipan yang ingin dihapus:',
        components: [row],
        ephemeral: true,
    });
}

async function handleTutup(interaction: ButtonInteraction): Promise<void> {
    const data = loadData();

    if (data.currentBatch.status === 'closed') {
        await interaction.reply({ content: '❌ Batch sudah ditutup.', ephemeral: true });
        return;
    }

    data.currentBatch.status = 'closed';
    saveData(data);

    const embed = buildMainEmbed(data);
    const buttons = buildMainButtons(data);

    const totalHarga = data.currentBatch.orders.reduce((sum, o) => sum + o.harga, 0);

    await interaction.reply({
        content: `🔒 **Batch #${data.currentBatch.number} sudah DITUTUP!** Total ${data.currentBatch.orders.length} titipan — 💰 ${formatRupiah(totalHarga)}`,
        embeds: [embed],
        components: buttons,
    });
}

async function handleBukaBaru(interaction: ButtonInteraction): Promise<void> {
    const data = loadData();
    const newBatchNumber = data.currentBatch.number + 1;

    data.currentBatch = {
        number: newBatchNumber,
        status: 'open',
        orders: []
    };
    saveData(data);

    const embed = buildMainEmbed(data);
    const buttons = buildMainButtons(data);

    await interaction.reply({
        content: `🔓 **Batch #${newBatchNumber} sudah DIBUKA!** Silakan mulai nitip.`,
        embeds: [embed],
        components: buttons,
    });
}
