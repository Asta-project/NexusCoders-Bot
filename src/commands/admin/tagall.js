module.exports = {
    name: 'tagall',
    description: 'Tag all members in the group chat.',
    usage: '!tagall <message>',
    category: 'utility',
    aliases: ['everyone'],
    cooldown: 10,
    adminOnly: true, 
    ownerOnly: false,
    async execute(sock, message, args) {
        if (!message.key.remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(message.key.remoteJid, { text: 'This command can only be used in group chats.' });
            return;
        }

        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(message.key.remoteJid);
        } catch (err) {
            await sock.sendMessage(message.key.remoteJid, { text: 'Unable to fetch group participants. Please try again later.' });
            return;
        }

        const participants = groupMetadata.participants;
        const messageText = args.length > 0 ? args.join(' ') : 'Hello everyone!';
        const mentions = participants.map(p => p.id);
        const mentionsText = participants.map(p => `@${p.id.split('@')[0]}`).join('\n☯');

        // Send the message with mentions
        await sock.sendMessage(message.key.remoteJid, {
            text: `━━━━━━━━━━━━━━━━━/n${messageText}\n━━━━━━━━━━━━━━━━━\n\n${mentionsText}\n╰──────────────🔥`,
            mentions: mentions
        });
    }
}