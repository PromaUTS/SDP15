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
const fs = require('fs');
const PDFDocument = require('pdfkit');
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

/*CHECKS WHETHER USER IS ALREADY REGISTERED FOR THIS SEMINAR*/
app.post('/register/:id/checkStatus', function(req,res) {
  var o_id = req.params.id;
  db.collection('registers').findOne({
    $and:
    [{
      firstname : req.body.firstname
     },{
      lastname : req.body.lastname
    },{
      email : req.body.email
    }, {
      seminars : o_id
    }
  ]}, function(err, found) {
    if (err) throw console.log(err);
    if (found) {

      console.log('You\'ve already registered/shown interest for this seminar');
      req.flash("error_msg", "You've already registered or shown interest! Sending you back to the home page!");
      res.redirect('/seminars');
    }
    if (!found) {
      res.render('register', {notRegistered: true, seminarId: o_id})
    }
    }
  )
})


app.post('/register/:id/utsLogin', function(req, res) {
  var o_id = req.params.id;
  var url = '/register/' + o_id;
  db.collection('students').findOne({studentID: req.body.studentID} , function(err, user) {
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
  var attendeeObj;
  var o_id = req.params.id; // USER ID
  var obj_id = new objectID(req.params.id); // SEMINAR ID
  var item = [];
  var url = '/register/' + o_id + '/complete';
  var seminarObj = [{seminarID: o_id, status: req.body.signType}];

  var attendeeCount;

  item = {
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    seminars: seminarObj
  }

  db.collection('registers').findOne({email: req.body.email} , function(err, user) {
    if (err) {throw console.log(err)}
    if (!user) {
      db.collection('registers').insertOne(item, function(err) {
        if (err) throw console.log(err);
      })
    }
    if (user) {
      var currentUserArr = [user.seminars.slice()];
      currentUserArr.push(seminarObj);
      db.collection('registers').updateOne({_id:user._id}, {$set:{seminars:currentUserArr}}, function(err,success){
        if (err) throw console.log(err)
        if (success) {
          console.log("user's seminar array was successfully updated");
        }
      })
    }
    })
    db.collection('seminars').findOne({_id: obj_id}, function(err,seminar) {
      if (err) throw console.log(err)

      if (seminar) {
        console.log('found seminar');
      db.collection('registers').findOne({email: req.body.email}, function(err, user) {
        if (err) throw console.log(err);
        if (user) {
        var attendeeObj = [{attendeeID: user._id.toString(), status: req.body.signType}];
        var currentSemArr = [seminar.attendees.slice()];
        attendeeCount = seminar.attendee_count + 1;
        currentSemArr.push(attendeeObj);
        db.collection('seminars').updateOne({_id: obj_id}, {$set:{attendees:currentSemArr, attendee_count: attendeeCount}}, function(err,success){
          if (err) throw console.log(err)
          if (success) {
            console.log("Seminar array was successfully updated");
            db.collection('registers').findOne( {seminars: {$elemMatch: {seminarID:o_id}}}, function(err,found) {
              if (err) throw console.log(err)
              if (found)
              {
                var userID = user._id;
                var seminarID = seminar._id;
                var url = "http://localhost:3000/seminar/manage/" + userID +"?seminarid="+seminarID
                res.render('complete', {seminarId: seminarID, userId: userID, url : url});
              }
          })
        }
      })
      }
    })
  }
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
  var type;
  var array = [];
  var suserid = req.params.userid;
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
    seminars : {$elemMatch: {seminarID:seminarid}}
  }]}, function(err, user) {
    if (err) throw console.log(err);
    if (!user) {
      console.log('User could not be found, going back to main menu')
      console.log(userid)
      console.log(seminarid)
      res.redirect('/')
    }
    var cursor = db.collection('seminars').find({attendees: {$elemMatch: {attendeeID: suserid}}});
    cursor.forEach(function(doc,err) {
      console.log(doc);
      if (err) throw console.log(err)
      array.push(doc);
      type = doc.attendees[0].status;
    }, function() {
      item = user;
      res.render('userLinkManagement', {item: item, seminars:array, type:type})
    })
    }
  )}
)

/*app.post('/changeStatus', function(req,res) {
  var id = req.body.submit;
  var s_id = new objectID(id); // seminarID with type objectID
  var option = req.body.selection;
  var seminarsObjArr = [{}]
  db.collection
  db.collection('registers').findOneAndUpdate(
    {seminars: {$elemMatch: {seminarID:id, }
    if (err) throw console.log(err);
    if (success) {
      console.log("SUCCESS!!")
      res.redirect("/seminars");
    }
  }})
})*/


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

function getSeminarList(query, callback) {
  var array = [];
  console.log("query:",query);
  console.log("field",field)
  var cursor = db.collection('seminars').find(query);
  cursor.forEach(function(doc,err) {
    if (err) return console.log(err)
    console.log("doc:",doc)
    array.push(doc)
  },
  function(){
    console.log("completed getSeminarList function")
    callback(null,array);
  })
}


/* ---- VIEW SEMINARS ---- */
app.get('/seminars', function(req,res) {
  var array = [];
  var cursor = db.collection('seminars').find();
  cursor.forEach(function(doc,err) {
    if (err) return console.log(err)
    array.push(doc)
  }, function(){
        res.render('seminars', {title: 'Seminars', items: array, isSearched: false});
      });
});

app.post('/reset', function (req,res) {
  console.log("resetting");
  res.redirect('/seminars')
})

