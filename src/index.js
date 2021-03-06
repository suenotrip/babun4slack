// Module must be started with environment variables
//
//  accesskey="api.ai client access key"
//  slackkey="slack bot key"
//

'use strict';
var relic=require('newrelic');
var Adapter = require("./Adapter");
var db = new Adapter();
var _ = require("underscore");
var request = require('request');
var Q = require("q");
var dashbot = require('dashbot')(process.env.DASHBOT_API_KEY).slack;
var restify = require("restify");

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

/* const controller = Botkit.slackbot({
    debug: true
    //include "log: false" to disable logging
}); */

const controller =Botkit.slackbot({
  json_file_store: './db_slackbutton_bot/',
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot','incoming-webhook','commands'],
  }
);

var port=process.env.PORT || 5000;

controller.setupWebserver(port,function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver);

  controller.webserver.post('/pause', function(req, res, next){
	console.log("dashbot channel id === "+req.body.channelId);
	console.log("dashbot team id === "+req.body.teamId);
	res.end();
	var channel_id=req.body.channelId;
	var team_id=req.body.teamId;
	var paused=req.body.paused;
	if(paused)
	{
		console.log("===paused inside true===");
		db.getBotUser(channel_id,team_id).then(function(rows){
			console.log("==row id =="+rows[0].id);	
			var id=rows[0].id;
			updateUserStatus(id,0);
		});
	}
	else{
		console.log("===paused inside false===");
		db.getBotUser(channel_id,team_id).then(function(rows){
			console.log("==row id =="+rows[0].id);	
			var id=rows[0].id;
			updateUserStatus(id,1);
		});
	} 
});

controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      //res.send('Babun bot has been added to your slack team succesfully!');
       res.redirect('http://restokitch.com');
    }
  });
});


/* var bot = controller.spawn({
    token: slackBotKey
 }).startRTM();
 
  */

/* var bot = controller.spawn({
    token: 'xoxb-46268166480-BMaEdOji6QhnWYRsT7li3YTU'
 }).startRTM();
  */
 

//console.log('Starting in Beep Boop multi-team mode');
//require('beepboop-botkit').start(controller);
  
  
controller.middleware.receive.use(dashbot.receive);
controller.middleware.send.use(dashbot.send);

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('Hi! I am Babun, your startup butler, powered by artificial intelligence and supervised by human experts. I help you find good tools and be more productive in your startup project.');
          convo.say('You must now *invite me to a channel*, then just *say "Hello @babun"* and i will assist you.');
        }
      });
    });
  }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

/* controller.hears('hello','direct_message',function(bot,message) {
  bot.reply(message,'Hello!');
}); */



//controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
	
		//console.log("===message from slack==="+message.team);
		let channel = message.channel;
		//let messageType = message.event;
		//let botId = '<@' + bot.identity.id + '>';
		let userId = message.user;
		var team = bot.identifyTeam();
		console.log("==channel_id == "+channel);
		console.log("==user_id == "+userId);
		console.log("==team_id == "+team);
		
		db.getBotUser(channel,team).then(function(rows){
		console.log("==rows length"+rows.length);
		if (rows.length>0)
		{
		  if(rows[0].is_botactive==0){console.log("===control lies with letsclap");}

		  else{
			console.log("===control lies with bot");
			//Nlp(bot,message);
					try {
				console.log("===inside NLP function===========");
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
								var result=response.result;
								
								if( response.result.source == "agent" ){
									switch( action ){
										case "agent.hello.babun":
											hello(message,bot);
											break;
										case "agent.about":
											about(message,bot);
											break;
										case "agent.help":
											help(message,bot);
											break;
										case "agent.bananas":
											bananas(message,bot);
											break;
										case "agent.age":
											age(message,bot);
											break;
										case "agent.joke":
											joke(message,bot);
											break;
										case "agent.submit.tool":
											submitTool(message,result,bot);
											break;
										case "agent.development.tool":
											developmentTool(message,result,bot);
											break;
										case "agent.list.productivity.tools":
											listProductivityTools(message,result,bot);
											break;
										case "agent.list.marketing.tools":
											listMarketingTools(message,result,bot);
											break;
										case "agent.recommend.productivity.tools":
											recommendProductivityTools(message,result,bot);
											break;
										case "agent.recommend.marketing.tools":
											console.log("marketing tools");
											recommendMarketingTools(message,result,bot);
											break;
										case "agent.find.me.a.tool":
											findMeATool(message,bot);
											break;
										case "agent.name.get":
											name(message,bot);
											break;
										case "agent.gender.get":
											gender(message,bot);
											break;
										default:
											dontKnow(message,bot);
									}
								}
								else if( response.result.source == "domains" ){
									console.log("===domains");
									// API.ai converts all our complex queries into
									// a simplified, canonical form.
									// We check this to decide our responses
									if( action == "input.unknown" || action == "wisdom.unknown" ){
										dontKnow(message);
									}else{
										var simplified = response.result.parameters.simplified;
										console.log("===simplified",simplified);
										switch( simplified ){
											case "how are you":
												howAreYou(message,bot);
												break;
											case "hello":
												hello(message,bot);
												break;
											case "goodbye":
												bye(message,bot);
												break;
											case "good morning":
												goodMorning(message,bot);
												break;
											case "good night":
												goodNight(message,bot);
												break;
											case "thank you":
												thanks(message,bot);
												break;
											case "what is up":
												watup(message,bot);
												break;
											default:
												console.log("===domains unknown/rejected action");
												dontKnow(message,bot);
										}
									}
								}else{
									dontKnow(message,bot);
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
	
	
		  }
		}
		else
		{
			console.log("===inserting a new row to the bot_users");
			var new_user=insertNewBotUser(channel,team);
			//Nlp(bot,message);
			try {
				console.log("===inside NLP function===========");
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
								var result=response.result;
								
								if( response.result.source == "agent" ){
									switch( action ){
										case "agent.hello.babun":
											hello(message,bot);
											break;
										case "agent.about":
											about(message,bot);
											break;
										case "agent.help":
											help(message,bot);
											break;
										case "agent.bananas":
											bananas(message,bot);
											break;
										case "agent.age":
											age(message,bot);
											break;
										case "agent.joke":
											joke(message,bot);
											break;
										case "agent.submit.tool":
											submitTool(message,result,bot);
											break;
										case "agent.development.tool":
											developmentTool(message,result,bot);
											break;
										case "agent.list.productivity.tools":
											listProductivityTools(message,result,bot);
											break;
										case "agent.list.marketing.tools":
											listMarketingTools(message,result,bot);
											break;
										case "agent.recommend.productivity.tools":
											recommendProductivityTools(message,result,bot);
											break;
										case "agent.recommend.marketing.tools":
											console.log("marketing tools");
											recommendMarketingTools(message,result,bot);
											break;
										case "agent.find.me.a.tool":
											findMeATool(message,bot);
											break;
										case "agent.name.get":
											name(message,bot);
											break;
										case "agent.gender.get":
											gender(message,bot);
											break;
										default:
											dontKnow(message,bot);
									}
								}
								else if( response.result.source == "domains" ){
									console.log("===domains");
									// API.ai converts all our complex queries into
									// a simplified, canonical form.
									// We check this to decide our responses
									if( action == "input.unknown" || action == "wisdom.unknown" ){
										dontKnow(message);
									}else{
										var simplified = response.result.parameters.simplified;
										console.log("===simplified",simplified);
										switch( simplified ){
											case "how are you":
												howAreYou(message,bot);
												break;
											case "hello":
												hello(message,bot);
												break;
											case "goodbye":
												bye(message,bot);
												break;
											case "good morning":
												goodMorning(message,bot);
												break;
											case "good night":
												goodNight(message,bot);
												break;
											case "thank you":
												thanks(message,bot);
												break;
											case "what is up":
												watup(message,bot);
												break;
											default:
												console.log("===domains unknown/rejected action");
												dontKnow(message,bot);
										}
									}
								}else{
									dontKnow(message,bot);
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
	
		}

	},function(error){
		console.log("[webhook_post.js]",error);
	});
	
});

function insertNewBotUser(channel,userId){
	return db.insertBotUser(channel,userId).then(function(result){
		return result;

	},function(error){
		console.log("[webhook_post.js]",error);
	});

}
function NLP(bot,message){

	try {
		console.log("===inside NLP function===========");
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
						var result=response.result;
						
						if( response.result.source == "agent" ){
							switch( action ){
								case "agent.hello.babun":
									hello(message);
									break;
								case "agent.about":
									about(message);
									break;
								case "agent.help":
									help(message);
									break;
								case "agent.bananas":
									bananas(message);
									break;
								case "agent.age":
									age(message);
									break;
								case "agent.joke":
									joke(message);
									break;
								case "agent.submit.tool":
									submitTool(message,result);
									break;
								case "agent.development.tool":
									developmentTool(message,result);
									break;
								case "agent.list.productivity.tools":
									listProductivityTools(message,result);
									break;
								case "agent.list.marketing.tools":
									listMarketingTools(message,result);
									break;
								case "agent.recommend.productivity.tools":
									recommendProductivityTools(message,result);
									break;
								case "agent.recommend.marketing.tools":
									console.log("marketing tools");
									recommendMarketingTools(message,result);
									break;
								case "agent.find.me.a.tool":
									findMeATool(message);
									break;
								case "agent.name.get":
									name(message);
									break;
								case "agent.gender.get":
									gender(message);
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
								dontKnow(message);
							}else{
								var simplified = response.result.parameters.simplified;
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

}
//------------------------------------------------------------------------------
function developmentTool(message,result,bot){
	console.log("===context name",result.contexts[0].name);
	//var senderId = data.sessionId;

	var contexts=findContextsWithLifespan(result.contexts)
	if (contexts != undefined && contexts.length != 0) {
    //ask form questions one by one
	console.log("===context length",contexts.length);

		var context=contexts.pop();
		var context_name=context.name;
		//enter a tool name
		if(context_name.toString().trim()==="development-tool")
		{
			return db.getMessagesOfType("service_name").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}
		//enter email of the product
		else if (context_name.toString().trim()==="dev-toolname")
		{
			return db.getMessagesOfType("service_email").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}

		//enter advance stage of the product
		else if (context_name.toString().trim()==="dev-toolemail")
		{
			return db.getMessagesOfType("service_advance").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}
		//enter platform for the product
		else if (context_name.toString().trim()==="dev-tooladvance")
		{

			return db.getMessagesOfType("service_platform").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});	
		}	
		//enter deadline for product
		else if (context_name.toString().trim()==="dev-toolplatform")
		{

			return db.getMessagesOfType("service_deadline").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});	
		}	
		//enter budget for product
		else if (context_name.toString().trim()==="dev-tooldeadline")
		{

			return db.getMessagesOfType("service_budget").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});	
		}	
		//enter description for product
		else if (context_name.toString().trim()==="dev-toolbudget")
		{

			return db.getMessagesOfType("service_description").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});	
		}	
	}
	else
	{
	//save the params value in db
		var devtoolname=result.parameters.devtoolname;
		var devtoolemail=result.parameters.devtoolemail;
		var devtooladvance=result.parameters.devtooladvance;
		var devtoolplatform=result.parameters.devtoolplatform;
		var devtooldeadline=result.parameters.devtooldeadline;
		var devtoolbudget=result.parameters.devtoolbudget;
		var devtooldesc=result.parameters.devtooldesc;

		console.log("devtoolname: ",devtoolname);
		console.log("devtoolemail: ",devtoolemail);
		console.log("devtooladvance: ",devtooladvance);
		console.log("devtoolplatform: ",devtoolplatform);
		console.log("devtooldeadline: ",devtooldeadline);
		console.log("devtoolbudget: ",devtoolbudget);
		console.log("devtooldesc: ",devtooldesc);



		return db.insertToolToDevelopment(devtoolname,devtoolemail,devtooladvance,devtoolplatform,devtooldeadline,devtoolbudget,devtooldesc).then(function(result1){   
            console.log("===insertion result is",result1);
            //return fb.reply( fb.textMessage("Congratulations!! Your service request is submitted. We will get back to you soon."), senderId);
			return db.getMessagesOfType("service_end").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text+" \n\nType `service` to submit your service requirement. \nType `submit tool` to submit your product. \nType `help` to know about the tools for productivity and marketing.";
			
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			
			},function(error){
				console.log("[webhook_post.js]",error);
			});
        },function(error){
            console.log("[webhook_post.js]",error);
        })
	}

}

