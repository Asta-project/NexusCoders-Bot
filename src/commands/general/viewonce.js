const config = require('../../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Readable } = require('stream');
const { writeFile } = require('fs/promises');
const path = require('path');

module.exports = {
  name: 'view',
  description: 'Convert view once media to normal media',
  usage: '.view',
  category: 'group',
  aliases: ['antivo'],
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,
  adminOnly: false,
  botAdminRequired: false,
  async execute(sock, message, args, user) {
    try {
      const chatId = message.key.remoteJid;
      const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quotedMsg?.viewOnceMessageV2 && !quotedMsg?.viewOnceMessage && !quotedMsg?.message?.viewOnceMessageV2 && !quotedMsg?.message?.viewOnceMessage) {
        await sock.sendMessage(chatId, {
          text: '❌ Please reply to a view once message!',
               },    { quoted: message  });
        return;
      }

      const viewOnceMsg = quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage || quotedMsg.message.viewOnceMessageV2 || quotedMsg.message.viewOnceMessage;
      console.log('viewOnceMsg:', JSON.stringify(viewOnceMsg, null, 2));

      let buffer;
      let fileName;
      let mimetype;

      if (viewOnceMsg.message?.imageMessage) {
        const stream = await downloadContentFromMessage(viewOnceMsg.message.imageMessage, 'image');
        buffer = await streamToBuffer(stream);
        fileName = `viewonce_${Date.now()}.jpg`;
        mimetype = 'image/jpeg';
      } else if (viewOnceMsg.message?.videoMessage) {
        const stream = await downloadContentFromMessage(viewOnceMsg.message.videoMessage, 'video');
        buffer = await streamToBuffer(stream);
        fileName = `viewonce_${Date.now()}.mp4`;
        mimetype = 'video/mp4';
      } else {
        const logInfo = JSON.stringify(viewOnceMsg, null, 2);
        await sock.sendMessage(chatId, {
          text: `❌ Unsupported media type. Please check the logs for more information.\n\nLog Information:\n${logInfo}`,
     },    { quoted: message  });
        console.error('Unsupported media type:', logInfo);
        return;
      }

      if (!fileName) {
        throw new Error('File name is undefined');
      }

      const outputPath = path.join(process.cwd(), 'temp', fileName);
      await writeFile(outputPath, buffer);

      const caption = viewOnceMsg.message?.caption || '✨ View Once Media';
      await sock.sendMessage(chatId, {
        [viewOnceMsg.message?.imageMessage ? 'image' : 'video']: { url: outputPath },
        caption: caption,
        mimetype: mimetype
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ Failed to process view once media. Error: ${error.message}\n${error.stack}`,
        quoted: message
      });
    }
  }
};

async function streamToBuffer(stream) {
  const chunks = [];
  const reader = Readable.from(stream);
  for await (const chunk of reader) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}