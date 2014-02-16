/* The data module for the backend.
 * Manages data storage for all registered users.
 * Provides API for registration, login, user data.
 */

var TodoList = require('./www/js/todoList');
var crypto = require('crypto');
var util = require('util');

var SESSION_TIMEOUT = 1800000; //30 minutes
//response status codes for /item responses
var RESPONSE_STATUS = {
    success: 0,
    failure: 1
};

//Global instance of Storage, mapping of UserData objects, mapped by user name.
var storage;
//Global instance of Sessions, mapping from session-key to session object.
var sessions;


module.exports = {
    /**
     * Deletes all stored data, dropping back to the initial state.
     * All active session timers also stopped.
     */
    init: function () {
        storage = new Storage();
        if (sessions) {
            sessions.forEach(function (session) {
                clearTimeout(session.timerID);
            });
        }
        sessions = new Sessions();
    },


    //Middleware for POST /register
    register: function (req, res, next) {
        //getting & verifying registration data
        var reg = {fullname: req.param('fullname')};
        if (!getAuthorisation(req, reg) ||
            typeof(reg.fullname) !== 'string') {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: "Illegal registration form."});
            return;
        }
        if (storage[reg.username]) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                    msg: "Username already in use. Choose another one."});
            return;
        }
        var userData = new UserData(reg);
        storage[reg.username] = userData;
        sessions.newSession(req, res, userData);
    },

    //Middleware for POST /login
    login: function (req, res, next) {
        //getting & verifying request fields
        var auth = {};
        if (!getAuthorisation(req, auth)) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: "Illegal login form."});
            return;
        }
        var errMsg;
        var userData = storage[auth.username];
        if (!userData) {
            errMsg = "Username not exists.";
        } else if (userData.password !== auth.password) {
            errMsg = "Password incorrect.";
        }

        if (errMsg) {
            res.send(500, {status: RESPONSE_STATUS.failure,
                msg: errMsg});
        } else {
            sessions.newSession(req, res, userData);
        }
    },

    /**
     * Finds instance of UserData for current session.
     * If found, the data object will be assigned to req.body.userData.
     * If session unauthorised, or user data not found,
     * then responding with code 400.
     */
    findUserData: function (req, res, next) {
        var userData = UserData.get(req.cookies.key);
        if (!userData) { //error state
            res.send(400, {status: RESPONSE_STATUS.failure,
                msg: 'Not logged in (possibly, your session expired).'});
            return;
        }

        req.body.userData = userData;
        next();
    },

    //Middleware for GET /item
    getItems: function (req, res, next) {
        res.send(req.body.userData.todos.jsonView());
    },

    //Middleware for POST /item
    addItem: function (req, res, next) {
        var id = parseInt(req.param('id'));
        var value = req.param('value');

        var userData = req.body.userData;

        var msg;
        if (isNaN(id) || id < 0) {
           msg = 'Illegal item id';
        } else if (userData.todos.get(id)) {
           msg = 'Item with such id already exists.';
        } else if (typeof(value) !== 'string') {
           msg = 'Illegal item value.';
        }
        if (msg) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: msg});
            return;
        }
        userData.todos.setItem(value, id);

        res.send({status: RESPONSE_STATUS.success});
    },

    /**
     * Middleware for PUT /item
     * Expects req.body to have {id, value, status}.
     * Updates the item on the backend.
     * If id === -1, then all items set to the specified status (value ignored).
     * Otherwise, id expected to be valid id of existing item, which will be updated.
     */
    updateItem: function (req, res, next) {
        var userData = req.body.userData;
        var update = req.body;
        var completed = (update.status === 0) ? false
            : (update.status === 1) ? true
            : undefined;

        //checking required fields
        var errFlag = (completed === undefined
            || typeof(update.id) !== 'number');

        if (update.id === -1 && !errFlag) { //updating completed status to all
            userData.todos.markAll(completed);
            res.send({status: RESPONSE_STATUS.success});
            return;
        }
        //for item update, value required
        errFlag |= typeof(update.value) !== 'string';

        if (errFlag) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: 'Illegal request format.'});
            return;
        }

        var item = {title: update.value, completed: completed};
        if (!userData.todos.replaceTodo(update.id, item)) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: 'Illegal item id'});
            return;
        }

        res.send({status: RESPONSE_STATUS.success});
    },

    /**
     * Middleware for DELETE /item
     * If id==-1: all completed items will be removed.
     * For any id except (-1), item with this id will be removed.
     * If no such item, then response 500 will be sent.
     */
    deleteItem: function (req, res, next) {
        var userData = req.body.userData;
        var id = parseInt(req.param('id'));

        if (id === -1) { //deleting all items
            userData.todos.removeCompleted();
        } else if (!userData.todos.removeTodo(id)) {
            res.send(500, {status: RESPONSE_STATUS.failure, 
                msg: 'Illegal item id.'});
            return;
        }

        res.send({status: RESPONSE_STATUS.success});
    }
};

