const axios = require('axios');

module.exports = {
  name: 'pinterest',
  description: 'Search Pinterest images',
  usage: ['!pinterest <search_query> -<number>'],
  category: 'search',
  cooldown: 5,
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  privateOnly: false,
  botAdminRequired: false,

  async execute(sock, message, args) {
    const chatId = message.key.remoteJid;
    const input = args.join(' ');
    const [searchQuery, numberOfImages] = input.split('-');

    if (!searchQuery || !numberOfImages) {
      return await sock.sendMessage(chatId, {
        text: 'Usage: !pinterest <search_query> -<number>',
      }, { quoted: message });
    }

    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D${searchQuery}&data=%7B%22options%22%3A%7B%22isPrefetch%22%3Afalse%2C%22query%22%3A%22${searchQuery}%22%2C%22scope%22%3A%22pins%22%2C%22no_fetch_context_on_resource%22%3Afalse%7D%2C%22context%22%3A%7B%7D%7D&_=1619980301559`;

    try {
      const response = await axios.get(url);
      const data = response.data;
      const results = data.resource_response.data.results;
      const images = results.map(v => v.images.orig.url);

      // Shuffle array
      function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
      }
      shuffleArray(images);

      // Take specified number of images
      const imageUrls = images.splice(0, parseInt(numberOfImages));

      // Send images
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        await sock.sendMessage(chatId, {
          image: { url: imageUrl },
          caption: `*_Here is the result of: ${searchQuery}*_`,
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, {
        text: 'Done✅',
      }, { quoted: message });
    } catch (error) {
      console.error('Error:', error);
      await sock.sendMessage(chatId, {
        text: 'Failed to fetch Pinterest images. Please try again later.',
      }, { quoted: message });
    }
  },
};