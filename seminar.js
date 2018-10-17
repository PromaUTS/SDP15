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
    res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
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

app.get('/logout', isLoggedIn, function(req, res){
  console.log("made it to logout");
  req.logout();
  res.redirect('/');
});

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
  var o_id = req.params.id;
  var url = '/register/' + o_id;
  db.collection('students').findOne({studentId: req.body.studentId} , function(err, user) {
    if (err) {
      throw console.log(err);
    }
    if (!user) {
      console.log("student not found");
      req.flash("error_msg", "Student ID not found");
      var url = "/register/" + o_id;
      return res.redirect(url);
    }
    if (user) {
      if (user.password == req.body.password) {
        console.log("password matches!");
        res.render('register', {isConfirmed : true, isStudent: false, seminarId: o_id })
          }
        }

      else {
        req.flash("error_msg", "Incorrect password");
        console.log("incorrect password");
        res.redirect(url);
      }
    })
  });

app.get('/register/:id/complete', function(req,res) {
  res.render('complete');
})

app.post('/register/:id/complete', function(req,res) {
  var o_id = req.params.id; // USER ID
  var obj_id = new objectID(req.params.id); // SEMINAR ID
  var item = [];
  var url = '/register/' + o_id + '/complete';
  item = {
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    seminars: o_id.toString()
  }
  db.collection('registers').insertOne(item, function(err) {
    if (err) throw console.log(err);
  db.collection('registers').findOne({email: req.body.email} , function(err, user) {
    if (err) {throw console.log(err)}
    db.collection('seminars').findOne({_id:obj_id}, function(err,seminar) {
      if (err) { throw console.log(err)}
      if (!seminar) {
        req.flash("error_msg", "Seminar could not be found");
        throw console.log("seminar could not be found")
      }
      console.log("neil look it made it ")
      var count = seminar.attendee_count + 1;
      var userSemArr = [user.seminars.slice()]; /*userSemArr appends the seminar ID to be added onto the register's seminars field*/
      userSemArr.push(req.body.seminar);
      var semArr = [seminar.attendees.slice()]; /*semArr appends the register ID to be added onto the seminar's registers field*/
      semArr.push(user._id);
      var index = userSemArr.indexOf(obj_id);
      console.log("o_id:",o_id)
      db.collection('registers').updateOne( {email: req.body.email}, {$set: {seminars: userSemArr}})
      db.collection('seminars').updateOne( {_id: obj_id}, {$set: {attendees: semArr, attendee_count: count}}, function(err,done) {
        if (done) {
          console.log(semArr)
          console.log("seminar was updated")
          req.flash("success_msg", "Seminar was updated");
        }
      db.collection('registers').findOne( {seminars: o_id}, function(err,found) {
      if (err) throw console.log(err)
      if (found)
      {
        var userID = user._id;
        var seminarID = seminar._id;
        var url = "http://localhost:3000/seminar/manage/" + userID +"?seminarid="+seminarID
        console.log("hello");
        res.render('complete', {seminarId: seminarID, userId: userID, url : url});
      }

      else {
        throw console.log('comparison failed')
      }
    })
    })
  })

  })
  })
})

