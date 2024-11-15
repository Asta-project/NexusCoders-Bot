const axios = require('axios');

module.exports = {
  name: 'wiki',
  description: 'Search Wikipedia or reply to search another term',
  usage: '!wiki <search term>',
  category: 'utility',
  aliases: ['wikipedia', 'search'],
  cooldown: 3,
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  privateOnly: false,
  botAdminRequired: false,

  async execute(sock, message, args, user) {
    const chatId = message.key.remoteJid;
    const quotedMsg = message.message.extendedTextMessage?.contextInfo?.quotedMessage;

    try {
      let searchTerm;

      if (quotedMsg) {
        searchTerm = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || args.join(' ');
      } else {
        searchTerm = args.join(' ');
      }

      if (!searchTerm) {
        await sock.sendMessage(chatId, {
          text: `Please provide a search term or reply to a message to search.`,
          }, { quoted: message });
        return;
      }

      const response = await axios.get(`https://en.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          utf8: 1,
          srlimit: 3,
        },
      });

      const results = response.data.query.search;

      if (results.length === 0) {
        await sock.sendMessage(chatId, {
          text: `No Wikipedia results found for: ${searchTerm}`,
          }, { quoted: message });
        return;
      }

      const formattedResults = results.map((result, index) => {
        const title = result.title.replace(/<\/?[^>]+(>|$)/g, '');
        const snippet = result.snippet.replace(/<\/?[^>]+(>|$)/g, '');
        return `${index + 1}️⃣ *${title}*\n${snippet}\n`;
      }).join('\n');

      await sock.sendMessage(chatId, {
        text: `🔍 Results for: *${searchTerm}*\n\n${formattedResults}\nReply with a number (1-3) to get the full article.`,
        }, { quoted: message });

      user.replyCommandName = this.name;
      user.replyData = {
        step: 1,
        results: results.map((r) => r.title),
      };
      await user.save();
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: `Error searching Wikipedia: ${error.message}`,
        quoted: message,
      });
    }
  },

  async onReply(sock, message, user) {
    const chatId = message.key.remoteJid;

    try {
      const replyData = user.replyData || {};
      const replyText = message.message.conversation || message.message.extendedTextMessage?.text || '';

      if (replyData.step === 1) {
        const selection = parseInt(replyText);

        if (isNaN(selection) || selection < 1 || selection > 3) {
          await sock.sendMessage(chatId, {
            text: `Please reply with a number between 1 and 3 to select an article.`,
            }, { quoted: message });
          return;
        }

        const selectedTitle = replyData.results[selection - 1];
        const response = await axios.get(`https://en.wikipedia.org/w/api.php`, {
          params: {
            action: 'query',
            prop: 'extracts|info',
            exintro: true,
            explaintext: true,
            inprop: 'url',
            format: 'json',
            titles: selectedTitle,
          },
        });

        const pages = response.data.query.pages;
        const page = pages[Object.keys(pages)[0]];
        const extract = page.extract?.substring(0, 1000);
        const url = page.fullurl;
        const articleText = `📚 *${page.title}*\n\n${extract}...\n\n🌐 Read more: ${url}`;

        await sock.sendMessage(chatId, {
          text: articleText,
          }, { quoted: message });

        user.replyCommandName = null;
        user.replyData = null;
        await user.save();
      }
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: `Error retrieving article: ${error.message}`,
        }, { quoted: message });
      user.replyCommandName = null;
      user.replyData = null;
      await user.save();
    }
  },
};