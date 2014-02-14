/* global todo*/
'use strict';

/**
 * todoStorage is a frontend angular service
 * for manipulation on the backend user storage.
 */
todo.factory('todoStorage', function ($http, $window, errorState, TodoList) {

    /**
     * Called when the server returns error response.
     * Sets the login screen on the view, with error message.
     * @param data - the data in the response.
     * @param status - response HTTP status code.
     */
    function errCallback(data, status) {
        if (data.status) {
            errorState.responseErr(data); //display error message
        }
        if (status == 500) {
            $window.location.href = "#/login"; //jump to login page
        }
    }

    //the service object: singleton object, returned by the factory
	var todoStorage = {
        /**
         * Getting list of all items. Asynchronous.
         * After first fetch from the server, and until next login/register,
         * this function will return the list from the local cache.
         * @param callback - this callback will be called once the list data available,
         * The list object passed in first argument to the callback.
         */
		get: function (callback) {
            //Fetching only if fetchDone flag was false.
            //This happens on first load of the module,
            //or if arrived from login/register screen.
            if (errorState.fetchDone) {
                callback.call(null, todoStorage.todoList.jsonView());
                return;
            }
            errorState.fetchDone = true;

			$http.get('/item').success(function (data) {
                todoStorage.todoList = TodoList.newInstance(data);
                callback.call(null, data);
            }).error(function (data) {
                errorState.responseErr(data); //define error message
                $window.location.href = "#/login";
            });
		},

        /**
         * Sends remote update of changed item data.
         * Local list cache not changed.
         * Using PUT method.
         * @param {object} todo - plain object with updated data.
         * Expected to have properties 'id', 'completed', 'title'.
         */
		update: function (todo) {
			$http.put('/item', {id: todo.id, value: todo.title,
                status: (todo.completed ? 1 : 0)})
                .error(errCallback);
		},

        /**
         * Sends update for setting 'completed' status to all items.
         * Updates the local list cache.
         * Using PUT method.
         * @param {boolean} completed - the value of 'completed' status to set.
         */
        mark: function (completed) {
            todoStorage.todoList.markAll(completed); //update locally
            todoStorage.update({id: -1, completed: completed}); //send remote update
        },

        /**
         * Remotely deletes one or many items from the backend list.
         * Updates the local list cache.
         * Using DELETE method.
         * @param {int} idx - index of item to delete.
         */
        delete: function (idx) {
            //delete locally
            if (idx === -1) {
                todoStorage.todoList.removeCompleted();
            } else {
                todoStorage.todoList.removeTodo(idx);
            }
            //send remote update
            $http.delete('/item', {data: {id: idx}}).error(errCallback);
        },

        /**
         * Adds new item to the list.
         * Using POST method. Updates the local list cache.
         * @param title - the title of new item.
         */
        add: function (title) {
            //add locally
            var item = todoStorage.todoList.setItem(title);
            //send remote update
            $http.post('/item', {id: item.id, value: item.title})
                .error(errCallback);
        },

        todoList: TodoList.newInstance() //local list cache
	};

    return todoStorage;
});
