const User = require('../../models/user');

module.exports = {

  name: 'unban',

  description: 'Unban a user from using the bot',

  usage: '!unban @user [reason]',

  category: 'admin',

  adminOnly: true,

  async execute(sock, message, args) {

    const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length === 0) {

      await sock.sendMessage(message.key.remoteJid, { text: '❌ Please mention a user to unban' });

      return;

    }

    const targetId = mentions[0];

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const user = await User.findOne({ jid: targetId });

    if (!user) {

      await sock.sendMessage(message.key.remoteJid, { text: '❌ User not found in database' });

      return;

    }

    if (!user.isBanned) {

      await sock.sendMessage(message.key.remoteJid, { text: '❌ User is not banned' });

      return;

    }

    await user.unban();

    await sock.sendMessage(message.key.remoteJid, { 

      text: `✅ Unbanned user @${targetId.split('@')[0]}\nReason: ${reason}`, 

      mentions: [targetId] 

    });

    try {

      await sock.sendMessage(targetId, { 

        text: `You have been unbanned from using the bot.\nReason: ${reason}` 

      });

    } catch (error) {}

  }

};
