# hubot-speaker

 a robot for anonymous messaging on bearychat[https://bearychat.com] based on [hubot](https://hubot.github.com/).

![](resources/example.gif)

## Setup

refer to [hubot-bearychat](https://github.com/bearyinnovative/hubot-bearychat):

    $ export HUBOT_BEARYCHAT_TOKENS=token-token-token-here
    $ export HUBOT_BEARYCHAT_MODE=rtm
    $ ./bin/hubot -a bearychat

## Scene

* channel: group chat with robot management
* session channel: group chat without robot management
* p2p: private chat

### Relpy Anonymous Message

| Message Type | From Channel | From Session | From P2P     |
| ------------ | ------------ | ------------ | ------------ |
| Text         | OK           | OK           | Not Support  | 
| Image        | OK           | OK           | Not Supoort  |

### Send Anonymous Message

| Message Type | To Channel | To Session  | To P2P       |
| ------------ | ---------- | ----------- | ------------ |
| Text         | OK         | Not Supoort | OK           | 
| Image        | OK         | Not Supoort | OK           |

## LICENSE

MIT