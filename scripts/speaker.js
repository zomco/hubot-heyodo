// Description:
//   @speaker === 传声筒
//   功能介绍:
//     1. 在讨论组匿名回复消息
//     2. 匿名发送消息到讨论组
//     3. 匿名发送消息到用户
//   使用说明:
//     1. 讨论组匿名回复
//       1. 把 @speaker 加进讨论组Z。
//       2. 把讨论组Z中被回复消息A转发给 @speaker 。
//       3. 把回复消息B发给 @speaker 。
//       4. @speaker 在讨论组Z中以消息B回复消息A。
//     2. 讨论组匿名发送
//       1. 发送消息A给 @speaker，消息A以 #讨论组Z 结尾。
//       2. @speaker 在讨论组Z中发送消息A。
//     3. 用户匿名发送
//       1. 发送消息A给 @speaker，消息A以 @用户M 结尾。
//       2. @speaker 在与用户M的会话中发送消息A。
//
// Dependencies:
//
// 
// Configuration:
// 
//
// Commands:
//   help 传声筒使用帮助
//   clear 清空转发消息缓存
//
// Notes:
//   https://github.com/zomco/hubot-speaker
//
// Author:
//   zomco <zomcoo@gmail.com>

const bearychat = require('bearychat');
const token = process.env.HUBOT_BEARYCHAT_TOKENS;
if (!token) {
  console.error('Missing HUBOT_BEARYCHAT_TOKENS in environment: please set and try again');
  process.exit(1);
}

// 基本信息
BOT_NAME = '传声筒';
AUTHOR = 'zomcoo@gmail.com';

// 仿照SDK, 构造回复消息的结构体
const packEnvelope = (channelId, uid, key, speaker) => {
  if (!channelId || !uid || !key || !speaker) {
    return null;
  }
  return {
    speaker,
    room: { vchannel_id: channelId },
    user: {
      message: {
        channel_id: channelId,
        key,
        type: 'channel_message',
        uid,
        vchannel_id: channelId,
      },
    },
  };
};

