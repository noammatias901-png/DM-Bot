// ===== Express =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot is running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// ===== Discord =====
const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_NAME = "🤖-dmbot-logs";

if (!TOKEN || !GUILD_ID) {
  console.error("❌ חסר TOKEN או GUILD_ID ב-ENV");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.User
  ]
});

// ===== פורמטים =====
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

// ===== פונקציית לוג =====
async function sendLog(messageText) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const logChannel = guild.channels.cache.find(
      c => c.name === LOG_CHANNEL_NAME
    );

    if (!logChannel) {
      console.log("❌ לא נמצא חדר לוגים");
      return;
    }

    await logChannel.send(messageText);
  } catch (err) {
    console.error("❌ שגיאה בשליחת לוג:", err);
  }
}

// ===== שליחת DM =====
async function sendDMFormat(member, roleNameRaw) {

  const roleName = roleNameRaw.toLowerCase();

  if (roleName === "crime permit") return;

  const format = FORMATS[roleName];

  if (!format) {
    await sendLog(`⚠️ אין פורמט לרול: ${roleNameRaw}`);
    return;
  }

  try {
    await member.send({ content: format });

    await sendLog(
      `✅ DM נשלח ל ${member.user.tag}\nרול: ${roleNameRaw}`
    );

  } catch (err) {

    await sendLog(
      `❌ נכשל DM ל ${member.user.tag}\nרול: ${roleNameRaw}\nסיבה: DM חסום או משתמש סגר הודעות פרטיות`
    );
  }
}

// ===== READY =====
client.once('ready', () => {
  console.log(`✅ DM Bot Logged in as ${client.user.tag}`);
});

// ===== האזנה להודעות =====
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;
  if (!message.content.toUpperCase().startsWith("FORMAT")) return;

  const args = message.content.split(" ");
  if (args.length < 3) return;

  const roleName = args.slice(1, args.length - 1).join(" ");
  const userId = args[args.length - 1].replace(/<@!?(\d+)>/, "$1");

  if (!roleName || !userId) return;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    await sendLog(
      `📥 התקבלה בקשת FORMAT\nמשתמש: ${member.user.tag}\nרול: ${roleName}`
    );

    await sendDMFormat(member, roleName);

  } catch (err) {
    console.error("❌ שגיאה כללית:", err);
    await sendLog("❌ שגיאה כללית בשליחת FORMAT (בדוק קונסול)");
  }
});

// ===== Login =====
client.login(TOKEN)
  .then(() => console.log('Bot logged in!'))
  .catch(console.error);