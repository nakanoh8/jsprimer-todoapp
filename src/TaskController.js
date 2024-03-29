import { render } from './view/html-util.js';
import { TaskListView } from './view/TaskListView.js';
import { TaskItemModel } from './model/TaskItemModel.js';
import { TaskListModel } from './model/TaskListModel.js';

import firebase from '../plugins/firebase.js';

export class TaskController {
    // 紐づけするHTML要素を引数として受け取る
    constructor({
        taskFormElement,
        taskFormInputElement,
        taskListContainerElement,
        taskCountElement,
    }) {
        this.user = '';
        this.reloadTaskList();
        this.settingOnSnapshotForTaskItems();

        // bind to Element
        this.taskFormElement = taskFormElement;
        this.taskFormInputElement = taskFormInputElement;
        this.taskListContainerElement = taskListContainerElement;
        this.taskCountElement = taskCountElement;
        // ハンドラ呼び出しで、`this`が変わらないように固定する
        // `this`が常に`App`のインスタンスを示すようにする
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }
    reloadTaskList() {
        this.taskListView = new TaskListView();
        this.taskListModel = new TaskListModel();

        const db = firebase.firestore();
        db.collection('taskItems')
            .where('user', '==', this.user)
            .get()
            .then((querySnapshot) => {
                this.addTaskItemsForTaskList(querySnapshot);
            });
    }
    addTaskItemsForTaskList(querySnapshot) {
        querySnapshot.forEach((doc) => {
            const taskItemData = doc.data();
            const taskItem = new TaskItemModel({
                id: doc.id,
                title: taskItemData.title,
                completed: taskItemData.completed,
                addCount: taskItemData.addCount,
                execCount: taskItemData.execCount,
            });
            this.taskListModel.addTask(taskItem);
        });
    }
    settingOnSnapshotForTaskItems() {
        const db = firebase.firestore();
        db.collection('taskItems').onSnapshot((querySnapshot) => {
            this.reloadTaskList();
            this.mount();
        });
    }

    /**
     * Taskを追加時に呼ばれるリスナー関数
     * @param {string} title
     */
    handleAdd(title) {
        // this.taskListModel.addTask(new TaskItemModel({ title, completed: false }));

        // console.log(this);
        const taskItem = {
            id: 0,
            title: title,
            completed: false,
            addCount: 0,
            execCount: 0,
            user: this.user,
        };
        this.addTaskItemInDB(taskItem);
    }

    addTaskItemInDB(taskItem) {
        const self = this;
        const db = firebase.firestore();
        db.collection('taskItems')
            .add(taskItem)
            .then(function (docRef) {
                console.log('Document written with ID: ', docRef.id);
                docRef
                    .get()
                    .then(function (doc) {
                        self.updateTaskItemIdInDBFor(doc);
                        self.taskListModel.addTask(
                            new TaskItemModel({
                                id: doc.id,
                                title: doc.data().title,
                                completed: doc.data().completed,
                                addCount: doc.data().addCount,
                                execCount: doc.data().execCount,
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
    updateTaskItemIdInDBFor(doc) {
        const db = firebase.firestore();
        db.collection('taskItems')
            .doc(doc.id)
            .update({
                id: doc.id,
            })
            .catch(function (error) {
                console.error('Error upda document: ', error);
            });
    }

    /**
     * Taskの状態を更新時に呼ばれるリスナー関数
     * @param {{ id:number, completed: boolean }}
     */
    handleUpdate({ id, completed }) {
        this.taskListModel.updateTask({ id, completed });
        this.updateTaskItemCompletedInDBFor(id, completed);
    }

    updateTaskItemCompletedInDBFor(id, completed) {
        const db = firebase.firestore();
        db.collection('taskItems')
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
     * Taskを削除時に呼ばれるリスナー関数
     * @param {{ id: number }}
     */
    handleDelete({ id }) {
        this.taskListModel.deleteTask({ id });
        this.deletedTaskItemInDBFor(id);
    }

    deletedTaskItemInDBFor(id) {
        // console.log(id)
        const db = firebase.firestore();
        db.collection('taskItems')
            .doc(id)
            .delete()
            .then(function () {
                console.log('Document successfully deleted!');
            })
            .catch(function (error) {
                console.error('Error removing document: ', error);
            });
    }

    handleAddTaskToTodo({ id }) {
        const addItem = this.taskListModel
            .getTaskItems()
            .filter((taskItem) => taskItem.id === id);

        const todoItem = {
            id: 0,
            title: addItem[0].title,
            completed: false,
            user: this.user,
        };
        this.addFbTodoItemFor(todoItem);
    }

    addFbTodoItemFor(todoItem) {
        const db = firebase.firestore();
        db.collection('todoItems')
            .add(todoItem)
            .then(function (docRef) {
                console.log('Document written with ID: ', docRef.id);
                docRef
                    .get()
                    .then(function (doc) {
                        const db = firebase.firestore();
                        db.collection('todoItems')
                            .doc(doc.id)
                            .update({
                                id: doc.id,
                            })
                            .catch(function (error) {
                                console.error('Error upda document: ', error);
                            });
                    })
                    .catch(function (error) {
                        console.log('Error getting document:', error);
                    });
            })
            .catch(function (error) {
                console.error('Error adding document: ', error);
            });
    }

    /**
     * フォームを送信時に呼ばれるリスナー関数
     * @param {Event} event
     */
    handleSubmit(event) {
        event.preventDefault();
        const inputElement = this.taskFormInputElement;
        this.handleAdd(inputElement.value);
        inputElement.value = '';
    }

    /**
     * TaskListViewが変更した時に呼ばれるリスナー関数
     */
    handleChange() {
        const taskCountElement = this.taskCountElement;
        const taskListContainerElement = this.taskListContainerElement;
        const taskItems = this.taskListModel.getTaskItems();
        const taskListElement = this.taskListView.createElement(taskItems, {
            // Appに定義したリスナー関数を呼び出す
            onUpdateTask: ({ id, completed }) => {
                this.handleUpdate({ id, completed });
            },
            onDeleteTask: ({ id }) => {
                this.handleDelete({ id });
            },
            onAddTaskToTodo: ({ id }) => {
                this.handleAddTaskToTodo({ id });
            },
        });
        render(taskListElement, taskListContainerElement);
        taskCountElement.textContent = `Task数: ${this.taskListModel.getTotalCount()}`;
    }

    /**
     * アプリとDOMの紐づけを登録する関数
     */
    mount() {
        // console.log(this);
        this.taskListModel.onChange(this.handleChange);
        this.taskFormElement.addEventListener('submit', this.handleSubmit);
    }

    /**
     * アプリとDOMの紐づけを解除する関数
     */
    unmount() {
        this.taskListModel.offChange(this.handleChange);
        this.taskFormElement.removeEventListener('submit', this.handleSubmit);
    }

    changeUser(user) {
        this.user = user;
        this.loadTaskList();
        this.mount();
        this.taskListModel.emitChange();
    }
}
