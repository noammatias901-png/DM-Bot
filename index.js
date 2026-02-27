const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder 
} = require('discord.js');

require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_NAME = "🤖-dmbot-logs";
const SUBMIT_CHANNEL_ID = process.env.SUBMIT_CHANNEL_ID; // 1475878693724491828

const activeFormats = new Map(); // זוכר מי קיבל איזה פורמט

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

async function sendLog(member, roleName, status) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  const logChannel = guild.channels.cache.find(
    c => c.name === LOG_CHANNEL_NAME
  );

  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("📩 DM BOT LOG")
    .addFields(
      { name: "👤 משתמש", value: member.user.tag, inline: false },
      { name: "🎭 רול שהתקבל", value: roleName, inline: false },
      { name: "📨 סטטוס DM", value: status, inline: false }
    )
    .setColor(status === "נשלח פורמט" ? 0x00ff00 : 0xff0000)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

async function sendDMFormat(member, roleNameRaw) {
  const roleName = roleNameRaw.toLowerCase();
  const format = FORMATS[roleName];

  if (!format) return;

  try {
    await member.send(format);
    activeFormats.set(member.id, roleName); // שומר איזה פורמט הוא קיבל
    await sendLog(member, roleNameRaw, "נשלח פורמט");
  } catch {
    await sendLog(member, roleNameRaw, "נכשל - DM חסום");
  }
}

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {

  const addedRoles = newMember.roles.cache.filter(role =>
    !oldMember.roles.cache.has(role.id)
  );

  if (!addedRoles.size) return;

  for (const role of addedRoles.values()) {
    await sendDMFormat(newMember, role.name);
  }
});

// ===== קבלת מילוי פורמט ב-DM =====
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;
  if (message.guild) return; // רק DM

  const formatType = activeFormats.get(message.author.id);
  if (!formatType) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const submitChannel = await guild.channels.fetch(SUBMIT_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📥 בקשה חדשה")
    .addFields(
      { name: "👤 משתמש", value: message.author.tag },
      { name: "📂 סוג בקשה", value: formatType },
      { name: "📝 תוכן הבקשה", value: message.content }
    )
    .setColor(0x3498db)
    .setTimestamp();

  await submitChannel.send({ embeds: [embed] });

  await message.author.send("✅ הבקשה נשלחה לצוות בהצלחה.");

  activeFormats.delete(message.author.id); // מנקה זיכרון
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);