//------------------------------------------------------------------------------
function submitTool(message,result,bot){
	console.log("===context name",result.contexts[0].name);
	

	var contexts=findContextsWithLifespan(result.contexts)
	if (contexts != undefined && contexts.length != 0) {
    //ask form questions one by one
	console.log("===context length",contexts.length);

		var context=contexts.pop();
		var context_name=context.name;
		//enter a tool name
		if(context_name.toString().trim()==="submit-tool")
		{
			return db.getMessagesOfType("form_product_name").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}
		//enter website of the product
		else if (context_name.toString().trim()==="submit-toolname")
		{
			return db.getMessagesOfType("form_product_web").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}

		//enter description of the product
		else if (context_name.toString().trim()==="submit-toolweb")
		{
			return db.getMessagesOfType("form_product_desc").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});
		}
		//enter email for the product
		else if (context_name.toString().trim()==="submit-tooldesc")
		{

			return db.getMessagesOfType("form_product_email").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text;
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});
			},function(error){
				console.log("[webhook_post.js]",error);
			});	
		}	
	}
	else
	{
	//save the params value in db
		var toolname=result.parameters.toolname;
		var website=result.parameters.website;
		var description=result.parameters.description;
		var email=result.parameters.toolemail;
		console.log("tool-name",toolname);
		console.log("website",website);
		console.log("description",description);
		console.log("email",email);


		return db.insertToolTo(toolname,website,description,email).then(function(result1){   
            console.log("===insertion result is",result1);
            //return fb.reply( fb.textMessage("Congratulations!! Your tool has been submitted."), senderId);

		return db.getMessagesOfType("form_product_end").then(function(fire_msgs){
				var fire_msg = oneOf(fire_msgs);
				var text = fire_msg.text+" \n\nType `service` to submit your service requirement. \nType `submit tool` to submit your product. \nType `help` to know about the tools for productivity and marketing.";
			
				bot.reply(message, text, (err, resp) => {
				if (err) {
					console.error(err);
				}
				});

		
			},function(error){
				console.log("[webhook_post.js]",error);
			});
        },function(error){
            console.log("[webhook_post.js]",error);
        })


	}

}