/**
 * Fills auth object with authorisation data.
 * @param req the request object
 * @param {object} auth here the output will be appended in fields username
 * and password.
 * @returns {boolean} true if all expected fields found in the request.
 */
function getAuthorisation(req, auth) {
    auth.username = req.param('username');
    auth.password = req.param('password');

    return (typeof(auth.username) === 'string'
        && auth.username.length > 0
        && typeof(auth.password) === 'string'
        && auth.password.length > 0);
}

/**
 * Generates random string. Uses sha1 hash of random bytes.
 * The string will be a presentation of long hex number.
 * @param callback - called once the random string is ready.
 * callback receives arguments (err, key)
 * err - Error if occurred.
 * key - the random string.
 */
function genRandomString(callback) {
    crypto.randomBytes(1024, function(err, buff) {
        if (err) {
            callback(err);
            return;
        }
        var hash = crypto.createHash('sha1');
        hash.update(buff, 'binary');
        var key = hash.digest('hex');
        callback(undefined, key);
    });
}

/**
 * Initializer for array of sessions.
 * @constructor
 */
function Sessions() {
}
util.inherits(Sessions, Array);

/**
 * Opens new session for the user, stores it in sessions array
 * @param req current request
 * @param res current response
 * @param {UserData} userData for current user.
 */
Sessions.prototype.newSession = function (req, res, userData) {
    //generating new session-id
    genRandomString(function (err, sid) {
        if (err) {
            res.send(500, {status: RESPONSE_STATUS.failure,
                msg: "Failed to generate session-id. Try again."});
            return;
        }
        //close current session of user, if there's one already
        storage.deleteSession(userData.currentSid);
        //preparing new session object
        var session = {username: userData.username};
        //register in sessions map
        sessions[sid] = session;
        //put sid as current for the user
        userData.currentSid = sid;
        //set the cookie with timeout for the client
        res.cookie('key', sid,
            {httpOnly: true, maxAge: SESSION_TIMEOUT, path: '/item'});
        //set timeout on the server side
        session.timerID = setTimeout(storage.deleteSession, SESSION_TIMEOUT, sid);
        res.send(200);
    });
}

/**
 * Initializer for map of UserData objects, mapped by user names.
 * Each entry has username and timerID, used to stop backend timeout on the session.
 * @constructor
 */
function Storage() {
}

//invalidates and removes session key: setTimeout callback
Storage.prototype.deleteSession = function (sid) {
    var session = sessions[sid];
    if (!session) return;
    clearTimeout(session.timerID);
    var userData = storage[session.username];
    if (userData) {
        userData.currentSid = undefined;
    }
    delete sessions[sid];
};

/**
 * Initialized for data container for user.
 * Contains list of all items, user personal and login data,
 * id of currently active session.
 * @param registration - object with registration data.
 * @constructor
 */
function UserData(registration) {
    this.username = registration.username;
    this.fullname = registration.fullname;
    this.password = registration.password;
    this.currentSid = undefined; //remembers currently active sid
    this.todos = new TodoList();
}

//gets UserData instance for given session
UserData.get = function (sid) {
    var session = sessions[sid];
    if (!session) return;
    return storage[session.username];
}
