// Module must be started with environment variables
//
//  accesskey="api.ai client access key"
//  slackkey="slack bot key"
//

'use strict';
var Adapter = require("./Adapter");
var db = new Adapter();
var _ = require("underscore");
var request = require('request');

const Botkit = require('botkit');

const apiai = require('apiai');
const uuid = require('node-uuid');

const http = require('http');

const Entities = require('html-entities').XmlEntities;
const decoder = new Entities();

const apiAiAccessToken = process.env.accesstoken;
const slackBotKey = process.env.slackkey;

const devConfig = process.env.DEVELOPMENT_CONFIG == 'true';

const apiaiOptions = {};
if (devConfig) {
    apiaiOptions.hostname = process.env.DEVELOPMENT_HOST;
    apiaiOptions.path = "/api/query";
}

const apiAiService = apiai(apiAiAccessToken, apiaiOptions);

const sessionIds = new Map();

const controller = Botkit.slackbot({
    debug: false
    //include "log: false" to disable logging
});

var bot = controller.spawn({
    token: slackBotKey
}).startRTM();

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}



controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    try {
        if (message.type == 'message') {
            if (message.user == bot.identity.id) {
                // message from bot can be skipped
            }
            else if (message.text.indexOf("<@U") == 0 && message.text.indexOf(bot.identity.id) == -1) {
                // skip other users direct mentions
            }
            else {

                let requestText = decoder.decode(message.text);
                requestText = requestText.replace("’", "'");

                let channel = message.channel;
                let messageType = message.event;
                let botId = '<@' + bot.identity.id + '>';
                let userId = message.user;

                console.log(requestText);
                console.log(messageType);

                if (requestText.indexOf(botId) > -1) {
                    requestText = requestText.replace(botId, '');
                }

                if (!sessionIds.has(channel)) {
                    sessionIds.set(channel, uuid.v1());
                }

                console.log('Start request ', requestText);
                let request = apiAiService.textRequest(requestText,
                    {
                        sessionId: sessionIds.get(channel),
                        contexts: [
                            {
                                name: "generic",
                                parameters: {
                                    slack_user_id: userId,
                                    slack_channel: channel
                                }
                            }
                        ]
                    });

                request.on('response', (response) => {
                console.log(response);

                    if (isDefined(response.result)) {
                        let responseText = response.result.fulfillment.speech;
                        let responseData = response.result.fulfillment.data;
                        let action = response.result.action;
						
						if( response.result.source == "agent" ){
							switch( action ){
								case "agent.hello.babun":
									hello(message);
									break;
								default:
									dontKnow(message);
							}
						}
						else if( response.result.source == "domains" ){
							console.log("===domains");
							// API.ai converts all our complex queries into
							// a simplified, canonical form.
							// We check this to decide our responses
							if( action == "input.unknown" || action == "wisdom.unknown" ){
								dontKnow(data);
							}else{
								var simplified = data.result.parameters.simplified;
								console.log("===simplified",simplified);
								switch( simplified ){
									case "how are you":
										howAreYou(message);
										break;
									case "hello":
										hello(message);
										break;
									case "goodbye":
										bye(message);
										break;
									case "good morning":
										goodMorning(message);
										break;
									case "good night":
										goodNight(message);
										break;
									case "thank you":
										thanks(message);
										break;
									case "what is up":
										watup(message);
										break;
									default:
										console.log("===domains unknown/rejected action");
										dontKnow(message);
								}
							}
						}else{
							dontKnow(message);
						}
						
						
                        /* if (isDefined(responseData) && isDefined(responseData.slack)) {
                            try{
                                bot.reply(message, responseData.slack);
                            } catch (err) {
                                bot.reply(message, err.message);
                            }
                        } else if (isDefined(responseText)) {
                            bot.reply(message, responseText, (err, resp) => {
                                if (err) {
                                    console.error(err);
                                }
                            });
                        } */

                    }
                });

                request.on('error', (error) => console.error(error));
                request.end();
            }
        }
    } catch (err) {
        console.error(err);
    }
});

function hello(data){
	db.getMessagesOfType("hello").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		var attachments = [];
		  var attachment = {
			title: 'This is an attachment',
			color: '#FFCC99',
			fields: [],
		  };

		  attachment.fields.push({
			label: 'Field',
			value: 'A longish value',
			short: false,
		  });

		  attachment.fields.push({
			label: 'Field',
			value: 'Value',
			short: true,
		  });
		attachments.push(attachment);
        bot.reply(data, {text: text,attachments: attachments,}, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
    
}

//------------------------------------------------------------------------------
function help(data){
     db.getMessagesOfType("help").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function bananas(data){
     db.getMessagesOfType("bananas").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function age(data){
    db.getMessagesOfType("age").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function joke(data){
    db.getMessagesOfType("joke").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function howAreYou(data){
    db.getMessagesOfType("how_are_you").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function dontKnow(data){
     db.getMessagesOfType("unknown").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}

//------------------------------------------------------------------------------
function bye(data){
     db.getMessagesOfType("bye").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function goodMorning(data){
     db.getMessagesOfType("good_morning").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function goodNight(data){
     db.getMessagesOfType("good_night").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}

//------------------------------------------------------------------------------
function thanks(data){
    db.getMessagesOfType("thanks").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function watup(data){
    db.getMessagesOfType("what_up").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
function gender(data){
    db.getMessagesOfType("gender").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text;
		
        bot.reply(data, text, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}

//Create a server to prevent Heroku kills the bot
const server = http.createServer((req, res) => res.end());

//Lets start our server
server.listen((process.env.PORT || 5000), () => console.log("Server listening"));