const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const acorn = require('acorn');
const loadedCommands = {};
const folders = ['admin', 'fun', 'general', 'owner', 'utility'];

module.exports = {
  name: 'cmd',
  description: 'Manage command files',
  usage: [
    '!cmd install <filename.js> <code>',
    '!cmd delete <filename.js>',
    '!cmd load <filename.js>',
    '!cmd unload <filename.js>',
    '!cmd loadall',
  ],
  category: 'owner',
  cooldown: 3,
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  privateOnly: false,
  botAdminRequired: false,

  async execute(sock, message, args, user) {
    const action = args[0].toLowerCase();
    let filename;

    switch (action) {
      case 'install':
      case 'delete':
      case 'load':
      case 'unload':
        if (args.length < 2) {
          return await sock.sendMessage(message.key.remoteJid, {
            text: 'Usage:\n' + this.usage.join('\n') + '\n🤔',
          }, { quoted: message });
        }
        filename = args[1];

        // Validate filename
        if (!filename.endsWith('.js')) {
          return await sock.sendMessage(message.key.remoteJid, {
            text: 'Filename must end with .js 📝',
          }, { quoted: message });
        }

        const folderMessage = `Select folder:\n1. Admin\n2. Fun\n3. General\n4. Owner\n5. Utility`;
        await sock.sendMessage(message.key.remoteJid, {
          text: folderMessage,
        }, { quoted: message });

        // Store user's data and await reply
        user.replyCommandName = this.name;
        user.replyData = {
          step: 1,
          action: action,
          filename: filename,
          folders: folders,
          args: args,
        };
        await user.save();
        break;

      case 'loadall':
        const up = '|¯¯¯¯¯¯¯¯¯¯|Loading|¯¯¯¯¯¯¯¯¯¯|\n';
        try {
          const loaded = [];
          const errors = [];
          let loadMessage = '';

          folders.forEach((folder) => {
            const files = fs.readdirSync(path.join(__dirname, `../../commands/${folder}`));
            files.forEach((file) => {
              if (file.endsWith('.js')) {
                try {
                  loadedCommands[file] = require(path.join(__dirname, `../../commands/${folder}`, file));
                  loaded.push(file);
                  loadMessage += `(Loaded ${file} successfully from ${folder})\n`;
                } catch (error) {
                  errors.push({ file, error: error.message });
                  loadMessage += `(Unable to load from ${folder}: ${error.message})\n`;
                }
              }
            });
          });

          loadMessage += '|______________|×ღ×|______________|\n';
          loadMessage += `Loaded ${loaded.length} commands successfully and ${errors.length} unsuccessful.`;
          await sock.sendMessage(message.key.remoteJid, {
            text: `${up}\n${loadMessage}`,
          }, { quoted: message });
        } catch (error) {
          await sock.sendMessage(message.key.remoteJid, {
            text: `Failed to load commands: ${error.message}`,
          }, { quoted: message });
        }
        break;

      default:
        if (action !== 'loadall') {
          return await sock.sendMessage(message.key.remoteJid, {
            text: 'Invalid action. Use "install", "delete", "load", "unload", or "loadall"',
          }, { quoted: message });
        }
    }
  },

  async onReply(sock, message, user) {
    const chatId = message.key.remoteJid;
    const replyData = user.replyData;
    const replyText = message.message.conversation || message.message.extendedTextMessage?.text || '';
    const args = replyData.args;

    // Validate user's reply
    if (replyData.step === 1) {
      const folderSelection = parseInt(replyText);
      if (isNaN(folderSelection) || folderSelection < 1 || folderSelection > 5) {
        return await sock.sendMessage(chatId, {
          text: 'Invalid selection. Please reply with a number between 1 and 5.',
        }, { quoted: message });
      }

      // Map folder selection to folder name
      const selectedFolder = replyData.folders[folderSelection - 1];
      const action = replyData.action;
      const filename = replyData.filename;
      const commandPath = path.join(__dirname, `../../commands/${selectedFolder}`);
      const filePath = path.join(commandPath, filename);

      switch (action) {
            case 'install':
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      return await sock.sendMessage(chatId, {
        text: `Failed to delete existing file: ${error.message} `,
      }, { quoted: message });
    }
  }

  const url = args[1];
  const domain = url.match(/(?:http[s]?:\/\/(?:www\.)?)([a-zA-Z0-9.-]+)/)?.[0];

  // Check if input is a URL
  if (url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
    global.utils.log.dev("install", "url", url);

    // Modify Pastebin URL to raw link
    if (domain == "pastebin.com") {
      const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
      if (url.match(regex)) url = url.replace(regex, "https://pastebin.com/raw/$1");
      if (url.endsWith("/")) url = url.slice(0, -1);
    } 
    else if (domain == "github.com") {
      const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
      if (url.match(regex)) url = url.replace(regex, "https://raw.githubusercontent.com/$1/$2");
    }

    try {
      const response = await axios.get(url, { responseType: 'text' });
      const rawCode = response.data;

      // Write code to temporary file
      const tmpFilePath = path.join(commandPath, 'tmp.js');
      await fs.writeFile(tmpFilePath, rawCode);

      // Basic code structure validation
      if (!rawCode.includes('module.exports = {') || !rawCode.includes('name:')) {
        await fs.unlinkSync(tmpFilePath);
        return await sock.sendMessage(chatId, {
          text: 'Invalid code structure. Please ensure it has a basic module export structure.',
        }, { quoted: message });
      }

      // Syntax validation
      try {
        acorn.parse(rawCode, { ecmaVersion: 'latest' });
      } catch (error) {
        await fs.unlinkSync(tmpFilePath);
        return await sock.sendMessage(chatId, {
          text: `Syntax error: ${error.message} `,
        }, { quoted: message });
      }

      // Test the command
      try {
        const tmpCommand = require(tmpFilePath);
        if (!tmpCommand.execute) {
          throw new Error('Command does not have an execute function.');
        }
      } catch (error) {
        await fs.unlinkSync(tmpFilePath);
        return await sock.sendMessage(chatId, {
          text: `Command error: ${error.message} `,
        }, { quoted: message });
      }

      // If all checks pass, install the command
      await fs.moveSync(tmpFilePath, filePath);
      await sock.sendMessage(chatId, {
        text: `Successfully installed "${filename}" `,
      }, { quoted: message });
    } catch (error) {
      return await sock.sendMessage(chatId, {
        text: `Failed to install: ${error.message} `,
      }, { quoted: message });
    }
  } else {
    // Install from normal code
    const code = args.slice(2).join(' ');

    // Basic code structure validation
    if (!code.includes('module.exports = {') || !code.includes('name:')) {
      return await sock.sendMessage(chatId, {
        text: 'Invalid code structure. Please ensure it has a basic module export structure.',
      }, { quoted: message });
    }

    // Syntax validation
    try {
      acorn.parse(code, { ecmaVersion: 'latest' });
    } catch (error) {
      return await sock.sendMessage(chatId, {
        text: `Syntax error: ${error.message} `,
      }, { quoted: message });
    }

    // Temporary file creation for testing
    const tmpFilePath = path.join(commandPath, 'tmp.js');
    await fs.writeFile(tmpFilePath, code);

    // Test the command
    try {
      const tmpCommand = require(tmpFilePath);
      if (!tmpCommand.execute) {
        throw new Error('Command does not have an execute function.');
      }
    } catch (error) {
      await fs.unlinkSync(tmpFilePath);
      return await sock.sendMessage(chatId, {
        text: `Command error: ${error.message} `,
      }, { quoted: message });
    }

    // If all checks pass, install the command
    await fs.moveSync(tmpFilePath, filePath);
    await sock.sendMessage(chatId, {
      text: `Successfully installed "${filename}" `,
    }, { quoted: message });
  }
  break;

        case 'delete':
          // Delete command logic
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              await sock.sendMessage(chatId, {
                text: `Deleted "${filename}" ✅`,
              }, { quoted: message });
            } else {
              await sock.sendMessage(chatId, {
                text: `File not found: "${filename}" 🔍`,
              }, { quoted: message });
            }
          } catch (error) {
            await sock.sendMessage(chatId, {
              text: `Failed: ${error.message} 🚫`,
            }, { quoted: message });
          }
          break;

        case 'load':
          // Load command logic
          try {
            if (fs.existsSync(filePath)) {
              loadedCommands[filename] = require(filePath);
              await sock.sendMessage(chatId, {
                text: `Loaded "${filename}" ✅`,
              }, { quoted: message });
            } else {
              await sock.sendMessage(chatId, {
                text: `File not found: "${filename}" 🔍`,
              }, { quoted: message });
            }
          } catch (error) {
            await sock.sendMessage(chatId, {
              text: `Failed to load "${filename}": ${error.message} 🚫`,
            }, { quoted: message });
          }
          break;

        case 'unload':
          // Unload command logic
          try {
            if (loadedCommands[filename]) {
              delete loadedCommands[filename];
              await sock.sendMessage(chatId, {
                text: `Unloaded "${filename}" ✅`,
              }, { quoted: message });
            } else {
              await sock.sendMessage(chatId, {
                text: `"${filename}" is not loaded 🔍`,
              }, { quoted: message });
            }
          } catch (error) {
            await sock.sendMessage(chatId, {
              text: `Failed to unload "${filename}": ${error.message} 🚫`,
            }, { quoted: message });
          }
          break;
      }

      // Reset user's data
      user.replyCommandName = null;
      user.replyData = null;
      await user.save();
      return;
    }
  },
};