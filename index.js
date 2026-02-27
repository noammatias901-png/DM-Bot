// ===== Express =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot Running'));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// ===== Discord =====
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

const activeFormats = new Map();          // מי במצב מילוי פורמט
const usersWithActiveFormat = new Set();  // מונע שליחה כפולה

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

// ===== פורמטים =====
const FORMATS = {
  "crime family": `שם בדיסקורד:\nשם בעיר:\nאיזו משפחה:\nתפקיד במשפחה:\nהוכחה:\nשם של מי שהכניס אותך:`,
  "solo crime": `שם בדיסקורד:\nשם בעיר:\nהוכחה:\nשם של הבוחן:`
};

// ===== פונקציית לוג =====
async function sendLog(member, roleName, status) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const logChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle("📩 DM BOT LOG")
      .addFields(
        { name: "👤 משתמש", value: `<@${member.id}>`, inline: false },
        { name: "🎭 רול שהתקבל", value: roleName, inline: false },
        { name: "📨 סטטוס DM", value: status, inline: false }
      )
      .setColor(status.includes("נשלח") ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });

  } catch (err) {
    console.error("❌ שגיאה בשליחת לוג:", err);
  }
}

// ===== שליחת פורמט ל-DM עם EMBED =====
async function sendDMFormat(member, roleNameRaw) {
  const roleName = roleNameRaw.toLowerCase();
  const format = FORMATS[roleName];
  if (!format) return;

  if (usersWithActiveFormat.has(member.id)) return; // מונע שליחה כפולה

  try {
    const embed = new EmbedBuilder()
      .setTitle(`💌 פורמט בקשה – ${roleNameRaw}`)
      .setDescription(format)
      .setColor(0x3498db)
      .setTimestamp();

    await member.send({ embeds: [embed] });

    usersWithActiveFormat.add(member.id);
    activeFormats.set(member.id, roleName);

    await sendLog(member, roleNameRaw, "נשלח פורמט Embed");

  } catch (err) {
    await sendLog(member, roleNameRaw, "❌ נכשל - DM חסום");
  }
}

// ===== Ready =====
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===== הוספת רול אוטומטי למשתמש =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (!addedRoles.size) return;

  for (const role of addedRoles.values()) {
    await sendDMFormat(newMember, role.name);
  }
});

// ===== מילוי פורמט ב-DM =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.guild) return; // רק DM

  const formatType = activeFormats.get(message.author.id);
  if (!formatType) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const submitChannel = await guild.channels.fetch(SUBMIT_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle(`📥 בקשה חדשה – ${formatType}`)
    .addFields(
      { name: "👤 משתמש", value: `<@${message.author.id}>` },
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

  // ניקוי זיכרון למניעת שליחה כפולה בעתיד
  activeFormats.delete(message.author.id);
  usersWithActiveFormat.delete(message.author.id);
});

// ===== טיפול בכפתורים =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  // רק מי שיש לו רול STAFF
  if (!member || !member.roles.cache.some(r => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase())) {
    return interaction.reply({ content: "❌ אין לך הרשאה.", ephemeral: true });
  }

  const [action, userId] = interaction.customId.split("_");
  const user = await client.users.fetch(userId);

  if (action === "approve") {
    // הוספת רול אוטומטי לפי סוג הפורמט
    const guildMember = await interaction.guild.members.fetch(userId);
    const roleName = activeFormats.get(userId) || "Crime Family"; // ברירת מחדל אם לא זמין
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (role) await guildMember.roles.add(role);

    await user.send(
      "✅ הבקשה שלך אושרה בהצלחה!\nהצוות מיד ימלא לך את הרולים המותאמים."
    );

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x00ff00)
      .addFields({ name: "👮 אושר על ידי", value: interaction.user.tag });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  }

  if (action === "deny") {
    await user.send(
      "❌ הבקשה שלך נדחתה.\nבמידת הצורך ניתן להגיש בקשה חדשה."
    );

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xff0000)
      .addFields({ name: "👮 נדחה על ידי", value: interaction.user.tag });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  }
});

// ===== טיפול בקריסות =====
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);