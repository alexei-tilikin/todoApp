/* The subset of TestTool for http client only.
 * Provides framework for running independent tests.
 * Each test runs with separate instance of the tested server application.
 * Each test may have multiple sub-tests.
 * All tests and all sub-tests within a test run sequentially.
 */
var lib = {
    util: require('util'),
    http: require('http'),
    EventEmitter: require('events').EventEmitter
};
//the server process that will run instances of tested server
var server = require('child_process').fork('../main.js');

module.exports = {
    TestCase: TestCase,
    TestSuite: TestSuite
};

/**
 * TestCase implements generic functionality for HTTP or TCP client with ability
 * to receive the response.
 * @param {TestSuite} suite current suite object.
 * @param {string} testName base name for current test.
 * @param {string} reqPath request path (direct setter).
 * @constructor
 */
function TestCase(suite, testName, reqPath) {
    this.test = suite;
    this.testName = testName;

    //defaulting to POST with JSON body
    this.options = {
        hostname: 'localhost',
        port: 8080,
        method: 'POST',
        path: reqPath,
        headers : {
            'content-type': 'application/json'
        }
    };
}

/**
 * Starts the tested server application on the child process.
 * @param {function} callback - callback that called once the server starts listening.
 */
TestCase.prototype.runServer = function (callback) {
    server.once('message', function (msg) {
        if (msg === 'started') {
            callback(); //server listens
        } else { //DEBUG
            console.error('Expected \'started\', got: '.concat(msg));
        }
    });
    this.serverCtrl('start'); //starting the server
};

/**
 * Sends message to the server process.
 * The caller should listen on 'message' event for response.
 * @param {string} msg - legal values {'start', 'stop'}.
 */
TestCase.prototype.serverCtrl = function (msg) {
    try {
        server.send(msg);
    } catch(err) {
        console.error('Fatal error on IPC with server process: '.concat(err));
        process.exit(1);
    }
};

/**
 * Default action for test success.
 * Should be called at the end of the test.
 * 'this' points to the TestCase instance.
 */
TestCase.prototype.success = function () {
    var testCase = this;
    if (testCase.emitted) {return;}
    testCase.emitted = true; //avoiding concurrent 'test_result' events

    server.once('message', function (msg) {
        if (msg === 'stopped') {
            testCase.test.emit('test_result', testCase.testName, 'PASSED');
        }
    });
    testCase.serverCtrl('stop'); //stopping the server
};

/**
 * Called once 'error' event emitted (from any source).
 * 'this' points to the TestCase instance
 * @param {String} msg message to print in error log.
 */
TestCase.prototype.onError = function (msg) {
    var testCase = this;
    if (testCase.emitted) {return;}
    testCase.emitted = true; //avoiding concurrent 'test_result' events

    var name = (testCase.hasOwnProperty('subTestName'))
        ? lib.util.format('%s: %s', testCase.testName, testCase.subTestName)
        : testCase.testName;
    server.once('message', function (ipc_msg) {
        if (ipc_msg === 'stopped') {
            testCase.test.emit('test_result', name, 'FAILED\r\n'.concat(msg));
        }
    });
    testCase.serverCtrl('stop'); //stopping the server
};

/**
 * Called once HTTP response arrived.
 * 'this' points to the TestCase instance.
 * @param res the response object.
 * @param req HTTP request object that gave this response.
 */
TestCase.prototype.onResponse = function (res, req) {};

/**
 * Called once HTTP response object emits 'end' event,
 * or then TCP socket emits 'end' (form requestTCP).
 * 'this' points to the TestCase instance.
 * @param socket current socket passed when called from requestTCP.
 */
TestCase.prototype.onResponseEnd = TestCase.prototype.success;

/**
 * Called once HTTP response object emits 'readable' event.
 * 'this' points to response object.
 */
TestCase.prototype.readable = function () {
    this.read(); //default is to read and ignore
};

/**
 * HTTP client request with response awaiting.
 * @param body the body data for HTTP request.
 */
