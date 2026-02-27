// ===== Express (לשמור את Render חי) =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('DM Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

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
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember]
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
    await guild.channels.fetch();

    const logChannel = guild.channels.cache.find(
      c => c.name === LOG_CHANNEL_NAME
    );

    if (!logChannel) {
      console.log("❌ חדר לוגים לא נמצא");
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
  const format = FORMATS[roleName];

  if (!format) return;

  try {
    await member.send({ content: format });

    await sendLog(
      `✅ DM נשלח ל ${member.user.tag}\nרול: ${roleNameRaw}`
    );

  } catch (err) {
    await sendLog(
      `❌ נכשל DM ל ${member.user.tag}\nרול: ${roleNameRaw}\nסיבה: DM חסום`
    );
  }
}

// ===== READY =====
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===== האזנה להוספת רול =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {

  const addedRoles = newMember.roles.cache.filter(role =>
    !oldMember.roles.cache.has(role.id)
  );

  if (!addedRoles.size) return;

  for (const role of addedRoles.values()) {
    await sendLog(
      `🎭 נוסף רול למשתמש ${newMember.user.tag}\nרול: ${role.name}`
    );

    await sendDMFormat(newMember, role.name);
  }
});

// ===== טיפול בקריסות =====
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

// ===== Login =====
client.login(TOKEN)
  .then(() => console.log('✅ Bot connected'))
  .catch(console.error);