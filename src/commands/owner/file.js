const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
  name: 'file',
  description: 'Retrieve the code for a specific command',
  usage: '!file <filename.js>',
  category: 'owner',
  cooldown: 3,
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  privateOnly: false,
  botAdminRequired: false,
  async execute(sock, message, args, user) {
    // Check if filename is provided
    if (args.length < 1) {
      return await sock.sendMessage(message.key.remoteJid, {
        text: 'Usage: !file <filename.js>',
      }, { quoted: message });
    }

    const filename = args[0];

    // Validate filename
    if (!filename.endsWith('.js')) {
      return await sock.sendMessage(message.key.remoteJid, {
        text: '🛑Filename must end with .js',
      }, { quoted: message });
    }

    // Ask user to select folder
    const folders = ['admin', 'fun', 'general', 'owner', 'utility'];
    const folderMessage = `Select folder by number:\n1. Admin\n2. Fun\n3. General\n4. Owner\n5. Utility`;
    await sock.sendMessage(message.key.remoteJid, {
      text: folderMessage,
    }, { quoted: message });

    // Store user's filename and await reply
    user.replyCommandName = this.name;
    user.replyData = {
      step: 1,
      filename: filename,
      folders: folders,
    };
    await user.save();
  },
  async onReply(sock, message, user) {
    const chatId = message.key.remoteJid;
    const replyData = user.replyData;
    const replyText = message.message.conversation || message.message.extendedTextMessage?.text || '';

    // Validate user's reply
    if (replyData.step === 1) {
      const folderSelection = parseInt(replyText);
      if (isNaN(folderSelection) || folderSelection < 1 || folderSelection > 5) {
        return await sock.sendMessage(chatId, {
          text: '🚨Invalid selection. Please reply with a number between 1 and 5.',
        }, { quoted: message });
      }

      // Map folder selection to folder name
      const selectedFolder = replyData.folders[folderSelection - 1];
      const filename = replyData.filename;

      // Construct file path
      const filePath = path.join(__dirname, `../../commands/${selectedFolder}`, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(chatId, {
          text: `☪️File not found: ${selectedFolder}/${filename}`,
        }, { quoted: message });
      }

      // Read file contents
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Send file contents as a reply
      await sock.sendMessage(chatId, {
        text: fileContent,
      }, { quoted: message });

      // Reset user's data
      user.replyCommandName = null;
      user.replyData = null;
      await user.save();
    }
  },
};