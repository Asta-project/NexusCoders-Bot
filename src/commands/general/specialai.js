const { MessageType } = require('@whiskeysockets/baileys');
const axios = require('axios');
const ytdl = require('ytdl-core');
const url = require('url');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'specialai',
  aliases: ['special', 'chat'],
  category: 'general',
  description: 'Converse with AI, download YouTube videos/audio, and search Spotify',
  usage: 'specialai <prompt> | specialai -v/-a <youtube-link> | specialai spotify <song-name>',
  cooldown: 5,

  async execute(sock, message, args) {
    if (args.length < 1) {
      return sock.sendMessage(message.key.remoteJid, {
        text: '⚠️ Please provide a prompt or command!',
      }, { quoted: message });
    }

    const command = args[0].toLowerCase();
    const remoteJid = message.key.remoteJid;

    if (command === '-v' || command === '-a') {
      await handleYouTube(sock, message, args);
    } else if (command === 'spotify') {
      await handleSpotify(sock, message, args.slice(1));
    } else {
      await handleAI(sock, message, args);
    }
  }
};

async function handleYouTube(sock, message, args) {
  const remoteJid = message.key.remoteJid;
  const action = args[0];
  const checkurl = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;

  try {
    const baseApi = await getBaseApi();
    let videoID, searchQuery;

    if (!args[1]) {
      return await sock.sendMessage(remoteJid, { text: "❌ Please provide a video link or keyword", quoted: message });
    }

    if (checkurl.test(args[1])) {
      const match = args[1].match(checkurl);
      videoID = match[1];
    } else {
      args.shift();
      searchQuery = args.join(" ");
      const searchResult = (await axios.get(`${baseApi}/ytFullSearch?songName=${encodeURIComponent(searchQuery)}`)).data[0];
      
      if (!searchResult) {
        return await sock.sendMessage(remoteJid, { text: "⭕ No results found for: " + searchQuery, quoted: message });
      }
      videoID = searchResult.id;
    }

    const format = action === '-v' ? 'mp4' : 'mp3';
    const cacheDir = path.join(__dirname, 'temp');
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filePath = path.join(cacheDir, `ytb_${format}_${videoID}.${format}`);
    const { data: { title, downloadLink, quality } } = await axios.get(`${baseApi}/ytDl3?link=${videoID}&format=${format}&quality=3`);
    
    await downloadFile(downloadLink, filePath);

    await sock.sendMessage(remoteJid, {
      [format === 'mp4' ? 'video' : 'audio']: fs.readFileSync(filePath),
      mimetype: format === 'mp4' ? 'video/mp4' : 'audio/mpeg',
      caption: `🎵 Title: ${title}\n📊 Quality: ${quality}`,
      quoted: message
    });

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    await sock.sendMessage(remoteJid, { text: `❌ Error: ${error.message}`, quoted: message });
  }
}

async function handleSpotify(sock, message, args) {
  const remoteJid = message.key.remoteJid;
  
  if (args.length === 0) {
    return await sock.sendMessage(remoteJid, { text: "Please provide a song name to search for.", quoted: message });
  }

  try {
    const query = args.join(" ");
    const tracks = await searchSpotify(query);

    if (tracks.length === 0) {
      return await sock.sendMessage(remoteJid, { text: "No tracks found.", quoted: message });
    }

    const track = tracks[0];
    const { title, artists, album, releaseDate, durationMs, previewUrl, spotifyUrl } = track;

    if (!previewUrl) {
      return await sock.sendMessage(remoteJid, { text: "Sorry, preview not available for this track.", quoted: message });
    }

    const audioResponse = await axios.get(previewUrl, { responseType: 'arraybuffer' });

    await sock.sendMessage(remoteJid, {
      audio: Buffer.from(audioResponse.data),
      mimetype: 'audio/mpeg',
      caption: `🎵 ${title}\n🎤 ${artists.join(", ")}\n💽 ${album}\n📅 ${releaseDate}\n⏱ ${formatDuration(durationMs)}\n🔗 ${spotifyUrl}`,
      quoted: message
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, { text: `Error: ${error.message}`, quoted: message });
  }
}

async function handleAI(sock, message, args) {
  const prompt = args.join(" ");
  const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const imageUrl = quotedMsg?.imageMessage?.url || null;
  const senderId = message.key.participant || message.key.remoteJid;
  const senderName = message.key.fromMe ? 'You' : senderId.split('@')[0];

  try {
    const apiResponse = await axios.post("https://apiv1-k60p.onrender.com/gpt", {
      name: senderName,
      id: senderId,
      prompt: imageUrl ? `${prompt} Analyze the image: ${imageUrl}` : prompt
    });

    const result = apiResponse.data.result;
    const av = apiResponse.data.av;

    if (av) {
      const youtubeUrl = av.replace('&audio=true', '').replace('&inbrowser=true', '');
      const parsedUrl = url.parse(youtubeUrl, true);
      const query = parsedUrl.query;
      const youtubeId = query.v;

      if (youtubeId) {
        const info = await ytdl.getBasicInfo(youtubeId);
        const stream = ytdl(youtubeId, { filter: av.includes('&audio=true') ? 'audioonly' : 'videoonly' });
        
        await sock.sendMessage(message.key.remoteJid, {
          [av.includes('&audio=true') ? 'audio' : 'video']: { stream },
          mimetype: av.includes('&audio=true') ? 'audio/mpeg' : 'video/mp4',
          filename: `${info.videoDetails.title}.${av.includes('&audio=true') ? 'mp3' : 'mp4'}`
        }, { quoted: message });
      }
    } else {
      const responseText = Array.isArray(result) ? JSON.stringify(result, null, 2) : result;
      await sock.sendMessage(message.key.remoteJid, { text: responseText }, { quoted: message });
    }
  } catch (error) {
    await sock.sendMessage(message.key.remoteJid, { text: `Error: ${error.message}` }, { quoted: message });
  }
}

async function getBaseApi() {
  const base = await axios.get("https://raw.githubusercontent.com/Blankid018/D1PT0/main/baseApiUrl.json");
  return base.data.api;
}

async function downloadFile(url, path) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  fs.writeFileSync(path, Buffer.from(response.data));
}

async function searchSpotify(query) {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/search`, {
      params: {
        q: query,
        type: 'track',
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${await getSpotifyToken()}`
      }
    });

    return response.data.tracks.items.map(track => ({
      title: track.name,
      artists: track.artists.map(artist => artist.name),
      album: track.album.name,
      releaseDate: track.album.release_date,
      durationMs: track.duration_ms,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify
    }));
  } catch (error) {
    throw error;
  }
}

async function getSpotifyToken() {
  const clientId = '138ff8d23e264edba4d5838c811056ce';
  const clientSecret = 'e3578c75d5e04cf59f21af566ef877cd';

  const response = await axios.post('https://accounts.spotify.com/api/token', 
    'grant_type=client_credentials', 
    {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}