TestCase.prototype.requestHTTP = function (body) {
    var testCase = this;
    var req = lib.http.request(testCase.options, function (res) {
        testCase.onResponse(res, req);
        res.on('readable', function () {
            testCase.readable.call(res);
        }).once('error', function (err) {
                res.removeAllListeners('end');
                testCase.onError(err);
            }).once('end', function () {
                testCase.onResponseEnd();
            });
    }).once('error', function (err) {
            testCase.onError(err);
        });
    req.end(body);
};

/**
 * Simple proposed callback for subtest success event.
 * Not called by default.
 * Can be defined instead success() when subtestLoop used.
 */
TestCase.prototype.subTestSuccess = function () {
    this.test.emit(this.testName);
};

/**
 * Setup phase on each subtest iteration, right before the subtest callback invoked.
 * Allows to define subtest-specific data.
 * @param {int} idx index of current subtest.
 */
TestCase.prototype.setSubtest = function (idx) {
    if (this.hasOwnProperty('paths')) {
        this.options.path = this.paths[idx];
    }
};

/**
 * Generic loop of subtests. Each subtest uses internal custom event to notify
 * termination. When all loop ended, then 'test_result' emitted.
 * Attention: onResponseEnd callback should be changed when using subtestLoop.
 * Default onResponseEnd will end the test after first subtest.
 * @param {Array} names of subtests. names.length determines number of iterations.
 * @param {Array} sendData data to send on each iteration.
 * sendData[i] passed to iteration i.
 */
TestCase.prototype.subtestLoop = function (names, sendData) {
    var testCase = this;
    var currTest = 0;
    var subtest = testCase.requestHTTP;

    testCase.test.on(testCase.testName, function () {
        if (currTest === names.length) {
            testCase.success();
            return;
        }
        testCase.subTestName = names[currTest];
        testCase.setSubtest(currTest);
        subtest.call(testCase, (sendData ? sendData[currTest] : undefined));
        currTest++;
    });

    testCase.test.emit(this.testName); //launch
};

/**
 * TestSuite instance gets list of tests, and runs them sequentially.
 * It assumes that each test is function, that emits 'test_result' from the current
 * instance of TestSuite, to indicate the test termination.
 * After each test, progress indication printed.
 * After all tests done, overall log printed.
 * @constructor
 */
function TestSuite() {
    this.tests = [];
}

lib.util.inherits(TestSuite, lib.EventEmitter);

/**
 * Adds list of tests to the schedule.
 * All added test cases will run in the order of addition.
 * @param {Array} tests array of functions, each function is test case that emits
 * 'test_result' upon termination.
 */
TestSuite.prototype.addTests = function (tests) {
    this.tests = this.tests.concat(tests);
}

/**
 * Runs all defined tests sequentially.
 * Displays test result output for each test once it terminates.
 */
TestSuite.prototype.runAll = function () {
    var suite = this;
    var currTest = 0;
    var msg = []; 

    if (suite.tests.length === 0) {
        console.log('No tests scheduled.');
        return;
    }
    try {
        suite.on('test_result', function (name, result) {
            msg.push(lib.util.format('Test [%s] : %s', name, result)); 
            console.log(lib.util.format('Test [%s] : Done.', name));
            if (suite.tests[currTest].hasOwnProperty('tearDown')) {
                var tearDown = suite.tests[currTest].tearDown;
                if (typeof(tearDown) === 'function') {
                    tearDown.call(suite);
                }
            }
            //next test
            currTest++;
            if (currTest < suite.tests.length) {
                suite.tests[currTest].call(suite);
            } else {
                console.log('\t\tAll tests done.');
                console.log(msg.join('\r\n'));
                TestCase.prototype.serverCtrl('exit');
                server.disconnect();
            }
        });

        suite.tests[currTest].call(suite); //first test
    } catch (err) {
        console.error('Unpredicted error: '.concat(err));
        console.error(err.stack); //DEBUG
    }
};