app.post('/searchSeminar', function(req,res) {
  var array;
  var choice = req.body.selection;
  var query = {};
  console.log("made it to search seminar")
  console.log(choice);

  if (choice == 'organiser') {
    field = 'organiser';
    query[field] = req.body.input;
    getSeminarList(query, function(err, array) {
      if (err) throw console.log(err);
      if (array) {
      console.log("obtained array");
      res.render('seminars', {items: array, isSearched: true})
    }
    });
  }

  if (choice == 'room') {
    field = 'location';
    query[field] = req.body.input;
    getSeminarList(query, function(err, array) {
      if (err) throw console.log(err);
      if (array) {
      console.log("obtained array");
      res.render('seminars', {items: array, isSearched: true})
    }
    });
  }

  if (choice =='date') {
    field ='date';
    var inputDate = new Date(req.body.input);
    var month = inputDate.getMonth() + 1 ;
    var day = inputDate.getDay() - 1;
    if (day == 0) {
      query[field] = "$gte"
    }
    query[field] = req.body.input;

    getSeminarList(query, function(err, array) {
      if (err) throw console.log(err);
      if (array) {
      console.log("obtained array");
      res.render('seminars', {items: array, isSearched: true})
    }
    });
  }
  if (choice =='speaker') {
    field = 'speaker';
    query[field] = req.body.input;
    getSeminarList(query, function(err, array) {
      if (err) throw console.log(err);
      if (array) {
      console.log("obtained array");
      res.render('seminars', {items: array, isSearched: true})
    }
    });
  }

})



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
      organiser: req.user.firstname +" "+req.user.lastname,
      speaker: req.body.speaker,
      speaker_bio: req.body.bio,
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
      res.render('seminar', {items: doc, isOrganiser: true})
    })
  }
  if (button == 'cancel') {
    db.collection('seminars').deleteOne( {_id: o_id}, function(err, found) {
      if (err) throw console.log(err)
      if (!found) {
        console.log("cancel was not successful"); req.flash("error_msg", "Could not cancel Seminar");
      }
      var cursor = db.collection('registers').find( {seminars: {$elemMatch: {seminarID: seminarID }}});
      cursor.forEach(function(user,err) {
        if (err) throw console.log(err);
        var index = user.seminars.indexOf(seminarID);
        var seminarArr = user.seminars;
        seminarArr.splice(index,1);
        db.collection('registers').updateOne({_id: user._id}, {$set: {seminars: seminarArr}})
      }, function() {
        res.redirect("/management");
      });
      })
    }

  if (button == 'attendees') {
    console.log(seminarID);
    var cursor = db.collection('registers').find({seminars: seminarID});
    cursor.forEach(function(doc,err) {
      if (err) throw console.log(err)
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

  if (button == 'print') {
    var x = 100;
    var y = 50;
    var counter = 0;
    var pdfDoc = new PDFDocument;
    pdfDoc.fontSize(20);
    pdfDoc.pipe(fs.createWriteStream('nametags.pdf'));
    var cursor = db.collection('registers').find({seminars: seminarID});
    cursor.forEach(function(doc,err) {
      if (err) throw console.log(err)
      counter++;
      if (counter == 1)
      {
        pdfDoc.text(doc.firstname + " "+doc.lastname, x, y);
        x += 300;
      }
      if (counter == 2)
      {
        pdfDoc.text(doc.firstname + " "+doc.lastname, x, y);
        x = 100;
        y += 100;
        counter = 0;
      }
    }, function() {
      /*pdfDoc.text("bob saget", leftx, lefty) /*{
        width: 200, height: 100, align:'center'});*/
      /*pdfDoc.moveDown();
      pdfDoc.text("bob saget", 100, 200){width: 200, align:'center'});*/
      pdfDoc.end();
      res.redirect('/management');
    })
  }
  })


app.post('/editSeminar', isLoggedIn, isOrganiser, function(req,res) {
  var button = Object.keys(req.body);
  var seminarID = req.body[button[0]];
  var o_id = new objectID(seminarID);
  console.log(o_id);
  var doc;
  db.collection('seminars').findOne({_id: o_id}, function(err, found) {
    if (err) throw console.log(err)
    if (found) {
      console.log("seminar was found")
      doc = found;
      res.render('seminar',{isEditing: true, items: doc });
    }
    else {
      console.log('seminar couldnt be found');
      res.redirect('/management');
    }
  })
})

app.post('/confirmEdit', isLoggedIn, isOrganiser, function (req,res) {
  var button = Object.keys(req.body);
  var seminarID = req.body.submit;
  var o_id = new objectID(seminarID)
  console.log("seminarID:", seminarID);
  console.log("button value",req.body.submit);

  /*var o_id = new objectID(seminarID);*/

  db.collection('seminars').updateOne({_id:o_id},
    {
      $set: {
        title: req.body.title,
        date: req.body.date,
        time: req.body.time,
        location: req.body.location,
        description: req.body.description,
        speaker: req.body.speaker,
        speaker_bio: req.body.bio,
        organiser: req.body.organiser
      }
    }, function(err, success) {
      if (err) throw console.log(err);
      if (success) {
        console.log("SEMINAR WAS UPDATED!!!")
      }
      res.redirect('/management');
    });
  })

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
  var today = new Date();
  var day = today.getDate();
  var month = today.getMonth()+1;
  var year = today.getFullYear();
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
      isOrganiser: isOrganiser, day: day, month: month, year: year});
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
