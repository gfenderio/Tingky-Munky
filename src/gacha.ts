import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChatInputCommandInteraction, 
    ButtonInteraction 
} from 'discord.js';

export const foodList = [
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

function getRandomFood(currentFood?: string): string {
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

function buildGachaComponents(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
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
}

export async function handleMakanApaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const food = getRandomFood();
    const row = buildGachaComponents();

    await interaction.reply({
        content: `🎲 Hari ini makan **${food}** aja! Gimana?`,
        components: [row],
        ephemeral: true // Hanya terlihat oleh yang manggil
    });
}

export async function handleGachaButton(interaction: ButtonInteraction): Promise<void> {
    if (interaction.customId === 'gacha_ganti') {
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
        const currentFood = currentFoodMatch ? currentFoodMatch[1] : "makanan misterius";

        // Update pesan ephemeral (hilangkan tombol)
        await interaction.update({
            content: `✅ Mantap! Pilihanmu sudah diumumkan.`,
            components: [] 
        });

        // Kirim pesan publik ke channel
        if (interaction.channel) {
            await interaction.channel.send(`Si <@${interaction.user.id}> mau beli **${currentFood}**`);
        }
    }
}
