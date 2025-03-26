Page({
  data: {
    todos: [],
    watcher: null // 用于存储实时监听对象
  },

  onLoad() {
    this.startRealtimeListener();
  },

  startRealtimeListener() {
    const db = wx.cloud.database();

    // 开启实时监听
    const watcher = db.collection('todos').watch({
      onChange: snapshot => {
        console.log('实时数据更新:', snapshot.docs);
        this.setData({ todos: snapshot.docs });
      },
      onError: err => {
        console.error('监听错误:', err);
      }
    });

    // 保存监听对象
    this.setData({ watcher });
  },

  onUnload() {
    // 停止实时监听
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  onInputChange(e: any) {
    this.setData({ newTodo: e.detail.value });
  },

  addTodo() {
    const { newTodo } = this.data;
    if (!newTodo.trim()) return;

    const newTodoItem = {
      text: newTodo.trim(),
      completed: false
    };
    const db = wx.cloud.database();
        db.collection('todos')
      .add({
        data: newTodoItem
          })
          .then(() => {
        console.log('待办事项添加成功');
      })
      .catch(err => {
        console.error('添加待办事项失败', err);
});
  },

  deleteTodo(e: any) {
    const id = e.currentTarget.dataset.id;
    const db = wx.cloud.database();

    db.collection('todos')
      .doc(id)
      .remove()
      .then(() => {
        console.log('待办事项删除成功');
      })
      .catch(err => {
        console.error('删除待办事项失败', err);
});
  },

  toggleTodo(e: any) {
    const id = e.currentTarget.dataset.id;
    const db = wx.cloud.database();

    const todoToUpdate = this.data.todos.find(todo => todo._id === id);
    if (!todoToUpdate) {
      console.error(`待办事项 ${id} 未找到`);
      return;
    }

    const updatedCompleted = !todoToUpdate.completed;

    db.collection('todos')
      .doc(id)
      .update({
        data: { completed: updatedCompleted }
      })
      .then(() => {
        console.log(`待办事项 ${id} 状态更新成功`);
      })
      .catch(err => {
        console.error('更新待办事项失败', err);
      });
  }
});