//------------------------------------------------------------------------------
function listProductivityTools(data,result,bot){
    console.log("===listing productivity subcategories");
    const MAX_PAGE_NO = 3; // page numbers begin at 0
    //var senderId = data.sessionId;
    var regex = /list_productivity_tools/i;
    var contexts = findContextsThatMatches(result.contexts,regex);
    var context = contexts.pop();
	console.log("===context lifespan", context.lifespan);
    var page = MAX_PAGE_NO - context.lifespan;

	db.getMessagesOfType("productivity_tools").then(function(fire_msgs){
		console.log("===page number",page);
		var fire_msg = findItemWithPageNumber(fire_msgs,page);
		console.log("===chosen message", fire_msg);
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
function listMarketingTools(data,result,bot){
    console.log("===listing productivity subcategories");
    const MAX_PAGE_NO = 5; // page numbers begin at 0
    var senderId = data.sessionId;
    var regex = /list_marketing_tool/i;
    var contexts = findContextsThatMatches(result.contexts,regex);
    var context = contexts.pop();
    var page = MAX_PAGE_NO - context.lifespan;

	db.getMessagesOfType("marketing_tools").then(function(fire_msgs){
		console.log("===page number",page);
		var fire_msg = findItemWithPageNumber(fire_msgs,page);
		console.log("===chosen message", fire_msg);
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
function recommendProductivityTools(message,result,bot){
    
    var subcat = result.parameters.productivity_tool;
    var attachments = [];
	
    var rows;
    return db.getItemsForSubcategory(subcat).then(function(rowss){
        rows = rowss; // save a copy
		console.log("===rows",rows);
        var promises = [];
        // Get all icons
        for(var i = 0; i < rows.length; i++){
            promises.push( db.getIconFor(rows[i].id) );
        }
        return Q.all( promises );
    }).then(function(result1){
        for(var i = 0; i < result1.length; i++){
            var image_url = result1[i].valueOf();
            var row = rows[i];
            console.log("===image for %s is %s",rows[i].id,image_url);
            ///var button = fb.createButton("Tell Me More","excerpt "+row.id);
            var excerpt = row.excerpt || "No description found";
			var attachment = {
			title: row.title,
			text: excerpt,
			color: '#FFCC99',
			fields: [],
			image_url: image_url
			};
			attachments.push(attachment);
            
        }
		
		var text="Here are 10 "+ result.parameters.productivity_tool+ " tools";
		bot.reply(message, {text: text,attachments: attachments,}, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function recommendMarketingTools(message,result,bot){
    
    var subcat = result.parameters.marketing_tool;
    var attachments = [];
	
    var rows;
    return db.getItemsForSubcategory(subcat).then(function(rowss){
        rows = rowss; // save a copy
		console.log("===rows",rows);
        var promises = [];
        // Get all icons
        for(var i = 0; i < rows.length; i++){
            promises.push( db.getIconFor(rows[i].id) );
        }
        return Q.all( promises );
    }).then(function(result1){
        for(var i = 0; i < result1.length; i++){
            var image_url = result1[i].valueOf();
            var row = rows[i];
            console.log("===image for %s is %s",rows[i].id,image_url);
            ///var button = fb.createButton("Tell Me More","excerpt "+row.id);
            var excerpt = row.excerpt || "No description found";
			var attachment = {
			title: row.title,
			text: excerpt,
			color: '#FFCC99',
			fields: [],
			image_url: image_url
			};
			attachments.push(attachment);
            
        }
		
		var text="Here are 10 "+ result.parameters.marketing_tool+ " tools";
		bot.reply(message, {text: text,attachments: attachments,}, (err, resp) => {
		if (err) {
			console.error(err);
		}
		});
    },function(error){
        console.log("[webhook_post.js]",error);
    });
}
//------------------------------------------------------------------------------
function name(data,bot){
     db.getMessagesOfType("name").then(function(fire_msgs){
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
function hello(data,bot){
	db.getMessagesOfType("hello").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text+" \n\nType `service` to submit your service requirement. \nType `submit tool` to submit your product. \nType `help` to know about the tools for productivity and marketing.";
		
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
function about(data,bot){
    db.getMessagesOfType("about").then(function(fire_msgs){
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
function help(data,bot){
     db.getMessagesOfType("help").then(function(fire_msgs){
		var fire_msg =fire_msgs[Math.floor(Math.random()*fire_msgs.length)];
        var text = fire_msg.text+" \n\nType `productivity tools` or `marketing tools` to find tools by category";
		
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
function bananas(data,bot){
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
function age(data,bot){
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
function joke(data,bot){
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
function howAreYou(data,bot){
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
function dontKnow(data,bot){
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
function bye(data,bot){
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
function goodMorning(data,bot){
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
function goodNight(data,bot){
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
function thanks(data,bot){
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
function watup(data,bot){
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
function gender(data,bot){
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
//------------------------------------------------------------------------------
function oneOf(array){
    if(array instanceof  Array){
        var index = randomIndex(array);
        return array[ index ];
    }
}
//------------------------------------------------------------------------------
function findContextsThatMatches(contexts,regex){
    var matchingContexts = [];
    contexts.forEach(function(context){
       var name = context.name;
       if( regex.test(name) ){
           matchingContexts.push(context);
           console.log(name,"matches regex");
       }
    });
    return matchingContexts;
}

function findContextsWithLifespan(contexts){
    var matchingContexts = [];
    contexts.forEach(function(context){
       var lifespan = context.lifespan;
       if(lifespan==1){
           matchingContexts.push(context);
       }
    });
    return matchingContexts;
}

//------------------------------------------------------------------------------
function findItemWithPageNumber(array,page){
    var item;
    for(var i = 0; i < array.length; i++){
        if( array[i].page == page){
            item = array[i];
            break;
        }
    }
    return item;
}
//------------------------------------------------------------------------------
function randomIndex(array){
    return Math.floor(Math.random()*array.length);
}
//------------------------------------------------------------------------------
function updateUserStatus(channelId,teamId,is_botactive){
	return db.updateUserStatus(channelId,teamId,is_botactive).then(function(result){
		return result;
	},function(error){
		console.log("[webhook_post.js]",error);
	});
}

controller.storage.teams.all(function(err,teams) {
  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }
});

/* var server = restify.createServer();
server.use(restify.queryParser());
server.use(restify.bodyParser()); */

/* server.post('/pause', function(req, res, next){
	console.log("dashbot channel id === "+req.body.channelId);
	console.log("dashbot team id === "+req.body.teamId);
	res.end();
	var channel_id=req.body.channelId;
	var team_id=req.body.teamId;
	var paused=req.body.paused;
	if(paused)
	{
		console.log("===paused inside true===");
		db.getBotUser(channel_id,team_id).then(function(rows){
			console.log("==row id =="+rows[0].id);	
			var id=rows[0].id;
			updateUserStatus(id,0);
		});
	}
	else{
		console.log("===paused inside false===");
		db.getBotUser(channel_id,team_id).then(function(rows){
			console.log("==row id =="+rows[0].id);	
			var id=rows[0].id;
			updateUserStatus(id,1);
		});
	} 
}); */

/* server.get('/oauth', function(req, res, next){

	 console.log("================== START TEAM REGISTRATION ==================")
    //temporary authorization code
    var auth_code = req.query.code

    if(!auth_code){
      //user refused auth
      res.redirect('/')
    }
    else{
      console.log("New use auth code " + auth_code)
      //perform_auth(auth_code, res)
    } 
});*/

/* var perform_auth = function(auth_code, res){
	var client_id='90897144192.90893484596';
	var secret_id='be6d0a3f69b597603750ee002ddfec22';
    //post code, app ID, and app secret, to get token
    var auth_adresse = 'https://slack.com/api/oauth.access?'
    auth_adresse += 'client_id=' + client_id
    auth_adresse += '&client_secret=' + secret_id
    auth_adresse += '&code=' + auth_code
    auth_adresse += '&redirect_uri=' + "https://babun4slack.herokuapp.com/" + "oauth"

    request.get(auth_adresse, function (error, response, body) {
      if (error){
        console.log(error)
        res.sendStatus(500)
      }

      else{
        var _body = JSON.parse(body)
        console.log("New user auth")
        console.log(_body)
		res.end()

        //register_team(_body.access_token, _body.team_name, _body.team_id)
      }
    })
  } */
  
 /*  var register_team = function(token, name, id){

    Team.findOrCreate({team_id: id}, //search option. User is identified by team id
                      {
                        access_token: token, //added on creation
                        team_name: name
                      }, function(err, team, created) {
      if(created){
        console.log(name + ": new team registered")
        console.log(team)
        //add a thank you / confirmation note
        //res.redirect('/')
      }
      else{
        console.log(name + ": team already exists")

        //update parameters
        team.team_name = name
        team.access_token = token

        team.save(function(err){
          if (err){
            console.log(err)
            //res.sendStatus(500)
          }
          else{
            console.log(name + ": info updated")
            //add a thank you / confirmation note
            //res.redirect('/')
          }
        })
      }
    })
  } */
  
//Create a server to prevent Heroku kills the bot
//const server = http.createServer((req, res) => res.end());
/* const server =http.createServer(function (req, res) {
	res.end();
  // handle the routes
  if (req.method == 'POST'&& req.url === '/pause') {
	
    console.log("===Received a message from dashbot");
	
	var jsonString = '';

        req.on('data', function (data) {
            jsonString += data;
        });

        req.on('end', function () {
            console.log("dashbot===="+JSON.parse(jsonString));
			console.log("channel id from dashbot"+JSON.parse(jsonString).channelId);
			
        });
		
	//console.log("dashbot" +JSON.parse(req.body));
	//var channelId=req.body.channelId;
	//var teamId=req.body.teamId;
	//console.log("===dashbot channel_id=",channelId);
	//console.log("===dashbot teamId=",teamId);
	
	var paused=req.body.paused;
	if(paused)
	{
	console.log("===paused inside true===");
		updateUserStatus(channelId,teamId,0);
	}
	else{
	console.log("===paused inside false===");
	updateUserStatus(channelId,teamId,1);
	} 
  }
}); */
//Lets start our server
//server.listen((process.env.PORT || 5000), () => console.log("Server listening"));