module.exports = async (robot) => {
  
  const envelopes = {}; // 匿名回复场景
  const attachments = {}; // 匿名发送场景

  // 使用帮助
  robot.respond(/help/i, res => {
    robot.emit('bearychat.attachment', {
      message: res.message,
      text: '我就是你的传声筒',
      attachments: [
        {
          text: `场景一，匿名回复消息：把想要匿名回复的消息转发给 @${BOT_NAME} ，顺便说点什么`,
        },
        {
          images: [
            { 
              url: 'https://github.com/zomco/hubot-speaker/blob/master/resources/example2.gif?raw=true',
            }
          ]
        },
        {
          text: `场景二, 发送匿名讨论组消息：把想要说的发给 @${BOT_NAME} ，并且以 #讨论组 结尾`,
        },
        // {
        //   text: `场景三, 发送匿名会话消息：把想要说的发给 @${BOT_NAME}，并且以 #用户名 结尾`,
        // },
      ]
    });
  });

  // 清空转发消息缓存
  robot.respond(/clear/i, res => {
    const { message: { user: { message } } }= res;
    envelopes[message.uid] = null;
    res.reply('缓存转发消息已清空。');
  });

  // 监听对话消息
  robot.respond(/.+/i, async (res) => {
    const { message: { user: { message } } }= res;
    // 只处理对话消息
    if (message.type !== 'message' || /help/i.test(message.text) || /clear/i.test(message.text)) {
      return;
    }

    if (message.subtype === 'forwarded') {
      // 转发文字消息
      const { repost } = message;
      const envelope = packEnvelope(repost.vchannel_id, repost.uid, repost.message_key, { type: 'text', data: null });
      res.reply('我是你的传声筒，有话请说。');
      envelopes[message.uid] = envelope;
    } else if (message.subtype === 'share_file') {
      // 转发文件消息, 因为转发消息里没附带原始信息的key，所以只能以attachment形式回复
      const { file } = message;
      const envelope = packEnvelope(file.channel_id, file.uid, file.key, { type: 'file', data: file.url });
      res.reply('我是你的传声筒，有话请说。');
      envelopes[message.uid] = envelope;
    } else if(message.subtype === 'file') {
      // 发送文件消息
      const { file } = message;
      res.reply('我是你的传声筒，有话请说。');
      attachments[message.uid] = file.url;
    } else if (message.subtype === 'normal') {
      // 处理普通消息
      const envelope = envelopes[message.uid];
      const attachment = attachments[message.uid];
      if (envelope && !attachment) {
        // 缓存了转发消息，则以对话消息为内容回复转发消息
        const { is_member, name, error } = await bearychat.channel
          .info({ token, channel_id: envelope.room.vchannel_id })
          .then(resp => resp.json())
          .catch(err => robot.logger.error(err));
        if (is_member === true) {
          if (envelope.speaker.type === 'text') {
            const newMessage = robot.adapter.client.packMessage(true, envelope, [message.text]);
            robot.adapter.client.sendMessage(envelope, newMessage);
            res.reply(`你的声音已传达到 #${name} 。`);
          } else if (envelope.speaker.type === 'file') {
            const { room: { vchannel_id: vchannelId } } = envelope;
            robot.emit('bearychat.attachment', {
              message: { room: { vchannelId } },
              text: message.text,
              attachments: [{ images: [{ url: envelope.speaker.data }] }],
            });
            res.reply(`你的声音已传达到 #${name} 。`);
          } else {
            res.send(`不对，你不该看到这句话，请联系作者。（${AUTHOR}）`);
          }
        } else if (is_member === false) {
          res.send(`@${BOT_NAME} 还不是讨论组 #${name} 的成员。`);
        } else if (error) {
          res.send(`出了点小问题，请稍后重试。（${error || ''}）`);
        } else {
          res.send(`出大问题了, 请联系作者。（${AUTHOR}）`);
        }
        envelopes[message.uid] = null;
      } else if (!envelope && attachment) {
        if (/\s[#][^#\s]+\s$/.test(message.text)) {
          // 没有缓存转发消息，则直接匿名发送消息到讨论组
          const match = message.text.match(/\s[#][^#\s]+\s$/);
          const channelName = match[0].trim().substring(1);
          const messageText = message.text.substring(0, match.index);
          const channels = await bearychat.channel
            .list({ token })
            .then(resp => resp.json())
            .catch(err => robot.logger.error(err));
          const channel = channels.find(channel => channel.name === channelName);
          if (channel && channel.is_member) {
            robot.emit('bearychat.attachment', {
              message: { room: { vchannelId: channel.vchannel_id } },
              text: messageText,
              attachments: [{ images: [{ url: attachment }] }],
            });
            res.reply(`你的声音已传达到 #${channelName} 。`);
          } else if (channel && !channel.is_member){
            res.reply(`@${BOT_NAME} 还不是讨论组 #${channelName} 的成员。`);
          } else {
            res.reply(`讨论组 #${channelName} 不存在。`);
          }
        } else if (/\s[@][^@\s]+\s$/.test(message.text)) {
          res.reply('暂不支持用户间的匿名消息。')
        } else {
          res.send('以#讨论组或@用户名结尾，传声筒可以把消息发给对方。');
        }
        attachment[message.uid] = null;
      } else if (!envelope && !attachment) {
        if (/\s[#][^#\s]+\s$/.test(message.text)) {
          // 没有缓存转发消息，则直接匿名发送消息到讨论组
          const match = message.text.match(/\s[#][^#\s]+\s$/);
          const channelName = match[0].trim().substring(1);
          const messageText = message.text.substring(0, match.index);
          const channels = await bearychat.channel
            .list({ token })
            .then(resp => resp.json())
            .catch(err => robot.logger.error(err));
          const channel = channels.find(channel => channel.name === channelName);
          if (channel && channel.is_member) {
            robot.messageRoom(channel.vchannel_id, messageText);
            res.reply(`你的声音已传达到 #${channelName} 。`);
          } else if (channel && !channel.is_member){
            res.reply(`@${BOT_NAME} 还不是讨论组 #${channelName} 的成员。`);
          } else {
            res.reply(`讨论组 #${channelName} 不存在。`);
          }
        } else if (/\s[@][^@\s]+\s$/.test(message.text)) {
          // 没有缓存转发消息，则直接匿名发送消息到用户
          // const match = message.text.match(/\s[@][^@\s]+\s$/);
          // const userId = match[0].trim().substring(1);
          // const messageText = message.text.substring(0, match.index);
          // const users = await bearychat.user
          //   .list({ token })
          //   .then(resp => resp.json())
          //   .catch(err => robot.logger.error(err));
          // const user = users.find(user => `<=${user.id}=>` === userId);
          // if (user) {
          //   robot.messageRoom(user.id, messageText);
          //   res.reply(`你的声音已传达到 @${user.name} 。`);
          // } else {
          //   res.reply(`用户不存在。`)
          // }
          res.reply('暂不支持用户间的匿名消息。')
        } else {
          res.send('以#讨论组或@用户名结尾，传声筒可以把消息发给对方。');
        }
      } else {
        res.send(`不对，你不该看到这句话，请联系作者。（${AUTHOR}）`);
      }
    } else {
      // 未知消息类型
      res.send(`${BOT_NAME} 无法理解你的话。`);
    }

  });

  // 错误处理
  robot.error((err, res) => {
    robot.logger.error(err);
    if (res) {
      res.reply(`出大问题了, 请联系作者。（${AUTHOR}）`);
    }
    process.exit(1);
  });

};


