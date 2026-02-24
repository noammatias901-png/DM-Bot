// ===== Express =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot is running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// ===== Discord =====
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error("❌ חסר TOKEN או GUILD_ID ב-ENV");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages
  ],
  partials: ['CHANNEL'] // דרוש ל-DM
});

// ===== פורמטים לפי רול =====
const FORMATS = {
  "crime family": `💌 פורמט בקשת רול משפחה:
שם בדיסקורד:
שם בעיר:
איזו משפחה:
תפקיד במשפחה:
הוכחה:
שם של מי שהכניס אותך:`,

  "Solo Crime": `💌 פורמט בקשת רול סולו קריים:
שם בדיסקורד:
שם בעיר:
הוכחה:
שם של הבוחן:`
};

// ===== פונקציה לשליחת פורמט DM =====
async function sendDMFormat(member, roleName) {
  // Crime Permit לא שולח DM
  if (roleName === "Crime Permit") return;

  const format = FORMATS[roleName];
  if (!format) return; // אין פורמט לרול הזה

  try {
    await member.send(format);
    console.log(`✅ נשלח פורמט ל-${member.user.tag} עבור ${roleName}`);
  } catch (err) {
    console.error(`❌ לא ניתן לשלוח DM ל-${member.user.tag}:`, err);
  }
}

// ===== READY =====
client.once('ready', () => {
  console.log(`✅ DM Bot Logged in as ${client.user.tag}`);
});

// ===== האזנה להודעות מהבוט הראשי =====
// הפורמט: "FORMAT <RoleName> @User"
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("FORMAT")) {
    const args = message.content.split(" ");
    const roleName = args[1]; // לדוגמה "Solo Crime" או "crime family" או "Crime Permit"
    const userId = args[2]?.replace(/<@!?(\d+)>/, "$1"); // מחלץ את ID של המשתמש

    if (!roleName || !userId) return;

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(userId);
      await sendDMFormat(member, roleName);
    } catch (err) {
      console.error("❌ שגיאה בשליחת פורמט:", err);
    }
  }
});

client.login(TOKEN);