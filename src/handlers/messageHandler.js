const logger = require('../utils/logger');
const config = require('../config');
const { executeCommand, onReply, onChat } = require('./commandHandler');
const eventHandler = require('./eventHandler');
const messageCount = new Map();
const typingStates = new Map();

function handleSpam(jid, sock) {
    if (!config.features?.antiSpam?.enabled) return false;
    const now = Date.now();
    const userData = messageCount.get(jid) || { count: 0, lastReset: now };
    if (now - userData.lastReset > (config.features?.antiSpam?.interval || 30000)) {
        userData.count = 0;
        userData.lastReset = now;
    }
    userData.count++;
    messageCount.set(jid, userData);
    return userData.count > (config.features?.antiSpam?.maxMessages || 10);
}

async function simulateTyping(sock, jid) {
    if (!config.features?.presence?.autoTyping) return;
    if (typingStates.get(jid)) return;
    typingStates.set(jid, true);
    try {
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        setTimeout(async () => {
            await sock.sendPresenceUpdate('paused', jid);
            typingStates.delete(jid);
        }, 1000);
    } catch (error) {
        typingStates.delete(jid);
    }
}

async function handleMessage(sock, message) {
    try {
        if (!message?.message) return;
        const jid = message.key.remoteJid;
        if (!jid) return;
        const sender = message.key.participant || message.key.remoteJid;
        
        if (handleSpam(sender, sock)) {
            await sock.sendMessage(jid, { text: '⚠️ Please slow down! You are sending messages too quickly.' });
            return;
        }

        let messageText = '';
        const msg = message.message;
        if (msg.conversation) {
            messageText = msg.conversation;
        } else if (msg.extendedTextMessage) {
            messageText = msg.extendedTextMessage.text;
        } else if (msg.imageMessage) {
            messageText = msg.imageMessage.caption || '';
        } else if (msg.videoMessage) {
            messageText = msg.videoMessage.caption || '';
        }

        if (!messageText) return;
        
        if (messageText.toLowerCase() === 'prefix') {
  await sock.sendMessage(jid, { 
    text: `┌\n📲𝐁𝐎𝐓 𝐏𝐑𝐄𝐅𝐈𝐗: ${config.bot.prefix}\n         ┘`
  }, { quoted: message });
  return;
}

        if (messageText === config.bot.prefix) {
            await sock.sendMessage(jid, { 
                text: `👋 Hi! I'm NexusCoders Bot V2\nPrefix: *${config.bot.prefix}*\nUse *${config.bot.prefix}menu* to see available commands!` 
            });
            return;
        }

        if (!messageText.startsWith(config.bot.prefix)) return;

        await simulateTyping(sock, jid);

        if (config.features?.presence?.autoRecord) {
            try {
                await sock.presenceSubscribe(jid);
                await sock.sendPresenceUpdate('recording', jid);
            } catch (error) {}
        }

        const [command, ...args] = messageText.slice(config.bot.prefix.length).trim().split(' ');
        
        if (command) {
            await executeCommand(sock, message, command.toLowerCase(), args);
        }

        if (config.features?.presence?.autoRecord) {
            try {
                await sock.sendPresenceUpdate('paused', jid);
            } catch (error) {}
        }

        await onReply(sock, message, jid, sender);
        await onChat(sock, message, jid, sender);
    } catch (error) {
        logger.error('Error in message handler:', error);
    }
}

async function handleGroupParticipantsUpdate(sock, update) {
    try {
        const { id, participants, action } = update;
        if (!id || !participants || !action) return;

        switch (action) {
            case 'add':
                for (const participant of participants) {
                    await eventHandler.handleEvent('groupMemberJoin', sock, id, participant);
                }
                break;
            case 'remove':
                for (const participant of participants) {
                    await eventHandler.handleEvent('groupMemberLeave', sock, id, participant);
                }
                break;
            case 'promote':
                await eventHandler.handleEvent('groupMemberPromote', sock, id, participants);
                break;
            case 'demote':
                await eventHandler.handleEvent('groupMemberDemote', sock, id, participants);
                break;
        }
    } catch (error) {
        logger.error('Error in group participants handler:', error);
    }
}

async function handleGroupUpdate(sock, update) {
    try {
        const { id, subject, desc, restrict, announce } = update;
        if (!id) return;
        
        const updates = {};
        let hasUpdates = false;

        if (subject !== undefined) {
            updates.subject = subject;
            hasUpdates = true;
            await eventHandler.handleEvent('groupSubjectUpdate', sock, id, subject);
        }
        
        if (desc !== undefined) {
            updates.desc = desc;
            hasUpdates = true;
            await eventHandler.handleEvent('groupDescriptionUpdate', sock, id, desc);
        }

        if (restrict !== undefined || announce !== undefined) {
            updates.restrict = restrict;
            updates.announce = announce;
            hasUpdates = true;
            await eventHandler.handleEvent('groupSettings', sock, id, { restrict, announce });
        }
    } catch (error) {
        logger.error('Error in group update handler:', error);
    }
}

module.exports = {
    handleMessage,
    handleGroupParticipantsUpdate,
    handleGroupUpdate
};
