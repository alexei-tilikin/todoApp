'use strict';

/**
 * The main module
 * @type {angular.Module}
 */
var todo = angular.module('todo', ['ngRoute'])
	.config(function ($routeProvider) {
		$routeProvider.when('/login', {
			controller: 'Login',
			templateUrl: 'templates/login.html'
		}).when('/register', {
            controller: 'Register',
            templateUrl: 'templates/login.html'
        }).when('/item/:status', {
			controller: 'TodoCtrl',
			templateUrl: 'templates/todo.html'
		}).otherwise({
			redirectTo: '/item/all'
		});
	});

/* template filler.
 * Defines all elements that may appear in template login.html.
 * value stands for input value.
 * msg - description of last error from verifying watcher.
 */
todo.loginElements = {
    fullname: {value: '', type: 'text', hint: 'Full name', msg: ''},
    username: {value: '', type: 'text', hint: 'Login username', msg: ''},
    password: {value: '', type: 'password', hint: 'Password', msg: ''},
    password_verify: {value: '', type: 'password', hint: 'Repeat password', msg: ''}
};

// Definition of directives

/**
 * Directive that places current element in focus if the expression in argument
 * evaluates to true.
 */
todo.directive('todoFocus', function todoFocus($timeout) {
    return function (scope, elem, attrs) {
        scope.$watch(attrs.todoFocus, function (newVal) {
            if (newVal) {
                $timeout(function () {
                    elem[0].focus();
                }, 0, false);
            }
        });
    };
});

/**
 * Directive that executes an expression when the element it is applied to gets
 * an 'escape' keydown event.
 */
todo.directive('todoEscape', function () {
    var ESCAPE_KEY = 27;
    return function (scope, elem, attrs) {
        elem.bind('keydown', function (event) {
            if (event.keyCode === ESCAPE_KEY) {
                scope.$apply(attrs.todoEscape);
            }
        });
    };
});