app.post('/editSelf', function(req,res) {
  var button = Object.keys(req.body);
  var id = req.body[button[0]];
  var u_id = new objectID(id);

  if (button == 'edit') {
    res.render('userLinkManagement', {isEdit: true})
  }

  if( button == 'remove') {
    db.collection('seminars').findOne({attendees: u_id}, function(err, seminar) {
      if (seminar) {
        var count = seminar.attendee_count - 1;
        var semArr = [seminar.attendees.slice()];
        var indexOfID = semArr.indexOf(u_id);
        semArr.splice(indexOfID,1);
        db.collection('seminars').updateOne({_id: seminar._id}, {$set: {attendees:semArr, attendee_count: count}})
    }
    db.collection('registers').deleteOne({_id: u_id}, function(err, deleted) {
      if (err) throw console.log(err);
      if (deleted) {
        console.log("USER has been removed")
        req.flash("success_msg", "User has been removed");
        res.redirect('/seminars');
      }
    } )
  })
  }
})

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
    seminars : seminarid
  }]}, function(err, user) {
    if (err) throw console.log(err);
    if (!user) {
      console.log('User could not be found, going back to main menu')
      console.log(userid)
      console.log(seminarid)
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



app.post('/addUser', function(req, res) {
  var item = [];
  var count = 0;
  var o_id = new objectID(req.body.seminar)
  if (req.body.role == 'user') {
    /*check if user already exists*/
    db.collection('registers').findOne( {email: req.body.email}, function(err, user) {
      if (err) {
        throw console.log(err)
      }
      if (user) {
        db.collection('seminars').findOne({_id: o_id}, function( err, seminar) {
        if (err) throw console.log(err);
        if (user._id == seminar.attendees) {
          console.log("user is already registered, returning to admin menu")
          req.flash("error_msg", "User is already registered");
          res.redirect('/management')
        }
        count = seminar.attendee_count + 1;
        var userSemArr = [user.seminars.slice()]; /*userSemArr appends the seminar ID to be added onto the register's seminars field*/
        userSemArr.push(req.body.seminar);
        var semArr = [seminar.attendees.slice()]; /*semArr appends the register ID to be added onto the seminar's registers field*/
        semArr.push(user._id);
        db.collection('registers').updateOne( {email: req.body.email}, {$set: {seminars: userSemArr}})
        db.collection('seminars').updateOne( {_id: o_id}, {$set: {attendees: semArr, attendee_count: count}})
        console.log("existing user updated")
        req.flash("success_msg", "User has been updated");
        res.redirect('/management');
      })
    }
    if (!user) {
    console.log("not a user");
    item = {
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      seminars:req.body.seminar,
      isUTS: false
    }
    db.collection('seminars').findOne({_id: o_id}, function( err, seminar) {
      if (err) throw console.log(err)
      if (!seminar) {
        req.flash("error_msg", "Couldn't find seminar with that ID");
        console.log("couldnt find the seminar")
      }
      if (seminar) {
      db.collection('registers').insertOne(item, function(err, insertedId) {
        if (err) throw console.log(err);
        console.log("new user added")
        count = seminar.attendee_count + 1;
        var semArr = [seminar.attendees.slice()]; /*semArr appends the register ID to be added onto the seminar's registers field*/
        semArr.push(insertedId["ops"][0]["_id"]);
        db.collection('seminars').updateOne( {_id: o_id}, {$set: {attendees: semArr, attendee_count: count}})
        req.flash("success_msg", "User has been added to the seminar");
        res.redirect('/management');

      })
    }
    })

    }

  })
  }
  if (req.body.role == 'organiser') {
    db.collection('users').findOne({email: req.body.email}, function(err, user) {
      if (err) throw console.log(err)
      if (!user) {
        item = {
          username: req.body.username,
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          email: req.body.email,
          password: req.body.password,
          accountType: 'organiser'
        }
        db.collection('users').insertOne(item, function(err) {
          if (err) throw console.log(err)
          res.redirect('/management');
        })
      }
      if (user) {
        db.collection('users').findOne({username: req.body.username}, function(err,usernameMatch) {
        if (usernameMatch) {
          req.flash("error_msg", "Username is already taken");
          console.log("Error - username is in use - try again");
        }
        else {
          req.flash("error_msg", "Email is already taken");
        console.log("Error - email already in use - try again");
        }
        res.redirect('/management')
        })
      }

    })
  }
  if (req.body.role == 'admin') {
    db.collection('users').findOne({email: req.body.email}, function(err, user) {
      if (err) throw console.log(err)
      if (!user) {
        item = {
          username: req.body.username,
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          password: req.body.password,
          accountType: 'organiser'
        }
        db.collection('users').insertOne(item, function(err) {
          if (err) throw console.log(err)
          res.redirect('/management');
        })
      }
      if (user) {
        db.collection('users').findOne({username: req.body.username}, function(err,usernameMatch) {
        if (usernameMatch) {
          req.flash("error_msg", "Username is already taken");
          console.log("Error - username is in use - try again");
        }
        else {
          req.flash("error_msg", "Email is already taken");
        console.log("Error - email already in use - try again");
        }
        res.redirect('/management')
        })
      }
    })

  }
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
      res.render('seminar', {Title: 'Seminar', items: doc, isAdmin: false});
    }
    })

});
/*  SPEAKER ADD/DELETE CODE
Speaker/s<select>
            <option value=""disabled selected>Speaker/s</option>
            {{#each tempSeminar}}
              <option value"{{_id}}">{{firstname}}</option>
            {{/each}}
          </select>
          <button name = "addSpeaker">ADD</button>
          <button name = "removeSpeaker">REMOVE</button>
*/
app.post('/addSeminar', isLoggedIn, function(req,res) {
    var item = {

      title: req.body.title,
      speaker: "",
      speaker_id: "",
      date: req.body.date,
      time: req.body.time,
      location: req.body.location,
      description: req.body.description,
      attendee_count: 0,
      attendees: []
    }
    console.log("read though form")
    db.collection('seminars').insertOne(item, function(err) {
      if (err) {
        return console.log(err)
      }
    res.redirect('/management');
    })
});

