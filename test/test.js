/* The testing module.
 * Uses TestTool. See tester.txt
 */
var TestTool = require('./testTool');
var suite = new TestTool.TestSuite();
var util = require('util');

//verifying JSON body for error response.
var verifyResponseJSON = function (testCase) {
    if (testCase.expected == 200) {
        return true;
    }

    var body = testCase.data.join('');

    try {
        var json = JSON.parse(body);
        if (typeof(json.msg) !== 'string') throw new Error();
    } catch (err) {
        testCase.onError('Response body has illegal format: '.concat(body));
        return false;
    }
    return true;
};

//verifying 'set-cookie' header in response, with expected properties
var verifyResponseCookie = function (testCase, res) {
    if (res.statusCode != 200) {
        return true;
    }
    var cookie = res.headers['set-cookie'];
    if (cookie instanceof Array) {
        cookie = cookie[0];
    }

    if (!cookie
        || cookie.indexOf('key=') !== 0
        || cookie.indexOf('httpOnly') < 1
        || cookie.indexOf('path=/item') < 1) {
        testCase.onError('Response expected to have \'set-cookie\' header, GOT\r\n'
            .concat(util.inspect(cookie)));
        return false;
    }
    return true;
};


/**
 * Parses session-id from 'set-cookie' header.
 * @param res server response.
 * @returns {string} parsed session id. or empty string if no session.
 */
var parseSessionID = function (res) {
    var cookie = res.headers['set-cookie'];
    if (cookie instanceof Array) {
        cookie = cookie[0];
    }
    if (!cookie) return '';

    return cookie.substring(cookie.indexOf('key='), cookie.indexOf(';'));
};

/**
 * Counts number of properties in the object.
 * The object assumed to be JSON, that arrived in server response,
 * containing todo_items.
 * Used to count number of items in the list that arrived from GET request.
 */
var countLength = function (obj) {
    var len = 0;
    for (var key in obj) {
        ++len;
    }
    return len;
}

//___________________Test cases start from here__________________

/**
 * Testing POST /register.
 * Verifying: response code,
 * response 200 'set-cookie' header,
 * response 500 is JSON with msg field.
 */
function testRegister() {
    var names = [
        'Valid user',
        'Existing user',
        'Illegal format',
        'Empty username',
        'Empty password'];
    var reqs = [
        {username: 'username1', fullname: 'Full Name', password: 'password2'},
        {username: 'username1', fullname: '', password: 'password1'},
        {username: 'legal', password: 'legalPassword'},
        {username: '', fullname: 'Full Name', password: 'password1'},
        {username: 'username', fullname: 'Full Name', password: ''}
    ];

    var reqBody = [];
    for (var i = 0; i < reqs.length; ++i) {
        reqBody.push(JSON.stringify(reqs[i]));
    }

    var expectedStatus = [200, 500, 500, 500, 500, 500];

    var testCase = new TestTool.TestCase(this, 'testRegister', '/register');

    testCase.options.method = 'POST';
    testCase.options.headers = {
        'content-type' : 'application/json'
    };

    testCase.setSubtest = function (idx) {
        testCase.expected = expectedStatus[idx];
        testCase.data = [];
        testCase.options.headers['content-length'] = reqBody[idx].length;
    };

    testCase.onResponse = function (res) {
        if (res.statusCode != testCase.expected) {
            testCase.onError(['Response code EXPECTED ', testCase.expected,
                ', GOT ', res.statusCode].join(''));
        } else {
            verifyResponseCookie(testCase, res);
        }
    };

    testCase.readable = function () {
        testCase.data.push(this.read());
    }

    testCase.onResponseEnd = function () {
        if (verifyResponseJSON(testCase)) {
            testCase.test.emit(testCase.testName);
        }
    };

    testCase.runServer(function() {
        testCase.subtestLoop(names, reqBody);
    });
}
testRegister.tearDown = function () {
    this.removeAllListeners('testRegister');
};

