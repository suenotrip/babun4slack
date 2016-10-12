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
var Q = require("q");
var dashbot = require('dashbot')(process.env.DASHBOT_API_KEY).slack;

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
    debug: true
    //include "log: false" to disable logging
});



var bot = controller.spawn({
    token: slackBotKey
}).startRTM();

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



//controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
	
		let channel = message.channel;
		//let messageType = message.event;
		//let botId = '<@' + bot.identity.id + '>';
		let userId = message.user;
		
		db.getBotUser(channel,userId).then(function(rows){
		console.log("==rows length"+rows.length);
		if (rows.length>0)
		{
		  if(rows[0].is_botactive==0){console.log("===control lies with letsclap");}

		  else{
			console.log("===control lies with bot");
			Nlp(bot,message);
		  }
		}
		else
		{
			console.log("===inserting a new row to the bot_users");
			var new_user=insertNewBotUser(channel,userId);
			Nlp(bot,message);
	
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
function developmentTool(message,result){
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
function submitTool(message,result){
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
function listProductivityTools(data,result){
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
function listMarketingTools(data,result){
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
function recommendProductivityTools(message,result){
    
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
function recommendMarketingTools(message,result){
    
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
function name(data){
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
function hello(data){
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
function about(data){
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
function help(data){
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
	return db.updateUserStatus(senderId,is_botactive).then(function(result){
		return result;
	},function(error){
		console.log("[webhook_post.js]",error);
	});
}
//Create a server to prevent Heroku kills the bot
//const server = http.createServer((req, res) => res.end());
const server =http.createServer(function (req, res) {
	res.end();
  // handle the routes
  if (req.method == 'POST'&& req.url === '/pause') {

    console.log("===Received a message from dashbot");
	var channelId=req.body.channelId;
	var teamId=req.body.teamId;
	console.log("===dashbot channel_id=",channelId);
	console.log("===dashbot teamId=",teamId);
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
});
//Lets start our server
server.listen((process.env.PORT || 5000), () => console.log("Server listening"));