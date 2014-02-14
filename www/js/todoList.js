/* Both Angular service and Node module.
 * Defines prototype for container of todo_items.
 * Used on both backend and frontend.
 */

/**
 * Constructor for new list.
 * @param data - if raw object, when used as data model for the list.
 * Otherwise ignored, and new empty list created.
 * @constructor
 */
function TodoList(data) {
    this.todos = (Object.prototype.toString.call(data) === '[object Object]')
        ? data : {};
    this._length = Object.keys(this.todos).length;
    this._nextId = this._length;
}

/**
 * Finds and returns next available id for new item.
 * @private
 */
TodoList.prototype._findNextId = function () {
    while (this.todos.hasOwnProperty(this._nextId)) ++this._nextId;
    return this._nextId;
};

/**
 * @returns {*} raw object with list data.
 * Compatible with GET /item JSON format.
 */
TodoList.prototype.jsonView = function () {
    return this.todos;
};

TodoList.prototype.get = function (idx) {
    return this.todos[idx];
};

/**
 * Adds new item to the list.
 * @param title - the item title.
 * @param {number} idx - if specified, then ths id will be used for new item.
 * Previous item with such id will be overwritten.
 * @returns the item object that added to the list.
 */
TodoList.prototype.setItem = function (title, idx) {
    var item = {id: (idx || this._findNextId()), title: title, completed: false};

    if (!this.todos[item.id]) ++this._length;
    this.todos[item.id] = item;

    return item;
};

/**
 * Deletes item from teh list.
 * @param idx - id of item to delete.
 * @returns {boolean} - true if deleted, false if id was invalid.
 */
TodoList.prototype.removeTodo = function (idx) {
    if (!this.todos[idx]) return false;
    delete this.todos[idx];
    --this._length;
    return true;
};

/**
 * Copies data from given item into item at the specified index.
 * @param idx the index at which to copy the item.
 * @param todo the item that will be copied into the container.
 * @returns {boolean} true if item with requested idx was found and replaced.
 * false - if no item with requested idx found (nothing done).
 */
TodoList.prototype.replaceTodo = function (idx, todo) {
    var item = this.todos[idx];
    if (!item) return false;

    item.title = todo.title;
    item.completed = todo.completed;
    return true;
};

/**
 * Removes all items with status 'completed'.
 */
TodoList.prototype.removeCompleted = function () {
    for (var key in this.todos) {
        if (!this.todos[key].completed) continue;
        delete this.todos[key];
        --this._length;
    }
};

/**
 * Changes 'completed' status for all items in the list.
 * @param {boolean} completed - the status to set for all items.
 */
TodoList.prototype.markAll = function (completed) {
    for (var key in this.todos) {
        this.todos[key].completed = completed;
    }
};

TodoList.prototype.length = function () {
  return this._length;
};

/**
 * Counts number of items in teh list with given 'completed' status.
 * @param {boolean} completed - the status filter for items that will be counted.
 * @returns {number}
 */
TodoList.prototype.count = function (completed) {
    var cnt = 0;
    for (var key in this.todos) {
        if (this.todos[key].completed === completed) ++cnt;
    }
    return cnt;
};


try { //exports for Node module
    module.exports = TodoList;
} catch (err) {}

if (this.todo) { //service for angular
    this.todo.factory('TodoList', function () {
        return {
          newInstance: function (data) {
              return new TodoList(data);
          }
        };
    });
}

