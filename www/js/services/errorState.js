/* Angular service errorState.
 */
'use strict';

/**
 * angular service - provides entry points for error cases in AJAX responses.
 * Also  provides watchers for input fields in login/register screens,
 * that validate the input value and display error message.
 * This service used by Register and Login controllers.
 */
todo.factory('errorState', function ($rootScope, $window, $http) {
    var MIN_PASSWD_LEN = 5; //minimal valid length of password

    //default headers for AJAX requests
    $http.defaults.headers.common['content-type'] = 'application/json';

    //the service object: singleton object, returned by the factory
    return {
        //verifies that password not too short
        passwordWatcher: function (newValue, oldValue) {
            if (newValue === oldValue) { //first call
                return;
            }
            if (!newValue || newValue.length < MIN_PASSWD_LEN) {
                todo.loginElements.password.msg = 'Password too short';
                return true;
            } else {
                todo.loginElements.password.msg = '';
                return false;
            }
        },

        //verifies that current value matches the password field
        passwordVerifyWatcher: function (newValue, oldValue) {
            if (newValue === oldValue) { //first call
                return;
            }
            if (!newValue || newValue !== todo.loginElements.password.value) {
                todo.loginElements.password_verify.msg = "Passwords don\'t match";
                return true;
            } else {
                todo.loginElements.password_verify.msg = '';
                return false;
            }
        },

        //verifies that username field not empty
        usernameWatcher: function (newValue, oldValue) {
            if (newValue === oldValue) { //first call
                return;
            }
            if (!newValue || newValue.length < 1) {
                todo.loginElements.username.msg = 'Username cannot be empty';
                return true;
            } else {
                todo.loginElements.username.msg = '';
                return false;
            }
        },
        //error while loading _todo list
        loadTodoList: function (data) {
            $rootScope.errorMessage = '';
            $window.location.href = "#/item/all";
        },
        //AJAX request to /item returned error
        responseErr: function (data) {
            if (data.msg) {
                $rootScope.errorMessage = data.msg;
            } else {
                $rootScope.errorMessage = "Illegal response.";
            }
        },
        fetchDone: false //flag for _todo list fetch (used globally)
    };
});
