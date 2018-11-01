// Description:
// speaker
// 功能介绍:
//      1. 在讨论组滥用特定字符时自动提醒
//      2. 在讨论组匿名回复消息
// 使用说明:
//    自动提醒
//      1. 默认开启感叹号检查
//    匿名回复
//      1. 把 @speaker 加进讨论组Z。
//      2. 把讨论组Z中被回复消息A转发给 @speaker 。
//      3. 把回复消息B发给 @speaker 。
//      4. @speaker 在讨论组Z中以消息B回复消息A。
//      5. 过程是匿名的，除非你在回复消息B中暴露自己。
//
// Dependencies:
//
// 
// Configuration:
//
//
// Commands:
//
//
// Notes:
//
//   These are from the scripting documentation: https://github.com/github/hubot/blob/master/docs/scripting.md
//
// Author:
//   zomcoo

const bearychat = require('bearychat');
const token = process.env.HUBOT_BEARYCHAT_TOKENS;
if (!token) {
  console.error('Missing HUBOT_BEARYCHAT_TOKENS in environment: please set and try again');
  process.exit(1);
}

// 测试文本中的感叹号，表达式参考 https://en.wikipedia.org/wiki/Exclamation_mark
EXCLM_WARN = true;
EXCLM_REGEX = /[\u0021\u01C3\u203C\u2048\u2049\u26A0\u2755\u2757\u2762\u2763\uA71D\uA71E\uA71F\uFE57\uFF01]/gu;
EXCLM_THRESH = 0.02;
// 基本信息
BOT_NAME = '传声筒';
AUTHOR = 'zomcoo@gmail.com';

// 仿照SDK, 构造回复消息的结构体
const packEnvelope = (channelId, uid, key) => {
  if (!channelId || !uid || !key) {
    return null;
  }
  return {
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

  // 监听讨论组消息
  const warnings = {};
  robot.hear(/.+/i, res => {
    const { message: { user: { message } } }= res;
    // 只处理讨论组消息
    if (message.type !== 'channel_message') {
      return;
    }

    if (message.subtype === 'normal') {
      // 检查普通消息
      const match = message.text.match(EXCLM_REGEX);
      if (EXCLM_WARN && match) {
        const warning = warnings[message.uid] || [];
        warning.push({
          length: match.length,
          total: message.text.length,
        });
        if (match.length / message.text.length >= EXCLM_THRESH) {
          res.reply('滥用感叹号不是成熟的表现，我劝你冷静。');
        }
      }
    } else if (message.subtype === 'forwarded') {
      // 检查转发消息
      const { repost } = message;
      const match = repost.text.match(EXCLM_REGEX);
      if (EXCLM_WARN && match) {
        const warning = warnings[message.uid] || [];
        warning.push({
          length: match.length,
          total: repost.text.length,
        });
        if (match.length / repost.text.length >= EXCLM_THRESH) {
          const newEnvelope = packEnvelope(message.vchannel_id, message.uid, message.key);
          const newText = '你在退群的边缘试探，答应我别转发滥用感叹号的消息好吗？';
          const newMessage = robot.adapter.client.packMessage(true, newEnvelope, [newText]);
          robot.adapter.client.sendMessage(newEnvelope, newMessage);
        }
      }
    } else {
      // 其他消息不做处理
    }
  });

  // 监听对话消息
  const envelopes = {};
  robot.respond(/.+/i, async (res) => {
    const { message: { user: { message } } }= res;
    // 只处理对话消息
    if (message.type !== 'message') {
      return;
    }

    if (message.subtype === 'forwarded') {
      // 转发文字消息
      const { repost } = message;
      const envelope = packEnvelope(repost.vchannel_id, repost.uid, repost.message_key);
      res.send('我是你的传声筒，有话请说。');
      envelopes[message.uid] = envelope;
    } else if (message.subtype === 'share_file') {
      // 转发文件消息, 因为转发消息里没附带原始信息的key，所以暂不支持
      // const { file } = message;
      // const envelope = packEnvelope(file.channel_id, file.uid, file.key);
      // res.send('我是你的传声筒，有话请说。');
      // envelopes[message.uid] = envelope;
      res.send('暂不支持回复文件类型消息。');
    } else if (message.subtype === 'normal') {
      // 处理普通消息
      const newEnvelope = envelopes[message.uid];
      if (newEnvelope) {
        // 缓存了转发消息，则以对话消息为内容回复转发消息
        const { is_member, name, error } = await bearychat.channel
          .info({ token, channel_id: newEnvelope.room.vchannel_id })
          .then(resp => resp.json())
          .catch(err => robot.logger.error(err));
        if (is_member === true) {
          let newText = EXCLM_WARN ? message.text.replace(EXCLM_REGEX, ' ') : message.text;
          const newMessage = robot.adapter.client.packMessage(true, newEnvelope, [newText]);
          robot.adapter.client.sendMessage(newEnvelope, newMessage);
        } else if (is_member === false) {
          res.send(`@${BOT_NAME} 还不是讨论组 #${name} 的成员。`);
        } else if (error) {
          res.send(`出了点小问题，请稍后重试。（${error || ''}）`);
        } else {
          res.send(`出大问题了, 请联系作者。（${AUTHOR}）`);
        }
        envelopes[message.uid] = null;
      } else {
        // 没有缓存转发消息，则回复教程
        robot.emit('bearychat.attachment', {
          message: res.message,
          text: '使用方法',
          attachments: [
            {
              text: '把想要匿名回复的消息转发给我，顺便说点什么，我就是你的传声筒',
            },
            {
              images: [
                { 
                  url: 'https://github.com/zomco/hubot-speaker/blob/master/resources/example2.gif?raw=true',
                }
              ]
            }
          ]
        });
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


