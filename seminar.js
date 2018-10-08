const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const objectID = require('mongodb').ObjectID;
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
  res.redirect('seminars');
});

app.get('/login', function(req,res){
  res.render('login');
});

app.post('/login',
  passport.authenticate('user', {
    successRedirect:'/management',
    failureRedirect:'/login',
    failureFlash: true
  })
);

app.get('/register/:id', function(req, res){
    var o_id = new objectID(req.params.id);

    var doc;
    db.collection('seminars').findOne( {_id: o_id}, function(err, seminar) {
      if (err) throw console.log(err);
      if (seminar) {
        doc = seminar;
        console.log("redirecting to seminar");
        res.render('register', {Title: 'Register', seminar: doc, seminarId: o_id});
      }
      })
});



app.post('/register/:id/utsLogin', function(req, res) {
  var o_id = new objectID(req.params.id);
  var url = '/register/' + o_id;
  db.collection('students').findOne({studentId: req.body.studentId} , function(err, user) {
    if (err) {
      throw err;
    }
    if (!user) {
      console.log("student not found");
      var url = "/register/" + o_id;
      res.redirect(url);
    }
    if (user) {
      if (user.password == req.body.password) {
        console.log("password matches!");
        res.render('register', {isConfirmed : true, isStudent: false, seminarId: o_id })
          }
        }

      else {
        console.log("incorrect password");
        res.redirect(url);
      }
    })
  });

app.get('/register/:id/complete', function(req,res) {
  res.render('complete');
})

app.post('/register/:id/complete', function(req,res) {
  var o_id = req.params.id;
  var item = [];
  var url = '/register/' + o_id + '/complete';
  item = {
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    seminarID: o_id.toString()
  }
  db.collection('registers').insertOne(item, function(err) {
    if (err) throw err;
  db.collection('registers').findOne({email: req.body.email} , function(err, user) {
    if (err) {console.log(err)}
    var db_id = new objectID(user.seminarID);
    if (db_id == o_id) {
      var userID = user._id;
      var seminarID = user.seminarID;
      var url = "http://localhost:3000/seminar/manage/" + userID +"?seminarid="+seminarID
      res.render('complete', {seminarId: seminarID, userId: userID, url : url});
    }
    else {
      throw console.log('failed')
    }
  })
  })
});

/*User Detail Management Page - Change/Delete their registration*/
app.get('/seminar/manage/:userid/', function(req,res) {
  var userid = new objectID(req.params.userid);
  var seminarid = req.query.seminarid;
  console.log(seminarid);
  console.log(userid);
  var item;
  db.collection('registers').findOne({
  $and:
  [{
    _id : userid
   },{
    seminarID : seminarid
  }]}, function(err, user) {
    if (err) throw err;
    if (!user) {
      console.log('User could not be found, going back to main menu')
      res.redirect('/')
    }
    item = user;
    res.render('userLinkManagement', {item: item})
    }
  )}
)
app.get('/')

app.post('/register/:id/registerHandle', function(req, res){
  var o_id = new objectID(req.params.id);
  if (req.body.userType == 'uts') {
    res.render('register', {isStudent: true, seminarId : o_id})
  }
  else {
    res.render('register', {isVisitor: true, seminarId : o_id})

  }
})

app.get('/addUser', isLoggedIn, isAdmin, function(req, res){
  var array = [];
  var cursor = db.collection('seminars').find();
  cursor.forEach(function(doc,err) {
    if (err) return console.log(err)
    array.push(doc)
  }, function(){
        res.render('addUser', {title: 'Add User', items: array});
      });
});

app.post('/addUser', function(req, res){

  var item = {
    username: req.body.username,
    password: req.body.password,
    accountType: req.body.accountType
  }

  db.collection('users').insertOne(item, function(err) {
    if (err) return console.log(err)
  });
  console.log('user added');
  res.redirect('/addUser');
})

/* ---- VIEW SEMINARS ---- */
app.get('/seminars', function(req,res) {
  var array = [];
  var cursor = db.collection('seminars').find();
  cursor.forEach(function(doc,err) {
    if (err) return console.log(err)
    array.push(doc)
  }, function(){
        res.render('seminars', {title: 'Seminars', items: array});
      });
});




app.post('/seminars', function(req,res) {

  var button = Object.keys(req.body);
  var id = req.body[button[0]];
  console.log(id);

  if (button == "register") {
    console.log("found register!");
    var url = '/register/' + id;
    res.redirect(url);
  }
  else {
    console.log("found info!");
    var url = '/seminars/' + id;
    console.log(url);
    res.redirect(url);
  }
});

/*Searches for the seminar via seminar ID */
app.get('/seminars/:id', function(req,res) {
  console.log("made it to seminars/id")
  var o_id = new objectID(req.params.id);

  var doc;
  db.collection('seminars').findOne( {_id: o_id}, function(err, seminar) {
    if (err) throw console.log(err);
    if (seminar) {
      doc = seminar;
      console.log("redirecting to seminar");
      res.render('seminar', {Title: 'Seminar', items: doc});
    }
    })

});

app.get('/new_seminar', isLoggedIn, function(req,res) {
  res.render('new_seminar');
});

app.post('/new_seminar', isLoggedIn, function(req,res) {
    db.collection('seminars').countDocuments({},{},function(err, result) {
    if (err) return console.log(err);

    var item = {

      title: req.body.title,
      speaker: req.body.speaker,
      speaker_id: req.body.speaker_id,
      date: req.body.date,
      time: req.body.time,
      location: req.body.location,
      attendee_count: null,
      attendees: null
    }

    db.collection('seminars').insertOne(item, function(err) {
      if (err) {
        return console.log(err)
      }
    })
    res.redirect('/seminars');
  });
});

app.get('/management', isLoggedIn, function(req,res) {
  var isAdmin;
  var isOrganiser
  if (req.user.accountType == "admin") {
    console.log("is an admin")
    isAdmin = true;
  }
  res.render('management', { accountType: req.user.accountType, username: req.user.username, isAdmin: isAdmin});
})

app.get('/management/:seminarid/speakers', isLoggedIn, function (req,res) {
  res.render('speakers')
})

app.get("/logout", isLoggedIn, function(req, res){
     req.logout();
     res.redirect('/');
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.user.accountType == 'admin') {
    return next();
  }
  else {
    return done();
  }
}

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
