const config = require('../../config');
const { getCommands } = require('../../handlers/commandHandler');

let menuType = 'list'; 

module.exports = {
  name: 'menu',
  description: 'Display all available commands',
  usage: '!menu [page/category/list]',
  category: 'general',
  async execute(sock, message, args) {
    const commands = getCommands().sort((a, b) => a.name.localeCompare(b.name));

    if (args[0] === 'category') {
      menuType = 'category';
      await sock.sendMessage(message.key.remoteJid, {
        text: 'Successfully set to category view.',
        detectLinks: true
      }, { quoted: message });
    } else if (args[0] === 'list') {
      menuType = 'list';
      await sock.sendMessage(message.key.remoteJid, {
        text: 'Successfully set to list view.',
        detectLinks: true
      }, { quoted: message });
    } else {
      let response = `╭─────────────────────❍\n│❏ ${config.bot.name} - 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗠𝗲𝗻𝘂\n`;
      response += `│❏ 𝗣𝗿𝗲𝗳𝗶𝘅: ${config.bot.prefix}\n├─────────────────────❍\n`;

      if (menuType === 'category') {
        const categorizedCommands = {};
        commands.forEach(cmd => {
          if (!categorizedCommands[cmd.category]) {
            categorizedCommands[cmd.category] = [];
          }
          categorizedCommands[cmd.category].push(cmd);
        });

        Object.keys(categorizedCommands).forEach(category => {
          response += `┏━━━━━━━━°⌜${category} ⌟°━━━━━━━━┓\n`;
          response += `│❏Here are the files in ${category} section\n`;
          response += `├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
          categorizedCommands[category].forEach(cmd => {
            response += `│☪︎ ${config.bot.prefix}${cmd.name}\n`;
          });
          response += `┗━━━━━━━━°⌜ ${category} ⌟°━━━━━━━━┛\n`;
        });
        response += `\n├───────────❍\n`;
        response += `│★Type menu list to sort menu alphabetically\n`;
        response += `╰───────────❍\n`;
      } else {
        const pageSize = 20;
        const pageNumber = parseInt(args[0]) || 1;
        const totalPages = Math.ceil(commands.length / pageSize);
        const paginatedCommands = commands.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

        paginatedCommands.forEach(cmd => {
          response += `╭────────${cmd.name}─────────╮\n│  ❏  description: ${cmd.description}\n`;
          if (cmd.usage) response += `│  ❏  Usage: ${cmd.usage}\n╰─────────༺♡༻────────╯\n`;
        });

        response += `\n├───────────────────────────❍\n`;
        response += `│❏ Total Pages: ${totalPages}\n`;
        response += `│❏ Current Page: ${pageNumber}\n`;
        response += `│★Type menu category to sort menu\n`;
        response += `│★according to category\n`;
        response += `╰───────────────────────────❍\n`;
      }
      await sock.sendMessage(message.key.remoteJid, {
        image: { url: 'https://tiny.one/bdvr9s9e' },
        caption: response,
        detectLinks: true
      }, { quoted: message });
    }
  }
};