var debug = require('debug')('html2pdf:server');
var _ = require('underscore');
var compress = require('compression');
var express = require('express');
var path = require('path');
var ejs = require('ejs');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var async = require('async');
var entityDB;
var snapshotBatch;

var app = express();
app.use(compress());

// views engine setup
app.set('views', path.join(__dirname, 'app/views'));
app.engine('.html',ejs.__express);
app.set('view engine', 'html');

// uncomment after placing your favicon in /public
app.use(express.static(path.join(__dirname, 'app')));
app.use(favicon(__dirname + '/favicon.ico'));

//app.get('env') return the environment variable NODE_ENV, same as process.env.NODE_ENV
if (app.get('env') === 'development') {
    app.use(logger('dev'));
}else{
    app.use(logger());
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


async.series([
    function(callback){ //Initialize Snapshot Batch Job System
        entityDB = require('./server/models/connections/conn_mysql_mdb.js');
        snapshotBatch = require('./server/models/server_snapshot_batch.js');
        snapshotBatch.kickStartBatchJob();
        snapshotBatch.kickEmailSendingJob();
        snapshotBatch.schedulePageEvaluateJob(false);
        callback(null, 0);
    },
    function(callback){ //Initialize Routes
        var routes = require('./server/server_routes');
        app.use('/', routes);

        // catch 404 and forward to error handler
        app.use(function(req, res, next) {
            var err = new Error('Not Found');
            err.status = 404;
            next(err);
        });

        // error handlers
        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use(function(err, req, res) {
                res.status(err.status || 500);
                res.render('server_error', {
                    message: err.message,
                    error: err
                });
            });
        }

        // production error handler
        // no stack traces leaked to user
        app.use(function(err, req, res) {
            res.status(err.status || 500);
            res.render('server_error', {
                message: err.message,
                error: err
            });
        });

        callback(null, 0);
    },
    function(callback){
        app.set('port', process.env.PORT || 3000);

        process.on('SIGINT',function(){
            console.log("Closing Html2pdf....");
            entityDB.closeMDB();
            process.exit()
        });

        var server = app.listen(app.get('port'), function() {
            debug('Express server listening on port ' + server.address().port);
        });
        callback(null, 0);
    }
]);

