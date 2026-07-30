import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChatInputCommandInteraction, 
    ButtonInteraction 
} from 'discord.js';

// List sementara, nanti akan diupdate kalau list dari user sudah ada
export let foodList = [
    "Nasi Goreng", 
    "Sate Ayam", 
    "Nasi Padang", 
    "Bakso", 
    "Mie Ayam",
    "Ayam Geprek",
    "Pecel Lele",
    "Soto Ayam",
    "Ketoprak",
    "Gado-gado"
];

function getRandomFood(currentFood?: string): string {
    let newFood = currentFood;
    // Pastikan hasil gacha tidak sama dengan yang sekarang (jika list > 1)
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

function buildGachaComponents(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('gacha_ganti')
            .setLabel('Gamau ah')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('gacha_fix')
            .setLabel('Ini aja deh')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
    );
    return row;
}

export async function handleMakanApaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const food = getRandomFood();
    const row = buildGachaComponents();

    await interaction.reply({
        content: `🎲 Hari ini makan **${food}** aja! Gimana?`,
        components: [row]
    });
}

export async function handleGachaButton(interaction: ButtonInteraction): Promise<void> {
    if (interaction.customId === 'gacha_ganti') {
        // Ambil nama makanan dari pesan sebelumnya
        const currentMessage = interaction.message.content;
        const currentFoodMatch = currentMessage.match(/\*\*(.*?)\*\*/);
        const currentFood = currentFoodMatch ? currentFoodMatch[1] : undefined;

        const newFood = getRandomFood(currentFood);
        const row = buildGachaComponents();

        await interaction.update({
            content: `🎲 Kalo gitu makan **${newFood}** aja! Gimana?`,
            components: [row]
        });
    } else if (interaction.customId === 'gacha_fix') {
        const currentMessage = interaction.message.content;
        const currentFoodMatch = currentMessage.match(/\*\*(.*?)\*\*/);
        const currentFood = currentFoodMatch ? currentFoodMatch[1] : "ini";

        // Hapus tombol dan berikan konfirmasi
        await interaction.update({
            content: `✅ Mantap! Selamat makan **${currentFood}** ya!`,
            components: [] // Kosongkan tombol
        });
    }
}
