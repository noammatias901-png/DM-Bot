const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot Running'));
app.listen(PORT);

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SUBMIT_CHANNEL_ID = process.env.SUBMIT_CHANNEL_ID;
const STAFF_ROLE_NAME = process.env.STAFF_ROLE_NAME;
const LOG_CHANNEL_NAME = "🤖-dmbot-logs";

const activeFormats = new Map(); // זוכר למי נשלח פורמט

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const FORMATS = {
  "crime family": `💌 פורמט בקשת רול משפחה:
שם בדיסקורד:
שם בעיר:
איזו משפחה:
תפקיד במשפחה:
הוכחה:
שם של מי שהכניס אותך:`,

  "solo crime": `💌 פורמט בקשת רול סולו קריים:
שם בדיסקורד:
שם בעיר:
הוכחה:
שם של הבוחן:`
};

// ===== שליחת פורמט =====
async function sendDMFormat(member, roleNameRaw) {

  const roleName = roleNameRaw.toLowerCase();
  const format = FORMATS[roleName];

  if (!format) return;

  // מונע שליחה כפולה
  if (activeFormats.has(member.id)) return;

  try {
    await member.send(format);
    activeFormats.set(member.id, roleName);
  } catch (err) {
    console.log("DM חסום");
  }
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {

  const addedRoles = newMember.roles.cache.filter(role =>
    !oldMember.roles.cache.has(role.id)
  );

  if (!addedRoles.size) return;

  for (const role of addedRoles.values()) {
    await sendDMFormat(newMember, role.name);
  }
});

// ===== קבלת מילוי פורמט =====
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;
  if (message.guild) return;

  const formatType = activeFormats.get(message.author.id);
  if (!formatType) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const submitChannel = await guild.channels.fetch(SUBMIT_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle(`📥 בקשה חדשה – ${formatType}`)
    .addFields(
      { name: "👤 משתמש", value: message.author.tag },
      { name: "📝 תוכן הבקשה", value: message.content }
    )
    .setColor(0x3498db)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${message.author.id}`)
      .setLabel("אשר")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`deny_${message.author.id}`)
      .setLabel("דחה")
      .setStyle(ButtonStyle.Danger)
  );

  await submitChannel.send({ embeds: [embed], components: [row] });

  await message.author.send("📨 הבקשה נשלחה לצוות לבדיקה.");

  activeFormats.delete(message.author.id);
});

// ===== טיפול בכפתורים =====
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isButton()) return;

  const member = interaction.member;
  if (!member.roles.cache.some(r => r.name === STAFF_ROLE_NAME)) {
    return interaction.reply({ content: "❌ אין לך הרשאה.", ephemeral: true });
  }

  const [action, userId] = interaction.customId.split("_");

  const user = await client.users.fetch(userId);

  if (action === "approve") {

    await user.send(
      "✅ הבקשה שלך אושרה בהצלחה!\nהצוות מיד ימלא לך את הרולים המותאמים."
    );

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x00ff00)
      .addFields({ name: "👮 אושר על ידי", value: interaction.user.tag });

    await interaction.update({
      embeds: [updatedEmbed],
      components: []
    });

  }

  if (action === "deny") {

    await user.send(
      "❌ הבקשה שלך נדחתה.\nבמידת הצורך ניתן להגיש בקשה חדשה."
    );

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xff0000)
      .addFields({ name: "👮 נדחה על ידי", value: interaction.user.tag });

    await interaction.update({
      embeds: [updatedEmbed],
      components: []
    });

  }

});

client.login(TOKEN);