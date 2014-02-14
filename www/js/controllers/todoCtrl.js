'use strict';

/**
 * The main controller for the app.
 * Uses todoStorage service for model data,
 * todo.html pattern for view.
 */
todo.controller('TodoCtrl', function TodoCtrl($scope, $routeParams, todoStorage) {
	//getting full list of todo_items.
    todoStorage.get(getTodos);

	$scope.newTodo = '';
	$scope.editedTodo = null;

    /**
     * Callback for todoStorage.get().
     * Called once the todoList is available.
     * This may come as server response, or from the local cache.
     * @param data the raw object that holds todoList data.
     */
    function getTodos(data) {
        $scope.todos = data;
    }

    /**
     * Condition expression for todo.html template.
     * @returns {boolean} true iff current todoList not empty.
     */
    $scope.hasItems = function () {
      return todoStorage.todoList.length();
    };

    //watching for $scope.todos changes to update counters
	$scope.$watch('todos', function (newValue, oldValue) {
		$scope.remainingCount = todoStorage.todoList.count(false);
		$scope.completedCount = todoStorage.todoList.length() - $scope.remainingCount;
		$scope.allChecked = !$scope.remainingCount;
	}, true);

    //pre-defined ngShow conditions for status filter
    var showActive = function (todo) {
        return (!todo.completed);
    };
    var showCompleted = function (todo) {
        return (todo.completed);
    };
    var showAll = function () {
        return true;
    };

	// Monitor the current route for changes and adjust ngShow filter accordingly.
	$scope.$on('$routeChangeSuccess', function () {
		var status = $scope.status = $routeParams.status || '';

        $scope.showCondition = (status === 'active') ? showActive :
            (status === 'completed') ? showCompleted : showAll;
	});

	$scope.addTodo = function () {
		var newTodo = $scope.newTodo.trim();
		if (!newTodo.length) {
			return;
		}
        todoStorage.add(newTodo);
		$scope.newTodo = '';
	};

	$scope.editTodo = function (todo) {
		$scope.editedTodo = todo;
		// Clone the original item to restore it on demand.
		$scope.originalTodo = angular.extend({}, todo);
	};

	$scope.doneEditing = function (todo) {
		$scope.editedTodo = null;
		todo.title = todo.title.trim();

		if (!todo.title) {
            //remove item with empty title
			$scope.removeTodo(todo);
		} else if (!$scope.originalTodo
            || todo.title !== $scope.originalTodo.title) {
            //update only if the title was changed
            todoStorage.update(todo); //send remote update
        }
	};

	$scope.revertEditing = function (todo) {
        //restore previous title from local copy
        todoStorage.todoList.replaceTodo(todo.id, $scope.originalTodo);
        //remote storage not affected
	};

	$scope.removeTodo = function (todo) {
        todoStorage.delete(todo.id);
	};

	$scope.clearCompletedTodos = function () {
        todoStorage.delete(-1);
	};

	$scope.markAll = function (completed) {
        todoStorage.mark(!completed);
	};
});