/**
 * Testing POST /login.
 * Verifying: response code,
 * response 200 has valid 'set-cookie' header,
 * response 500 is JSON with msg field.
 */
function testLogin() {
    var names = [
        'Valid login',
        'Repeated valid login',
        'Illegal password',
        'Non-existing username',
        'Illegal login form'
    ];

    var reqs = [
        {username: 'username1', password: 'pasSwd1'},
        {username: 'username1', password: 'pasSwd1'},
        {username: 'username1', password: 'passwd1'},
        {username: 'username2', password: 'pasSwd1'},
        {password: 'some_password'}
    ];

    var reqBody = [];
    for (var i = 0; i < reqs.length; ++i) {
        reqBody.push(JSON.stringify(reqs[i]));
    }

    var expectedStatus = [200, 200, 500, 500, 500];

    var testCase = new TestTool.TestCase(this, 'testLogin', '/login');

    testCase.setSubtest = function (idx) {
        testCase.expected = expectedStatus[idx];
        testCase.options.headers['content-length'] = reqBody[idx].length;
        testCase.data = [];
    };

    testCase.onResponse = function (res) {
        if (res.statusCode != testCase.expected) {
            testCase.onError(['Response code EXPECTED ', testCase.expected,
                ', GOT ', res.statusCode].join(''));
        } else {
            verifyResponseCookie(testCase, res);
        }
    };

    testCase.readable = function () {
        testCase.data.push(this.read());
    }

    testCase.onResponseEnd = function () {
        if (verifyResponseJSON(testCase)) {
            testCase.test.emit(testCase.testName);
        }
    };

    testCase.test.once('testLoginSetup', function () {
        testCase.subtestLoop(names, reqBody);
    });
    testLogin.setUp.call(this);
}

/**
 * Setup phase.
 * Runs the server, registers user.
 * When setup done, event 'testLoginSetup' emitted.
 */
testLogin.setUp = function () {
    var testCase = new TestTool.TestCase(this, 'testLoginSetup', '/register');
    testCase.options.method = 'POST';

    var reqBody = JSON.stringify(
        {username: 'username1', fullname: 'Full Name', password: 'pasSwd1'});

    testCase.options.headers = {
        'content-type' : 'application/json',
        'content-length' : reqBody.length
    };

    testCase.onResponse = function (res, req) {
        if (res.statusCode != 200) {
            testCase.onError('Response code EXPECTED 200, GOT '
                .concat(res.statusCode) );
            return;
        }
        //remember 'set-cookie' header.
        testLogin.sid = parseSessionID(res);
    };

    testCase.onResponseEnd = function () {
        if (testCase.emitted) {return;}
        testCase.test.emit('testLoginSetup');
    };

    testCase.runServer(function() {
        testCase.requestHTTP(reqBody);
    });
};

testLogin.tearDown = function () {
    this.removeAllListeners('testLogin');
};

/**
 * Testing all /item APIs:
 * GET: gets full list of todo_items.
 * POST: adds new item.
 * PUT: updates single item, or all items.
 * DELETE: removes single item or all completed items.
 *
 * Verifying: valid & invalid cases, list consistency, response codes.
 */
