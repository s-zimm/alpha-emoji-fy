require('dotenv').config()

const express = require('express');
const axios = require('axios');
var bodyParser = require('body-parser');
const app = express();
const port = 3210;

app.use(bodyParser.urlencoded({ extended: true }));

const reactionsByUserAndChannelCache = {};

app.post('/emojify', async (req, res) => {
    const parsed = JSON.parse(req.body.payload);
    const userId = parsed.user.id;
    
    !reactionsByUserAndChannelCache[userId] && (reactionsByUserAndChannelCache[userId] = {
        "latestReaction": {
            "message_ts": "",
            "channel": ""
        }
    });
    
    if (parsed.type === 'message_action') {
        reactionsByUserAndChannelCache[userId]["latestReaction"]["message_ts"] = parsed.message_ts;
        reactionsByUserAndChannelCache[userId]["latestReaction"]["channel"] = parsed.channel.id;
        const body = {
            "trigger_id": parsed.trigger_id,
            "view": {
                "type": "modal",
                "callback_id": "modal_cb_id",
                "title": {
                    "type": "plain_text",
                    "text": "EMOJI-FY"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "GO"
                },
                "blocks": [
                    {
                        "type": "input",
                        "block_id": "emojification_input",
                        "label": {
                          "type": "plain_text",
                          "text": "MAKE IT HAPPEN"
                        },
                        "element": {
                          "type": "plain_text_input",
                          "action_id": "plain_input",
                          "placeholder": {
                            "type": "plain_text",
                            "text": "THY WILL BE DONE"
                          }
                        }
                      }
                ]
              }
          };
          await axios.post('https://slack.com/api/views.open', body, {
            headers: {
                Authorization: `Bearer ${process.env.SLACK_AUTH_TOKEN}`,
                'Content-Type': 'application/json',
            },
          });
          
      res.status(200).send();
    } else if (parsed.type === 'view_submission') {
        const values = parsed.view.state.values.emojification_input.plain_input.value;
        const letters = values.toLowerCase().split('');
        let isInvalid = false;
        const numberOfLettersMapping = letters.reduce((total, currentLetter) => {
            total[currentLetter]
                ? total[currentLetter] += 1
                : total[currentLetter] = 1;
            if (total[currentLetter] > 2) {
                isInvalid = true;
            }
            return total;
        }, {});
        if (isInvalid) {
            const bod = {
                errors: [
                    {
                        name: "input_validation",
                        error: "Must use two or less of the same letter"
                    }
                ]
            }
            res.status(200).json(bod);
            return;
        }
        const executeIfIncomplete = async (i = 0) => {
            const body = {
                channel: reactionsByUserAndChannelCache[userId]["latestReaction"]["channel"],
                timestamp: reactionsByUserAndChannelCache[userId]["latestReaction"]["message_ts"]
            }
            if (numberOfLettersMapping[letters[i]] === 2) {
                body.name = `alphabet-yellow-${letters[i]}`;
                numberOfLettersMapping[letters[i]] -= 1;
            } else {
                body.name = `alphabet-white-${letters[i]}`;
            }
            await axios.post('https://slack.com/api/reactions.add', body, {
                headers: {
                    Authorization: `Bearer ${process.env.SLACK_AUTH_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });
            if (letters.length - 1 > i) {
                executeIfIncomplete(i + 1);
            } else {
                delete reactionsByUserAndChannelCache[userId];
            }
        }
        executeIfIncomplete();
        res.status(200).send();
    }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});