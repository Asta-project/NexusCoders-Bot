const User = require('../../models/user');

module.exports = {
  name: 'warn',
  description: 'Warn a user in the group. (Admin-only)',
  usage: '!warn [reason]',
  category: 'admin',
  cooldown: 5,
  adminOnly: true,
  groupOnly: true,
  botAdminRequired: false,

  async execute(sock, message, args) {
    try {
      const reason = args.join(' ');
      const groupId = message.key.remoteJid;
      const quotedMsg = message.message.extendedTextMessage;

      if (!quotedMsg) {
        return await sock.sendMessage(groupId, {
          text: '🐼Please reply to the user you want to warn.',
        });
      }

      const userId = quotedMsg.contextInfo.participant;
      const userData = await User.findOne({ jid: userId });

      if (!userData) {
        return await sock.sendMessage(groupId, {
          text: '🚫User not found.',
        });
      }

      const warnLimit = 3;

      let warns = userData.warns || 0;
      warns++;

      await User.updateOne({ jid: userId }, { warns });

      const warningMessage = `╭──────────────────@\n${userId} has \n |been warned\n |‼️Warning times: ${warns}\n |Reason: ${reason}\n╰──────────────────`;

      await sock.sendMessage(groupId, {
        text: warningMessage,
        mentions: [userId],
      });

      // Check if user exceeds warn limit
      if (warns >= warnLimit) {
        // Kick user and reset warns
        await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
        await User.updateOne({ jid: userId }, { warns: 0 });
        await sock.sendMessage(groupId, {
          text: `╔⏤⏤⏤╝❀╚⏤⏤⏤╗\n𐌉𐌉@${userId} has\n 𐌉𐌉been kicked due to exceeding warning limit.\n╚⏤⏤⏤╗❀╔⏤⏤⏤╝`,
          mentions: [userId],
        });
      }
    } catch (error) {
      console.error('Error executing !warn command:', error);
    }
  },
};