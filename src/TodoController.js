import { render } from './view/html-util.js';
import { TodoListView } from './view/TodoListView.js';
import { TodoItemModel } from './model/TodoItemModel.js';
import { TodoListModel } from './model/TodoListModel.js';

import firebase from '../plugins/firebase.js';

export class TodoController {
    // 紐づけするHTML要素を引数として受け取る
    constructor({
        formElement,
        formInputElement,
        todoListContainerElement,
        todoCountElement,
    }) {
        this.user = '';
        this.todoListView = new TodoListView();
        this.todoListModel = new TodoListModel([]);
        const db = firebase.firestore();
        db.collection('todoItems')
            .where('user', '==', this.user)
            .get()
            .then((querySnapshot) => {
                console.log(this.user);
                querySnapshot.forEach((doc) => {
                    // console.log(doc.data());
                    const todoItemData = doc.data();
                    const todoItem = new TodoItemModel({
                        id: doc.id,
                        title: todoItemData.title,
                        completed: todoItemData.completed,
                    });
                    // console.log(todoItem);
                    this.todoListModel.addTodo(todoItem);
                });
            });

        db.collection('todoItems').onSnapshot((querySnapshot) => {
            // console.log('変更！！');
            this.todoListView = new TodoListView();
            this.todoListModel = new TodoListModel([]);
            db.collection('todoItems')
                .where('user', '==', this.user)
                .get()
                .then((querySnapshot) => {
                    querySnapshot.forEach((doc) => {
                        // console.log(doc.data());
                        const todoItemData = doc.data();
                        const todoItem = new TodoItemModel({
                            id: doc.id,
                            title: todoItemData.title,
                            completed: todoItemData.completed,
                        });
                        this.todoListModel.addTodo(todoItem);
                    });
                });
            // this.mount(this.user);
        });

        // bind to Element
        this.formElement = formElement;
        this.formInputElement = formInputElement;
        this.todoListContainerElement = todoListContainerElement;
        this.todoCountElement = todoCountElement;
        // ハンドラ呼び出しで、`this`が変わらないように固定する
        // `this`が常に`App`のインスタンスを示すようにする
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);

        console.log(this);
    }

    /**
     * Todoを追加時に呼ばれるリスナー関数
     * @param {string} title
     */
    handleAdd(title) {
        const self = this;
        const db = firebase.firestore();
        console.log(title);
        console.log(this);
        const todoItem = {
            id: 0,
            title: title,
            completed: false,
            user: this.user,
        };
        db.collection('todoItems')
            .add(todoItem)
            .then(function (docRef) {
                console.log('Document written with ID: ', docRef.id);
                docRef
                    .get()
                    .then(function (doc) {
                        self.dbUpdateIdFor(doc);
                        self.todoListModel.addTodo(
                            new TodoItemModel({
                                id: doc.id,
                                title: doc.data().title,
                                completed: false,
                            })
                        );
                    })
                    .catch(function (error) {
                        console.log('Error getting document:', error);
                    });
            })
            .catch(function (error) {
                console.error('Error adding document: ', error);
            });
    }

    dbUpdateIdFor(doc) {
        const db = firebase.firestore();
        db.collection('todoItems')
            .doc(doc.id)
            .update({
                id: doc.id,
            })
            .catch(function (error) {
                console.error('Error upda document: ', error);
            });
    }

    /**
     * Todoの状態を更新時に呼ばれるリスナー関数
     * @param {{ id:number, completed: boolean }}
     */
    handleUpdate({ id, completed }) {
        this.todoListModel.updateTodo({ id, completed });
        this.dbUpdateCompletedFor(id, completed);
    }

    dbUpdateCompletedFor(id, completed) {
        const db = firebase.firestore();
        db.collection('todoItems')
            .doc(id)
            .update({
                completed: completed,
            })
            .then(function () {
                console.log('Document successfully update!');
            })
            .catch(function (error) {
                console.error('Error updating document: ', error);
            });
    }

    /**
     * Todoを削除時に呼ばれるリスナー関数
     * @param {{ id: number }}
     */
    handleDelete({ id }) {
        this.todoListModel.deleteTodo({ id });
        this.dbDeletedFor(id);
    }

    dbDeletedFor(id) {
        const db = firebase.firestore();
        db.collection('todoItems')
            .doc(id)
            .delete()
            .then(function () {
                console.log('Document successfully deleted!');
            })
            .catch(function (error) {
                console.error('Error removing document: ', error);
            });
    }

    /**
     * フォームを送信時に呼ばれるリスナー関数
     * @param {Event} event
     */
    handleSubmit(event) {
        event.preventDefault();
        const inputElement = this.formInputElement;
        this.handleAdd(inputElement.value);
        inputElement.value = '';
    }

    /**
     * TodoListViewが変更した時に呼ばれるリスナー関数
     */
    handleChange() {
        const todoCountElement = this.todoCountElement;
        const todoListContainerElement = this.todoListContainerElement;
        const todoItems = this.todoListModel.getTodoItems();
        const todoListElement = this.todoListView.createElement(todoItems, {
            // Appに定義したリスナー関数を呼び出す
            onUpdateTodo: ({ id, completed }) => {
                this.handleUpdate({ id, completed });
            },
            onDeleteTodo: ({ id }) => {
                this.handleDelete({ id });
            },
        });
        render(todoListElement, todoListContainerElement);
        todoCountElement.textContent = `Todoアイテム数: ${this.todoListModel.getTotalCount()}`;
    }

    /**
     * アプリとDOMの紐づけを登録する関数
     */
    mount(user) {
        this.user = user;
        // console.log(this);
        this.todoListModel.onChange(this.handleChange);
        this.formElement.addEventListener('submit', this.handleSubmit);
    }

    /**
     * アプリとDOMの紐づけを解除する関数
     */
    unmount() {
        this.todoListModel.offChange(this.handleChange);
        this.formElement.removeEventListener('submit', this.handleSubmit);
    }
}