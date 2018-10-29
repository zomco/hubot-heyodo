// Description:
// 背锅侠
// 功能介绍:
//      1. 在讨论组滥用特定字符时自动提醒
//      2. 在讨论组匿名回复消息
// 使用说明:
//    自动提醒
//      1. 默认开启感叹号检查
//    匿名回复
//      1. 把背锅侠加进讨论组Z
//      2. 把讨论组Z中想要匿名回复的消息A转发给背锅侠
//      3. 把回复的话B发给背锅侠
//      4. 背锅侠代你在讨论组Z中把消息B回复给消息A
//      5. 过程是匿名的，除非你在消息B暴露自己
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

module.exports = async (robot) => {

  // 监听讨论组消息
  const warnings = {};
  robot.hear(/.+/i, res => {
    const { message: { user: { message } } }= res;
    // 只处理讨论组消息
    if (message.type !== 'channel_message') {
      return;
    }
    // 叹号警告
    if (message.subtype === 'normal') {
      const match = message.text.match(EXCLM_REGEX);
      if (EXCLM_WARN && match) {
        const warning = warnings[message.uid] || [];
        warning.push({
          length: match.length,
          total: message.text.length,
        });
        res.reply('滥用感叹号不是成熟的表现，我劝你冷静。');
      }
    } else if (message.subtype === 'forwarded') {
      const { repost } = message;
      const match = repost.text.match(EXCLM_REGEX);
      if (EXCLM_WARN && match) {
        const warning = warnings[message.uid] || [];
        warning.push({
          length: match.length,
          total: message.text.length,
        });
        const newEnvelope = {
          room: { vchannel_id: message.vchannel_id },
          user: {
            message: {
              channel_id: message.vchannel_id,
              key: message.key,
              type: 'channel_message',
              uid: message.uid,
              vchannel_id: message.vchannel_id,
            },
          },
        };
        const newText = '你在退群的边缘试探，答应我别转发滥用感叹号的消息好吗？';
        const newMessage = robot.adapter.client.packMessage(true, newEnvelope, [newText]);
        robot.adapter.client.sendMessage(newEnvelope, newMessage);
      }
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
    // 根据从讨论组的转发消息, 仿照SDK的reply, 构造新消息结构体
    if (message.subtype === 'forwarded') {
      const { repost } = message;
      const envelope = {
        room: { vchannel_id: repost.vchannel_id },
        user: {
          message: {
            channel_id: repost.vchannel_id,
            key: repost.message_key,
            type: 'channel_message',
            uid: repost.uid,
            vchannel_id: repost.vchannel_id,
          },
        },
      };
      res.send('对以上转发消息有何看法。');
      envelopes[message.uid] = envelope;
    }
    // 根据接收消息，替换消息中的叹号为空格，发送新消息到特定讨论组
    const newEnvelope = envelopes[message.uid];
    if (message.subtype === 'normal' && newEnvelope) {
      const channelInfo = await bearychat.channel
        .info({ token, channel_id: newEnvelope.room.vchannel_id })
        .then(resp => resp.json())
        .catch(err => robot.logger.error(err));
      const { is_member } = channelInfo;
      if (is_member === true) {
        let newText = EXCLM_WARN ? message.text.replace(EXCLM_REGEX, ' ') : message.text;
        const newMessage = robot.adapter.client.packMessage(true, newEnvelope, [newText]);
        robot.adapter.client.sendMessage(newEnvelope, newMessage);
      } else if (is_member === false) {
        res.send(`背锅侠还不是讨论组 #${channelInfo.name} 的成员。`);
      } else {
        const { error = '' } = channelInfo;
        res.send(`出了点小问题，请稍后重试。（${error}）`);
      }
      envelopes[message.uid] = null;
    } else if (message.subtype === 'normal' && !newEnvelope) {
      res.send(`
      如何借助背锅侠匿名回复消息:
    1. 把背锅侠加进讨论组Z。
    2. 把讨论组Z中想要匿名回复的消息A转发给背锅侠。
    3. 把回复的话B发给背锅侠。
    4. 背锅侠代你在讨论组Z中把消息B回复给消息A。
    5. 过程是匿名的，除非你在消息B暴露自己。
      `);
    }

  });

  // 错误处理
  robot.error((err, res) => {
    robot.logger.error('DOES NOT COMPUTE');
    if (res) {
      res.reply('出了点小问题，请稍后重试。');
    }
  });

};


