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
const STAFF_ROLE_NAME = process.env.STAFF_ROLE_NAME;

const SUBMIT_CHANNEL_ID = '1475878693724491828';
const LOG_CHANNEL_NAME = "🤖-dmbot-logs";

const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 דקות

const activeRequests = new Map();

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

// ===== לוג =====
async function sendLog(text) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const logChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
    if (!logChannel) return;
    await logChannel.send(text);
  } catch {}
}

// ===== שליחת פורמט ב-DM =====
async function sendDMFormat(member, roleNameRaw) {
  const roleName = roleNameRaw.toLowerCase();
  const format = FORMATS[roleName];
  if (!format) return;

  try {
    const embed = new EmbedBuilder()
      .setTitle(`💌 פורמט בקשה – ${roleNameRaw}`)
      .setDescription(format)
      .setColor(0x3498db)
      .setTimestamp();

    await member.send({ embeds: [embed] });
    await sendLog(`📤 פורמט נשלח ל ${member.user.tag}`);
  } catch {
    await sendLog(`❌ DM חסום אצל ${member.user.tag}`);
  }
}

// ===== Ready =====
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===== זיהוי הוספת רול =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (!addedRoles.size) return;

  for (const role of addedRoles.values()) {
    await sendDMFormat(newMember, role.name);
  }
});

// ===== קבלת טופס ב-DM =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.guild) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const submitChannel = await guild.channels.fetch(SUBMIT_CHANNEL_ID);

  const formatType = Object.keys(FORMATS).find(f =>
    message.content.toLowerCase().includes("שם בדיסקורד")
  );

  if (!formatType) return;

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
      .setCustomId(`approve_${message.author.id}_${formatType}`)
      .setLabel("אשר")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${message.author.id}_${formatType}`)
      .setLabel("דחה")
      .setStyle(ButtonStyle.Danger)
  );

  const sentMessage = await submitChannel.send({ embeds: [embed], components: [row] });

  activeRequests.set(sentMessage.id, true);

  setTimeout(async () => {
    if (activeRequests.has(sentMessage.id)) {
      await sentMessage.edit({ components: [] }).catch(() => {});
      activeRequests.delete(sentMessage.id);
    }
  }, REQUEST_TIMEOUT);

  await message.author.send("📨 הבקשה נשלחה לבדיקה.");
});

// ===== טיפול בכפתורים =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (!interaction.guild) {
      return interaction.reply({ content: "❌ לא תקין.", ephemeral: true });
    }

    const staffRole = interaction.guild.roles.cache.find(
      r => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase()
    );

    if (!staffRole || !interaction.member.roles.cache.has(staffRole.id)) {
      return interaction.reply({ content: "❌ אין הרשאה.", ephemeral: true });
    }

    if (!activeRequests.has(interaction.message.id)) {
      return interaction.reply({ content: "⚠️ הבקשה כבר טופלה.", ephemeral: true });
    }

    await interaction.deferUpdate(); // מונע This interaction failed

    const [action, userId, roleName] = interaction.customId.split("_");

    const user = await client.users.fetch(userId).catch(() => null);
    const guildMember = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!user || !guildMember) return;

    if (action === "approve") {
      const role = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase()
      );

      if (role) await guildMember.roles.add(role).catch(() => {});
      await user.send("✅ הבקשה שלך אושרה!").catch(() => {});
    }

    if (action === "deny") {
      await user.send("❌ הבקשה שלך נדחתה.").catch(() => {});
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle(action === "approve" ? "📥 בקשה אושרה" : "📥 בקשה נדחתה")
      .setDescription(`הבקשה של <@${userId}> ${action === "approve" ? "אושרה" : "נדחתה"}.`)
      .addFields({ name: "👮 טופל על ידי", value: interaction.user.tag })
      .setColor(action === "approve" ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    await interaction.message.edit({ embeds: [resultEmbed], components: [] });

    activeRequests.delete(interaction.message.id);

  } catch (err) {
    console.error(err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ שגיאה בטיפול.", ephemeral: true });
    }
  }
});

// ===== קריסות =====
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);