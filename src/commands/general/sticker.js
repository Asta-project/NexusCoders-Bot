const config = require('../../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Readable } = require('stream');
const { writeFile } = require('fs/promises');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

module.exports = {
  name: 'sticker',
  description: 'Convert media to sticker',
  usage: '!sticker [reply]',
  category: 'group',
  aliases: ['stik'],
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,
  adminOnly: true,
  botAdminRequired: false,
  async execute(sock, message, args, user) {
    try {
      const chatId = message.key.remoteJid;
      const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quotedMsg) {
        await sock.sendMessage(chatId, {
          text: '❌ Please reply to a media message!',
      },  { quoted: message  });
        return;
      }

      let buffer;
      let mimetype;

      if (quotedMsg.imageMessage || quotedMsg.message?.imageMessage) {
        const imageMessage = quotedMsg.imageMessage || quotedMsg.message.imageMessage;
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        buffer = await streamToBuffer(stream);
        mimetype = 'image/jpeg';
      } else if (quotedMsg.videoMessage || quotedMsg.message?.videoMessage) {
        const videoMessage = quotedMsg.videoMessage || quotedMsg.message.videoMessage;
        const stream = await downloadContentFromMessage(videoMessage, 'video');
        buffer = await streamToBuffer(stream);
        mimetype = 'video/mp4';
      } 

      if (!buffer) {
        const logInfo = JSON.stringify(quotedMsg, null, 2);
        await sock.sendMessage(chatId, {
          text: `❌ Unsupported media type. Please check the logs for more information.\n\nLog Information:\n${logInfo}`,
          quoted: message
        });
        console.error('Unsupported media type:', logInfo);
        return;
      }

      const inputPath = path.join(process.cwd(), 'temp', `input_${Date.now()}.webp`);
      const outputPath = path.join(process.cwd(), 'temp', `sticker_${Date.now()}.webp`);
      await writeFile(inputPath, buffer);

      if (mimetype === 'video/mp4') {
        ffmpeg(inputPath)
          .setFormat('webp')
          .setVideoDuration(3)
          .save(outputPath)
          .on('end', async () => {
            await sock.sendMessage(chatId, {
              sticker: {
                url: outputPath,
                stickerPackTitle: 'Nexus Stickers',
                stickerPackId: 'nexus-stickers',
                senderName: 'Nexus'
              }
            });
          });
      } else {
        await sharp(inputPath)
          .resize(512, 512)
          .toFormat('webp')
          .toFile(outputPath);

        await sock.sendMessage(chatId, {
          sticker: {
            url: outputPath,
            stickerPackTitle: 'Nexus Stickers',
            stickerPackId: 'nexus-stickers',
            senderName: 'Nexus'
          }
        });
      }
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ Failed to process sticker. Error: ${error.message}\n${error.stack}`,
     },  { quoted: message  });
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