var express = require('express');
global.oauth = require('oauth');
var sys = require('sys');
global.twitter = require('twitter');
var app = module.exports = express.createServer();
var io = require('socket.io');
global.packets = require('./packets').packets;

// Configuration!
global.tradeking = {
  api_url: "https://api.tradeking.com/v1",
  consumer_key: "",
  consumer_secret: "",
  access_token: "",
  access_secret: ""
}
global.twitter_user = {
  consumer_key : '',
  consumer_secret : '',
  access_token_key : '',
  access_token_secret : ''
}

global.tradeking_consumer = new oauth.OAuth(
  "https://developers.tradeking.com/oauth/request_token",
  "https://developers.tradeking.com/oauth/access_token",
  tradeking.consumer_key,
  tradeking.consumer_secret,
  "1.0",
  "http://localhost:3000/tradeking/callback",
  "HMAC-SHA1");

global.twitter_consumer = new oauth.OAuth(
  "https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token",
  twitter_user.consumer_key,
  twitter_user.consumer_secret,
  "1.0A",
  null,
  "HMAC-SHA1");

global.twitter_client = new twitter(twitter_user);

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes
app.get('/', function(req, res) {
  redirect(res, '/tradeking/connect');
});

app.get('/watchlist', function(req, res) {
  res.render('watchlist',{
    title:'TradeKing Watchlist Mashup!',
  })
});

// TradeKing OAuth
app.get('/tradeking/connect', function(req, res){
  tradeking_consumer.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
    if (error) {
      res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
    } else {
      tradeking.request_token = oauthToken;
      tradeking.request_secret = oauthTokenSecret;
      redirect(res, "https://developers.tradeking.com/oauth/authorize?oauth_token=" + tradeking.request_token);
    }
  });
});

app.get('/tradeking/callback', function(req, res){
  tradeking_consumer.getOAuthAccessToken(tradeking.oauthRequestToken, tradeking.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
    console.log('TradeKing Request Token: ' + tradeking.oauthRequestToken);
    console.log('TradeKing Request Token Secret: ' + tradeking.oauthRequestTokenSecret);
    console.log('TradeKing Request OAuth Verifier: ' + req.query.oauth_verifier);
    tradeking_consumer.getOAuthAccessToken(tradeking.request_token, tradeking.request_secret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
      if (error) {
        res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
      } else {
        tradeking.access_token = oauthAccessToken;
        tradeking.access_secret = oauthAccessTokenSecret;
        console.log('TradeKing Access Token: ' + tradeking.access_token);
        console.log('TradeKing Access Token Secret: ' + tradeking.access_secret);
        redirect(res, '/watchlist');
      }
    });
  });
});

// Twitter OAuth
app.get('/twitter/connect', function(req, res){
  twitter_consumer.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
    if (error) {
      res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
    } else {
      twitter_user.oauth_request_token = oauthToken;
      twitter_user.oauth_request_token_secret = oauthTokenSecret;
      redirect(res, "https://twitter.com/oauth/authorize?oauth_token="+twitter_user.oauth_request_token);
    }
  });
});

app.get('/twitter/callback', function(req, res){
  console.log('Twitter Request Token: ' + twitter_user.oauth_request_token);
  console.log('Twitter Request Token Secret: ' + twitter_user.oauth_request_token_secret);
  console.log('Twitter Request Token: ' + req.query.oauth_verifier);
  twitter_consumer.getOAuthAccessToken(twitter_user.oauth_request_token, twitter_user.oauth_request_token_secret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
    if (error) {
      res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
    } else {
      // delete request tokens
      delete(twitter_user.oauth_request_token);
      delete(twitter_user.oauth_request_token_secret);

      // set the access tokens
      twitter_user.access_token_key = oauthAccessToken;
      twitter_user.access_token_secret = oauthAccessTokenSecret;

      console.log('Twitter Access Token: ' + twitter_user.access_token_key);
      console.log('Twitter Access Token Secret: ' + twitter_user.access_token_secret);

      redirect(res, '/watchlist');
    }
  });
});

app.listen(3000);
var sio = io.listen(app);
sio.set('log level', 1);
sio.sockets.on('connection', function (client) {
  packets.handle(client)
  client.on('disconnect',function(){
    console.log('dropped')
  });
});
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// fix broken redirect function in express
function redirect(res, url) {
  res.writeHead(301, {'Location': url });
  res.end();
}