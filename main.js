/* Main backed module.
 * Can be launched as standalone process with 'node main.js',
 * Or as forked subprocess (for tester usage).
 * In forked mode, IPC used to start/stop the server application.
 */

var express = require('mini-express-alexei');
var data = require('./data');
var path = require('path');

var STATIC_DIR = path.resolve('www');
var HOME_PAGE = path.resolve('www', 'index.html');
var server;
var port = process.env.PORT || 8080;
var serverRuns = false;

function notifyParent(msg) {
    if (process.send) { //forked mode
        process.send(msg);
        return;
    }
    if (msg === 'stopped') {
        //for console mode, 'stopped' message should terminate the process
        process.exit(0);
    }
}

function run() {
    if (serverRuns) { //already running
        notifyParent('started');
        return;
    }
    serverRuns = true;
    data.init(); //reset all storage data
    var app = express();

    //static request for the bootstrap resource: www/index.html
    app.get('/', function (req, res, next) {
        if (req.path !== '/' && req.path !== '/index.html') {
            next();
        } else {
            res.sendfile(HOME_PAGE, {url: req.path});
        }
    }).use('/', express.json())
    .post('/login', data.login)
    .post('/register', data.register)
    .use('/item', express.cookieParser()) //detecting session key
    .use('/item', data.findUserData) //getting instance of UserData for the login
    .get('/item', data.getItems)
    .post('/item', data.addItem)
    .put('/item', data.updateItem)
    .delete('/item', data.deleteItem)
    .use('/', express.static(STATIC_DIR)); //default NOT FOUND response

    server = app.listen(port, function () {
        notifyParent('started'); //sending message to the parent when started
    });
}

function close() {
    if (server) {
        server.close(function () {
            serverRuns = false; //now can restart the server (from parent process)
            server = undefined;
            notifyParent('stopped');
        });
    } else {
        notifyParent('stopped');
    }
}

//listening for process messages
process.on('message', function (msg) {
    //if launched as child process, then server state controlled with messages
    switch (msg) {
        case 'start':
            run();
            break;
        case 'stop':
            close();
            break;
        case 'exit':
            process.exit(0);
            break;
    }
});
//closing the server on [ctrl + C] (for console mode)
process.once('SIGINT', close);

if (!process.send) {
    //if launched directly from node console, then the server runs immediately
    run();
}