const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const passport = require('passport');
const flash = require('connect-flash');
var db;

var handlebars = require('express3-handlebars').create({ defaultLayout:'main' });
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.use(require("express-session")({
  secret:"Hello World, this is a session",
  resave: false,
  saveUninitialized: false
  }));

app.use(bodyParser.urlencoded({extended:true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use('user', new LocalStrategy(
  function(username,password,done) {
    db.collection('users').findOne({username: username} , function(err, user) {
      if (err) { return done(err); }
      if(!user)
      {
         console.log('username does not exist');
         return done(null, false, { message: 'Incorrect username.' });
      }
      validPassword(username, password, done);
    });
  }
));


function validPassword(username,password, done) {
  db.collection('users').findOne({username: username}, function(err, user) {
    if (err) {return done(err); }
    if (password == user.password) {
      console.log('correct credentials');
      return done(null, user);}
    else {
      console.log('incorrect password');
      return done(null, false);
    }
  })

}


app.set('port', process.env.PORT || 3000);

app.use(express.static(__dirname + '/public'));


app.use(function(req,res,next){
  res.locals.showTests = app.get('env') !== 'production' &&
    req.query.test === '1';
    next();
});

app.get('/', function(req,res) {
  res.render('home');
});

app.get('/login', function(req,res){
  res.render('login');
});

app.post('/login',
  passport.authenticate('user', {
    successRedirect:'/seminars',
    failureRedirect:'/login',
    failureFlash: true
  })
);

app.get('/register', function(req, res){
    res.render('register');
});

app.post('/register', function(req, res){

  var item = {
    username: req.body.username,
    password: req.body.password
  }
  db.collection('users').insertOne(item, function(err) {
    if (err) return console.log(err)
  });
  console.log('user added');
  res.redirect('/');
});

app.get('/seminars', function(req,res) {
  res.render('seminars');
  console.log('You are logged in as' + req.user.username);
});


app.get("/logout", function(req, res){
     req.logout();
     res.redirect('/');
});

//Custom 404 page
app.use(function(req,res,next){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function() {
  console.log( 'Express started on http://localhost:' +
  app.get('port') + '; press Ctrl-C to terminate.' );
});


var uri = 'mongodb://admin:admin1234@ds137812.mlab.com:37812/seminar-system';
MongoClient.connect(uri, { useNewUrlParser: true }, function(err, database) {
  if (err) {
    return console.log(err);
  }

  db = database.db('seminar-system');
  console.log('Connected to Database! listening on 3000');
});