app.post('/organiserManagement', isLoggedIn, isOrganiser, function(req,res) {

  var url;
  var button = Object.keys(req.body);
  var otherID = req.body[button[0]];
  console.log("other ID",otherID);
  var seminarID = req.body[button[0]].toString();
  var o_id = new objectID(seminarID);
  var attendeeArr = [];
  console.log(button);
  console.log(seminarID);
  if (button == 'viewEdit') {
    db.collection('seminars').findOne( {_id: o_id}, function(err, seminar) {

      if (err) throw console.log(err);
      if (seminar) {
        var doc = seminar;
      }
      res.render('seminar', {seminar: doc, isOrganiser: true})
    })
  }
  if (button == 'cancel') {
    db.collection('seminars').deleteOne( {_id: o_id}, function(err, found) {
      if (err) throw console.log(err)
      if (!found) {console.log("cancel was not successful"); req.flash("error_msg", "Could not cancel Seminar");}
      res.redirect("/management");
    })
  }
  if (button == 'attendees') {
    console.log(seminarID);
    var cursor = db.collection('registers').find({seminars: seminarID});
    cursor.forEach(function(doc,err) {
      if (err) return console.log(err)
      attendeeArr.push(doc)
      console.log("attendeearray:",attendeeArr)
    }, function() {
      db.collection('seminars').findOne({_id: o_id}, function(err,found) {
      if (err) throw console.log(err)
      if (found)
      console.log('found seminar!');
      res.render('attendees', {isOrganiser: true, array: attendeeArr, seminarID: seminarID});
    })
    })
    }

  })

app.post('/editSeminar', isLoggedIn, isOrganiser, function(req,res) {
  var button = Object.keys(req.body);
  var seminarID = req.body[button[0]];
  var o_id = req.body[button[0]];
  db.collection()
  res.render('seminar',{isEditing: true })
})

/*app.post('/confirmEdit', isLoggedIn, isOrganiser, function (req,res) {
  var button = Object.keys(req.body);
  var seminarID = req.body[button[0]];
  var o_id = new objectID(seminarID);

  db.collection('seminars').updateOne({_id:o_id}, {$set: {: regArr}}); {

    if (!seminar) {
      console.log("seminar not found");
    }
    if (seminar) {
      db.collection('seminar')
    }
  })
})*/

app.post('/removeUser', isLoggedIn, isOrganiser, function(req,res) {
  var button = Object.keys(req.body);
  var seminarID = req.body[button[0]].toString();
  console.log("userID:",button);
  var id = new objectID(seminarID);
  console.log("semmID:",id);
  var newuser = button.toString();
  var u_id = new objectID(newuser);
  console.log("userID:",u_id);
  var semArr = [];
  var regArr = [];
  db.collection('seminars').findOne( {_id : id}, function(err, seminar) {
    if (err) throw console.log(err)
    if (seminar) {
      console.log("MADEEE ITT")
    var count = seminar.attendee_count - 1;
    semArr = [seminar.attendees.slice()];
    var indexOfID = semArr.indexOf(u_id);
    semArr.splice(indexOfID,1);
    db.collection('registers').findOne({_id: u_id}, function(err,user) {
      if (err) throw console.log(err)
      if (user) {
      regArr = [user.seminars.slice()];
      var indexOfID2 = regArr.indexOf(id);
      regArr.splice(indexOfID2,1);

      db.collection('registers').updateOne( {_id: u_id}, {$set: {seminars: regArr}});
      db.collection('seminars').updateOne( {_id: id}, {$set: {attendees: semArr, attendee_count: count}});
      console.log(id);
      var cursor = db.collection('registers').find({seminars: u_id});
      cursor.forEach(function(doc,err) {
        if (err) return console.log(err)
        attendeeArr.push(doc)
      }, function() {
        res.render('attendees', {isOrganiser: true, array: attendeeArr, seminarID: id});
      })
    }
    if (!user) {
      req.flash("error_msg", "User not found");
      console.log("user not found")
    }
    })
  }
  if (!seminar) {
    req.flash("error_msg", "Seminar not found");
  console.log('seminar not found')
  }
  })
})


app.get('/management', isLoggedIn, function(req,res) {
  var isAdmin;
  var isOrganiser;
  if (req.user.accountType == "admin") {
    console.log("is an admin")
    isAdmin = true;
  }
  if (req.user.accountType == "organiser") {
      console.log("is an organiser")
      isOrganiser= true;
  }


  var array = [];
  var cursor = db.collection('seminars').find();
  cursor.forEach(function(doc,err) {
    if (err) return console.log(err)
    console.log('made it here :o')
    array.push(doc)
    }, function() {
    res.render('management', { accountType: req.user.accountType,
      username: req.user.username, seminars: array, isAdmin: isAdmin,
      isOrganiser: isOrganiser});
  })
})


app.get('/management/:seminarid/speakers', isLoggedIn, function (req,res) {
  res.render('speakers')
})


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('error', 'you are not logged in');
    res.redirect('/login');
  }
}

function isAdmin(req, res, next) {
  if (req.user.accountType == 'admin') {
    return next();
  }
  else {
    return done();
  }
}

function isOrganiser(req, res, next) {
  if (req.user.accountType == 'organiser') {
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
