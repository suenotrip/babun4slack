// READ!!! http://taoofcode.net/promise-anti-patterns/
// READ!!! http://raganwald.com/2014/07/09/javascript-constructor-problem.html
// READ!!! https://www.firebase.com/docs/web/guide/
// READ!!! https://www.firebase.com/blog/2016-01-21-keeping-our-promises.html
// READ!!! http://stackoverflow.com/questions/17015590/node-js-mysql-needing-persistent-connection
'use strict';

var Firebase = require('firebase');
var mysql = require('mysql');
var Q = require('q');
var moment = require('moment');
var options = {
    "host" : process.env.MYSQL_HOST,
    "port" : process.env.MYSQL_PORT,
    "user" : process.env.MYSQL_USER,
    "password" : process.env.MYSQL_PASSWORD,
    "database" : process.env.MYSQL_DATABASE
};

function Adapter(){
    if(this instanceof  Adapter){
        this.root = new Firebase( process.env.FIREBASE_URL );
        this.db = mysql.createPool(options);    
    }else{
        return new Adapter();
    }
}
//------------------------------------------------------------------------------
Adapter.prototype.getMessagesOfType = function(type){
console.log("loc11");
    var query = this.root.child("messages").child(type);
    return query.once("value").then(function(snapshot){
        return snapshot.val();
		console.log("fire val: ",snapshot);
    },function(err){
        console.log("[Adapter.js getmessageOfType]",error);
    });
}
//------------------------------------------------------------------------------
Adapter.prototype.getItemsForSubcategory = function(subcat) {
    subcat = "%" + subcat + "%";
    const query = "SELECT p.ID AS id, p.post_title AS title, " +
                  "p.post_excerpt AS excerpt FROM bn_term_relationships r " +
                  "INNER JOIN bn_posts p ON p.ID = r.object_id " +
                  "INNER JOIN bn_terms t ON t.term_id = r.term_taxonomy_id " +
                  "WHERE LOWER(t.name) LIKE @subcat AND post_status='publish' " +
                  "ORDER BY RAND()" +
                  "LIMIT 10 ";
    var newQuery = query.replace("@subcat",this.db.escape(subcat));
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(newQuery,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
};
//------------------------------------------------------------------------------
Adapter.prototype.getIconFor = function(id) {
    const path = "http://www.babun.io/wp-content/uploads/";

    const query = "SELECT meta_value as path " + 
                  "FROM bn_postmeta " + 
                  "WHERE post_id in " +
                    "(SELECT meta_value FROM bn_postmeta WHERE post_id=@id AND meta_key='app_icon') " +  
                  "AND meta_key='_wp_attached_file'";
    var newQuery = query.replace("@id",id);
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(newQuery,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    if(!results || results.length == 0 ){
                        //return "http://www.babun.io/wp-content/uploads/2016/03/BabunMetaPic-1.png"
						deferred.resolve("http://www.babun.io/wp-content/uploads/2016/03/BabunMetaPic-1.png");
                    }else{
                        deferred.resolve(path + results[0].path);
                    }
                }
            });
        }
    });
    return deferred.promise;
};
//------------------------------------------------------------------------------
Adapter.prototype.getExcerptFor = function(id){
    const query = "SELECT post_excerpt as excerpt " +
                  "FROM bn_posts " +
                  "WHERE ID = " + this.db.escape(id);
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}

//------------------------------------------------------------------------------
//insert a new record in bn_cf7dbplugin_submits table
//moment().format();

Adapter.prototype.insertToolTo = function(toolname,website,description,email){
	var unix_time =moment().format('x');
	unix_time=unix_time/1000;
	//console.log("moment unix time",unix_time);
    const query = "INSERT INTO bn_cf7dbplugin_submits(submit_time,form_name,field_name,field_value,field_order)" +
                  "VALUES(" + this.db.escape(unix_time)+",'Submit a Tool','Whatisthename'," + this.db.escape(toolname) + ",'0')," +
				  "(" + this.db.escape(unix_time)+",'Submit a Tool','Whatisthewebsite'," + this.db.escape(website) + ",'1')," +
				  "(" + this.db.escape(unix_time)+",'Submit a Tool','Provideashort'," + this.db.escape(description) + ",'2')," +
				  "(" + this.db.escape(unix_time)+",'Submit a Tool','Whatisyouremail'," + this.db.escape(email) + ",'3')";
				  
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}
//------------------------------------------------------------------------------
//insert a new record in bn_cf7dbplugin_submits table

Adapter.prototype.insertToolToDevelopment = function(devtoolname,devtoolemail,devtooladvance,devtoolplatform,devtooldeadline,devtoolbudget,devtooldesc){
	var unix_time =moment().format('x');
	unix_time=unix_time/1000;
	//console.log("moment unix time",unix_time);
    const query = "INSERT INTO bn_cf7dbplugin_submits(submit_time,form_name,field_name,field_value,field_order)" +
                  "VALUES(" + this.db.escape(unix_time)+",'Development','Whatisthename'," + this.db.escape(devtoolname) + ",'0')," +
				  "(" + this.db.escape(unix_time)+",'Development','youremail'," + this.db.escape(devtoolemail) + ",'1')," +
				  "(" + this.db.escape(unix_time)+",'Development','whatisthewebsite'," + this.db.escape(devtooladvance) + ",'2')," +
				  "(" + this.db.escape(unix_time)+",'Development','platform'," + this.db.escape(devtoolplatform) + ",'3'),"+
				  "(" + this.db.escape(unix_time)+",'Development','platformotht','','4'),"+
				  "(" + this.db.escape(unix_time)+",'Development','timeframe'," + this.db.escape(devtooldeadline) + ",'5'),"+
				  "(" + this.db.escape(unix_time)+",'Development','budget'," + this.db.escape(devtoolbudget) + ",'6'),"+
				  "(" + this.db.escape(unix_time)+",'Development','describe'," + this.db.escape(devtooldesc) + ",'7'),"+
				  "(" + this.db.escape(unix_time)+",'Development','Submitted From','BabunBot','10000')";
				  
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}
//------------------------------------------------------------------------------



//get bot user on userid
Adapter.prototype.getBotUser= function(channel,userId){
	
    const query ="SELECT is_botactive " +
                  "FROM slack_users " +
                  "WHERE team_id = " + this.db.escape(userId)+"AND channel_id="+this.db.escape(channel);
				  
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}

//------------------------------------------------------------------------------
//insert a new record in bot_users table

Adapter.prototype.insertBotUser = function(channel,userId){
	
    const query = "INSERT INTO slack_users(channel_id,team_id,is_botactive)" +
                  "VALUES("+this.db.escape(channel) +","+ this.db.escape(userId) + ",'1')" ;
				  
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}
//------------------------------------------------------------------------------
//update the status of user in bot_users table
Adapter.prototype.updateUserStatus = function(channel,userId,is_botactive){
	
    const query = "UPDATE slack_users SET is_botactive =" +
                   this.db.escape(is_botactive)+ " where team_id ="+this.db.escape(userId) + "AND channel_id="+this.db.escape(channel);
				  
    var deferred = Q.defer();
    this.db.getConnection(function(err,connection){
        if(err){
            deferred.reject(err);
        }else{
            connection.query(query,[],function(err,results){
                connection.release();
                if(err){
                    deferred.reject(err);
                }else{
                    deferred.resolve(results);
                }
            });
        }
    });
    return deferred.promise;
}
module.exports = Adapter;