function testItems() {
    var names = [
        'Invalid session',
        'Closed session',
        'Attempt to add item with illegal id',
        'Attempt to update non-existing item',
        'Attempt to delete with illegal item id',
        'Getting items with active session',
        'Adding valid item 12',
        'Validating todo0 added',
        'Attempt to add item with occupied id',
        'Validating that items list not changed',
        'Deleting todo0 with id 12',
        'Validating that id 12 deleted',
        'Adding item with valid id 17',
        'Updating item 17, changing value and status',
        'Validating that id 17 updated',
        'Deleting all completed items',
        'Validating that all completed removed',
        'Adding item 17 again',
        'Setting all items as completed.',
        'Adding item 1',
        'Deleting all completed items (all items)',
        'Deleting item 1',
        'Validating that all items removed'
    ];
    var nTests = names.length; //total number of defined sub-tests
    var queries = [
        undefined,
        undefined,
        {id: -1, value: 'my todo0'},
        {id: 30, value: 'new value', status: 1},
        {id: -2},
        undefined,
        {id: 12, value: 'my todo0'},
        undefined,
        {id: 12, value: 'failed attempt'},
        undefined,
        {id: 12},
        undefined,
        {id: 17, value: 'old value'},
        {id: 17, value: 'new value', status: 1},
        undefined,
        {id: -1},
        undefined,
        {id: 17, value: 'item17'},
        {id: -1, status: 1},
        {id: 1, value: 'item1'},
        {id: -1},
        {id: 1},
        undefined
    ];
    var methods = ['GET', 'GET', 'POST', 'PUT', 'DELETE', 'GET', 'POST', 'GET',
        'POST', 'GET', 'DELETE', 'GET', 'POST', 'PUT', 'GET', 'DELETE', 'GET',
        'POST', 'PUT', 'POST', 'DELETE', 'DELETE', 'GET'];
    //session cookies for each request.
    var sessions;  //Initialized after setUp done.
    //expected status codes in responses
    var expectedStatus; //Initialized after setUp done.

    //verifier functions for each sub-test
    var verifiers = [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        passTrue,
        undefined,
        verifyTODOAdded,
        undefined,
        verifyListConsistent,
        undefined,
        verifyTODORemoved,
        undefined,
        undefined,
        verifyTODOUpdated,
        undefined,
        verifyCompleteRemoved,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        verifyAllRemoved
    ];
    var todos; //holds previous state of the items list.

    //stringified JSONs for POST body
    var reqBody = [];
    for (var i = 0; i < queries.length; ++i) {
        if (!queries[i]) reqBody.push(undefined);
        else reqBody.push(JSON.stringify(queries[i]));
    }

    //only update todos with current response, without verifying
    function passTrue() {
        return true;
    }

    function verifyListConsistent(newTodos, queryIdx) {
        if (!todos || !newTodos) return false;
        for (var k in newTodos) {
            if (!todos[k]
                || todos[k].title !== newTodos[k].title
                || todos[k].completed !== newTodos[k].completed) {
                return false;
            }
        }
        return true;
    }

    function verifyTODOAdded(newTodos, queryIdx) {
        var query = queries[queryIdx]; //get the last sent POST query
        if (!query) return true;
        if (!todos || !newTodos
            || countLength(todos) !== countLength(newTodos) - 1
            || todos[query.id] || !newTodos[query.id]) {
            return false;
        }

        var newTodo = newTodos[query.id]; //this item was added the last time
        return (newTodo.completed === false && query.value === newTodo.title);
    }

    function verifyTODORemoved(newTodos, queryIdx) {
        var query = queries[queryIdx]; //get the last sent DELETE query
        if (!query) return true;
        if (!todos || !newTodos) return false;

        if (countLength(todos) !== countLength(newTodos) + 1
            || !todos[query.id] || newTodos[query.id]) {
            return false;
        }
        return true;
    }
    function verifyCompleteRemoved(newTodos, queryIdx) {
        var query = queries[queryIdx]; //get the last sent DELETE query
        if (!query) return true;
        if (!todos || !newTodos) return false;
        if (query.id !== -1) return false;
        //all completed should be deleted
        for (var k in newTodos) {
            if (newTodos[k].completed) return false;
        }
        return true;
    }

    function verifyAllRemoved(newTodos, queryIdx) {
        var query = queries[queryIdx]; //get the last sent DELETE query
        if (!query) return true;
        if (!todos || !newTodos || countLength(newTodos)) return false;
        return true;
    }

    //not assuming that todos has updated item
    function verifyTODOUpdated(newTodos, queryIdx) {
        var query = queries[queryIdx]; //get the last sent PUT query
        if (!query) return true;
        if (!newTodos) return false;

        var newTodo = newTodos[query.id]; //the updated item
        return (newTodo &&
            newTodo.completed == query.status  //casting number to boolean
            && newTodo.title === query.value);
    }

    var testCase = new TestTool.TestCase(this, 'testItems', '/item');

    testCase.setSubtest = function (idx) {
        testCase.currIdx = idx;
        testCase.expected = expectedStatus[idx];
        testCase.data = [];
        testCase.options.method = methods[idx];
        testCase.verifier = verifiers[idx];
        testCase.options.headers['cookie'] = sessions[idx];
        if (reqBody[idx]) {
            testCase.options.headers['content-length'] = reqBody[idx].length;
        } else {
            delete testCase.options.headers['content-length'];
        }
    };

    testCase.onResponse = function (res) {
        if (res.statusCode != testCase.expected) {
            testCase.onError(['Response code EXPECTED ', testCase.expected,
                ', GOT ', res.statusCode].join(''));
        }
    };

    testCase.readable = function () {
        testCase.data.push(this.read());
    }

    testCase.onResponseEnd = function () {
        if (testCase.expected != 200 || !testCase.verifier) {
            testCase.test.emit(testCase.testName);
            return;
        }
        //getting parsed array of todos from request
        try {
            var body = testCase.data.join('');
            var newTodos = JSON.parse(body);
        } catch (err) {
            testCase.onError('GET request has illegal response: '.concat(body));
            return;
        }
        if (!testCase.verifier(newTodos, testCase.currIdx - 1)) {
            testCase.onError(['Last change request: ',
                reqBody[testCase.currIdx - 1],
                '\r\nOld state: ', util.inspect(todos),
                '\r\nNew state: ', util.inspect(newTodos)].join(''));
            return;
        }
        todos = newTodos;
        testCase.test.emit(testCase.testName);
    };

    testCase.test.once('testItemsSetup', function () {
        //initializing session ids & expected codes for the tests
        sessions = new Array(nTests);
        expectedStatus = new Array(nTests);
        for (var i = nTests; i--;) {
            sessions[i] = testItems.activeSid;
            expectedStatus[i] = 200;
        }
        sessions[0] = 'key=1234abcd'; //invalid session
        sessions[1] = testItems.closedSid; //closed session

        //illegal session
        expectedStatus[0] = expectedStatus[1] = 400;
        //illegal item id
        expectedStatus[2] = expectedStatus[3] = expectedStatus[4] =
            expectedStatus[8] = 500;

        //extra check for test configuration
        [queries.length, methods.length, verifiers.length, reqBody.length]
            .forEach(function (len) {
                if (len !== nTests) {
                    testCase.onError('Test configuration inconsistent.');
                    nTests = 0;
                    return;
                }
            });
        if (nTests) testCase.subtestLoop(names, reqBody);
    });

    testItems.setUp.call(this);
}

/**
 * Setup phase.
 * Reusing testLogin.setup to register new user.
 * Sending /login to get new session-id.
 */
testItems.setUp = function () {
    var testCase = new TestTool.TestCase(this, 'testItemsSetup','/login');
    var body = JSON.stringify({username: 'username1', password: 'pasSwd1'});

    testCase.options.headers['content-length'] = body.length;

    testCase.test.once('testLoginSetup', function () {
        testItems.closedSid = testLogin.sid;
        //send /login request
        testCase.requestHTTP(body);
    });

    testCase.onResponse = function (res, req) {
        if (res.statusCode != 200) {
            testCase.onError('/login response code EXPECTED 200, GOT '
                .concat(res.statusCode) );
            return;
        }
        testItems.activeSid = parseSessionID(res);
    };

    testCase.onResponseEnd = function () {
        if (testCase.emitted) {return;}
        testCase.test.emit('testItemsSetup');
    };
    testLogin.setUp.call(this);
};

testItems.tearDown = function () {
    this.removeAllListeners('testItems');
};

//Array of test cases to run
var tests = [
    testRegister,
    testLogin,
    testItems
];

//Now running test suite with all defined tests
suite.addTests(tests);
suite.runAll();