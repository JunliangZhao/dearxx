import { formatTime } from "../../utils/util";

Page({
  data: {
    todos: [],
    watcher: null, // 用于存储实时监听对象
    showSubscribeModal: false // 控制订阅弹窗显示
  },

  onLoad() {
    this.startRealtimeListener();
  },

  startRealtimeListener() {
    const db = wx.cloud.database();

    // 开启实时监听
    const watcher = db.collection('todos').watch({
      onChange: snapshot => {
        const todos = snapshot.docs.map(todo => ({
          ...todo,
          createdAt: todo.createdAt ? formatTime(new Date(todo.createdAt)) : '' // 格式化创建时间为 mm-dd hh:mm
        }));

        // 对 todos 进行排序：未完成的在顶部，已完成的在底部
        const sortedTodos = todos.sort((a, b) => a.completed - b.completed);
        this.setData({ todos: sortedTodos });
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

  showSubscribeModal() {
    this.setData({ showSubscribeModal: true }); // 显示订阅弹窗
  },

  requestSubscribeMessage() {
    wx.requestSubscribeMessage({
      tmplIds: ['14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I'], // 替换为你的订阅消息模板ID
      success: (res) => {
        if (res['14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I'] === 'accept') {
        console.log('订阅成功', res);

          // 调用云函数保存用户订阅信息
        wx.cloud.callFunction({
            name: 'saveSubscription',
            data: {
              templateId: '14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I' // 订阅的模板 ID
          },
            success: res => {
              console.log('订阅信息保存成功：', res.result);
            },
            fail: err => {
              console.error('订阅信息保存失败：', err);
            }
      });
        } else {
          console.log('用户拒绝订阅消息');
        }
        this.setData({ showSubscribeModal: false }); // 关闭弹窗
  },
      fail: (err) => {
        console.error('订阅失败', err);
        this.setData({ showSubscribeModal: false }); // 关闭弹窗
      }
    });
  },

  closeSubscribeModal() {
    this.setData({ showSubscribeModal: false }); // 用户取消订阅时关闭弹窗
  },

  addTodo() {
    const db = wx.cloud.database();
    const newTodo = {
      text: this.data.newTodo,
      completed: false,
      createdAt: new Date() // 添加创建时间
    };
    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('待办事项添加成功', res);
        this.setData({ newTodo: '' });
      },
      fail: err => {
        console.error('待办事项添加失败', err);
      }
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