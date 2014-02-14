/* Controllers: Login, Register.
 */
'use strict';

/**
 * Controller for registration action. Uses pattern login.html
 */
todo.controller('Register', function ($scope, $http, errorState) {
        //resetting fetchDone flag,
        //todoStorage will fetch the items list from the server
        errorState.fetchDone = false;

        //static values for template
        $scope.actionTitle = 'Registration';
        $scope.actionName = 'Register';
        $scope.nextScreen = 'login';

        //template filler for ng-repeat
        var data = todo.loginElements;
        //pseudo-model with pre-defined static ordering of elements
        $scope.elements = [
            data.fullname,
            data.username,
            data.password,
            data.password_verify
        ];

        //reset element values
        data.fullname.value = '';
        data.username.value = '';
        data.password.value = '';
        data.password_verify.value = '';

        //defining watcher for input validation
        $scope.$watch('elements[1].value', errorState.usernameWatcher, true);
        $scope.$watch('elements[2].value', errorState.passwordWatcher, true);
        $scope.$watch('elements[3].value', errorState.passwordVerifyWatcher, true);

        //registering action
        $scope.send = function () {
            var password = data.password.value;
            if (errorState.passwordWatcher(password)
                | errorState.passwordVerifyWatcher(data.password_verify.value)) {
                return;
            }
            var fullname = data.fullname.value.trim();
            var username = data.username.value.trim();
            if (errorState.usernameWatcher(username)) return;

            //sending JSON in POST request
            $http.post('/register',
                {username: username, fullname: fullname, password: password})
                .success(errorState.loadTodoList).error(errorState.responseErr);
        }; //function send
});

/**
* Controller for logging-in action. Uses pattern login.html
*/
todo.controller('Login', function ($scope, $http, errorState) {
    //resetting fetchDone flag,
    //for todoStorage to update the items list from the server
    errorState.fetchDone = false;

    //static values for template
    $scope.actionTitle = 'Logging-in';
    $scope.actionName = 'Login';
    $scope.nextScreen = 'register';

    //template filler for ng-repeat
    var data = todo.loginElements;
    //pre-defined static ordering of elements
    $scope.elements = [
        data.username,
        data.password
    ];

    //reset element values
    data.username.value = '';
    data.password.value = '';

    //defining watcher for input validation
    $scope.$watch('elements[0].value', errorState.usernameWatcher, true);
    $scope.$watch('elements[1].value', errorState.passwordWatcher, true);

    //the login action
    $scope.send = function () {
        var username = data.username.value.trim();
        var password = data.password.value;

        if (errorState.passwordWatcher(password)
            | errorState.usernameWatcher(username)) {
            return;
        }

        //sending JSON in POST request
        $http.post('/login', {username: username, password: password})
            .success(errorState.loadTodoList).error(errorState.responseErr);
    }; //function send
});