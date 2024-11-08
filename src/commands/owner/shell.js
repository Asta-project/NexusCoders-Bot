const config = require('../../config');

module.exports = {
  name: 'shell',
  description: 'Execute shell commands.',
  usage: '!shell <command>',
  category: 'owner',
  cooldown: 3,

  ownerOnly: true,

  adminOnly: false,

  groupOnly: false,

  privateOnly: false,

  botAdminRequired: false,
  async execute(sock, message, args) {
   
    if (!args[0]) {
      return await sock.sendMessage(message.key.remoteJid, {
        text: 'Please provide a shell command to execute.',
       }, { quoted: message });
    }

    const cmd = args.join(' ');
    await sock.sendMessage(message.key.remoteJid, {
      text: `Executing command: ${cmd}...`,
      }, { quoted: message });

    try {
      const result = require('child_process').execSync(cmd, { encoding: 'utf-8' });
      
      if (!result) {
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Command executed successfully with no output.',
          }, { quoted: message });
      } else if (result.length > 1000) {
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Output too large. Executed command successfully.',
       }, { quoted: message });
      } else {
        await sock.sendMessage(message.key.remoteJid, {
          text: `Output:\n\`\`\`${result}\`\`\``,
          }, { quoted: message });
      }
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `Error executing command: ${error.message}`,
        }, { quoted: message });
    }
  },
};