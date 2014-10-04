var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var debug = require('debug')('enCal-server');
var fs = require('fs');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

var java = require("java");
//java.classpath.push("commons-lang3-3.1.jar");
//java.classpath.push("commons-io.jar");
var corenlp_path = path.join(__dirname, "../stanford-corenlp-full-2014-08-27");
var list = fs.readdirSync(corenlp_path);
list.forEach(function(file) {
    if (file.substring(file.length-4) == ".jar") {
        java.classpath.push(path.join(corenlp_path, file));
    }
});
java.classpath.push(path.join(__dirname, "../NLPImpl/stanford-corenlp-3.4.jar"));
java.classpath.push(path.join(__dirname, "../out/production/NLPImpl"));
//var MessageParser = java.import('MessageParser');

function getEventsInMessage(body, subject, timestamp, callback) {
    java.callStaticMethod("MessageParser", "getEventsInMessage", body, subject, timestamp, callback);
}


var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
    var body = "Hey Rocky!  Love learning about politics? Enjoy trivia games? Are you super competitive? Do you just like having fun and eating food?  Come on out to the  Political Trivia Study Break  Join The American Whig-Cliosophic Society for this year's first study break on Thursday at 7:30pm in the Whig Senate Chamber! Come settle the age-old question! Who's smarter: Whig or Clio? The winning side will receive a prize!  Pizza and other foods will be served as well!";
    var subject = "Engr Club Meetings in Huang 23";
    var timestamp = "faketimestamp";
    getEventsInMessage(body, subject, timestamp, function(err, result) {
        res.json(result.toArraySync());
    });
});

app.use('/', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: err
    });
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
    debug('Express server listening on port ' + server.address().port);
});
