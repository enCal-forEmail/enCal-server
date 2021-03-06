var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var debug = require('debug')('enCal-server');
var fs = require('fs');
var multer  = require('multer');
var async = require('async');

var google = require('googleapis');
var calendar = google.calendar('v3');
var OAuth2 = google.auth.OAuth2;

var Firebase = require('firebase');
var firebase = new Firebase('https://brilliant-fire-8245.firebaseio.com/');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ dest: path.join(__dirname, 'uploads')}));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

var java = require("java");
java.classpath.push(process.env.NLPImpl);

function getEventsInMessage(body, subject, timestamp, callback) {
    var location = java.callStaticMethodSync("MessageParser", "getLocation", body, subject);

    java.callStaticMethod("MessageParser", "getEventsInMessage", body, subject, timestamp, function(err, events) {
        if (events == null) {
            callback(null, []);
        } else {
            events.toArray(function(err, eventsArray) {
                async.map(eventsArray, function(event, cb) {
                    var newEvent = {};
                    async.parallel([
                        function(cb) {
                            event.start.toString(cb);
                        },
                        function(cb) {
                            event.end.toString(cb);
                        }
                    ], function(err, results) {
                        newEvent.start = {
                            dateTime: results[0]
                        };
                        newEvent.end = {
                            dateTime: results[1]
                        };
                        newEvent.summary = subject;
                        newEvent.location = location;
                        cb(err, newEvent);
                    });
                }, callback);
            });
        }
    });
}


var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
    var body = "Hey Rocky!  Love learning about politics? Enjoy trivia games? Are you super competitive? Do you just like having fun and eating food?  Come on out to the  Political Trivia Study Break  Join The American Whig-Cliosophic Society for this year's first study break on Thursday at 7:30pm in the Whig Senate Chamber! Come settle the age-old question! Who's smarter: Whig or Clio? The winning side will receive a prize!  Pizza and other foods will be served as well!";
    var subject = "Engr Club Meetings in Huang 23";
    var timestamp = "faketimestamp";
    getEventsInMessage(body, subject, timestamp, function(err, result) {
        result.toArraySync().forEach(function(date) {
            res.write(date.toStringSync());
        });
        res.end();
    });
});


var User = require('./user');
router.post('/login', function(req, res) {
    User.updateOrCreate(req.body.email,  req.body.accessToken, function(err, user) {
        if (err) {
            res.send(err);
        } else {
            res.end();
        }
    })
});

var tesseract = require('node-tesseract');
router.get('/ocr', function(req, res) {
    tesseract.process(path.join(__dirname, 'image.jpg'), function(err, text) {
        if(err) {
            console.error(err);
            res.send(err);
        } else {
//            res.send(text);
            getEventsInMessage(text, '', '', function(err, result) {
                res.send(result.toArraySync());
            });
        }
    });
});

router.post('/sendgrid', function(req, res) {
    console.log(req.body);

    var email = JSON.parse(req.body.envelope).from.replace(/\+[^@]*/, '');
//    var email = req.body.from.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}/);

    User.findOne({email: email}, function(err, user) {
        if (err) {
            console.log("/sendgrid", err);
        } else if (user != null) {
            // Extract events
            getEventsInMessage(req.body.text, req.body.subject, new Date(), function(err, events) {
                if (events.length == 0 && req.body.attachments != 0) {
                    var file = req.files.attachment1.path;
                    res.status(200);
                    res.end();
                    tesseract.process(file, function(err, text) {
                        if (err) {
                            console.log("Tesseract error:", err);
                        } else {
                            console.log("Tesseract result:", text);
                            getEventsInMessage(text, req.body.subject, new Date(), function (err, events) {
                                processEvents(user, events);
                            });
                        }
                    });
                } else {
                    processEvents(user, events);
                    res.status(200);
                    res.end();
                }
            });
        } else {
            console.log("User not found:", email);
        }
    });
});

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function processEvents(user, events) {
    console.log("events", events);
    if (events.length == 0) return;

    var item = {
        "Title": events[0].summary,
        "Time Ranges":[],
        "Location" : events[0].location
    };
    events.forEach(function(event) {
        var start = new Date(event.start.dateTime);
        var end = new Date(event.end.dateTime);
        item["Time Ranges"].push({
            start: start.getHours() + ":" + start.getMinutes(),
            startDate: months[start.getMonth()] + " " + start.getDate(),
            end: end.getHours() + ":" + end.getMinutes(),
            endDate: months[end.getMonth()] + " " + end.getDate()
        })
    });
    var itemRef = firebase.child('users').child(user.email.replace(/\./g, ",")).push(item);

    if (events.length == 1) {
        addToCalendar(user.accessToken, events[0], function (err, response) {
            console.log(err, response);
        });
    } else {
        itemRef.child("Selected").on("value", function(snapshot) {
            var selected = snapshot.val();
            console.log(selected);
            if (selected != null) {
                snapshot.ref().off("value");
                snapshot.ref().parent().child("Time Ranges").once("value", function(snapshot) {
                    addToCalendar(user.accessToken, snapshot.val()[selected], function(err, response) {
                        console.log(err, response);
                    });
                })
            }
        })
    }
}

function addToCalendar(accessToken, event, callback) {
    // If only one event, add to calendar
    var oauth2Client = new OAuth2("abc", "def", "jhk");
    oauth2Client.setCredentials({
        access_token: accessToken
    });
    calendar.events.insert({
        calendarId: "primary",
        auth: oauth2Client,
        resource: event
    }, callback);
}

app.use('/', router);

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
    debug('Express server listening on port ' + server.address().port);
});
