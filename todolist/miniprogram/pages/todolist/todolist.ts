import { formatDate } from "../../utils/util";

Page({
  data: {
    todos: [],
    watcher: null,
    showSubscribeModal: false,
    activeDate: null,
    completedInput: '',
    showDatePicker: false, // 控制日期选择器显示
    selectedDate: formatDate(new Date()), // 默认选中当天
    minDate: formatDate(new Date()), // 最小日期
    globalDueDate: formatDate(new Date()), // 页面级别的完成日期
  },

  onLoad() {
    this.startRealtimeListener();
    // 绑定页面点击事件
    wx.getCurrentPages()[0].onTap = this.onPageTap.bind(this);
  },

  startRealtimeListener() {
    const db = wx.cloud.database();

    const watcher = db.collection('todos').watch({
      onChange: snapshot => {
        const todos = snapshot.docs.map(todo => ({
          ...todo,
          // 确保只返回 MM-DD 格式
          createdAt: todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '',
          // 修改：优先使用完成时间，如果没有则使用创建时间
          date: todo.dueDate ? formatDate(new Date(todo.dueDate), 'YY-MM-DD') : 
                todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '无日期'
        }));
        // 按天分组
        const groupedTodos = todos.reduce((acc, todo) => {
          const dateKey = todo.date;
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(todo);
          return acc;
        }, {});
        // 将分组后的数据转换为数组并排序
        const sortedGroups = Object.entries(groupedTodos)
          .sort(([dateA], [dateB]) => {
            if (dateA === '无日期') return 1;
            if (dateB === '无日期') return -1;
            return dateB.localeCompare(dateA);
          })
          .map(([date, items]) => ({
            date,
            items: items.sort((a, b) => a.completed - b.completed)
          }));
  
        this.setData({ groupedTodos: sortedGroups });
      },
      onError: err => {
        console.error('监听失败', err);
      }
    });
  
    this.setData({ watcher });
  },

  onUnload() {
    // 停止实时监听
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  onInputChange(e: any) {
    this.setData({ 
      newTodo: e.detail.value,
      activeDate: null, // 关闭标签输入框
      completedInput: '' // 清空已完成事项输入框
    });
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
    this.setData({ showSubscribeModal: false });
  },

  // 修改：处理日期标签的点击事件
  showAddCompletedInput(e: any) {
    const date = e.currentTarget.dataset.date;
    
    // 如果点击的是当前已激活的标签，则关闭输入框
    if (this.data.activeDate === date) {
      this.setData({
        activeDate: null,
        completedInput: ''
      });
      return;
    }

    // 如果是未来日期，则不允许点击
    if (date !== '无日期') {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 清除时间部分，只比较日期
  
      if (selectedDate > today) {
        wx.showToast({
          title: '不能为未来日期添加已完成事项',
          icon: 'none'
        });
        return;
      }
    }
  
    this.setData({
      activeDate: date,
      completedInput: ''
    });
  },

  // 新增：处理页面点击事件
  onPageTap(e: any) {
    // 如果点击的不是输入框区域，则关闭输入框
    if (!e.target.dataset.isInput) {
      this.setData({
        activeDate: null,
        completedInput: ''
      });
    }
  },

  // 新增：处理已完成事项的输入
  onCompletedInputChange(e: any) {
    this.setData({ completedInput: e.detail.value });
  },

  // 修改：添加已完成的待办事项
  addCompletedTodo() {
    if (!this.data.completedInput.trim()) return;
  
    const labelDate = this.data.activeDate;
    if (!labelDate) {
      wx.showToast({
        title: '请选择有效日期',
        icon: 'none'
      });
      return;
    }
  
    const db = wx.cloud.database();
    const newTodo: any = {
      text: this.data.completedInput,
      completed: true
    };
  
    // 如果不是“无日期”标签，则设置创建时间和完成时间
    if (labelDate !== '无日期') {
      // 确保日期格式正确
      const dateParts = labelDate.split('-');
      if (dateParts.length === 3) {
        const year = 2000 + parseInt(dateParts[0]); // yy 转换为 yyyy
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        
        const selectedDate = new Date(year, month, day);
        selectedDate.setHours(0, 0, 0, 0);
        
        if (isNaN(selectedDate.getTime())) {
          wx.showToast({
            title: '日期格式错误',
            icon: 'none'
          });
          return;
        }
        
        newTodo.createdAt = selectedDate;
        newTodo.dueDate = selectedDate;
        newTodo.date = formatDate(selectedDate);
      }
    }

    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('已完成事项添加成功', res);
        this.setData({
          completedInput: '',
          activeDate: null
        });
      },
      fail: err => {
        console.error('已完成事项添加失败', err);
      }
    });
  },

  // 新增：处理日期选择
  onDateChange(e: any) {
    const selectedDate = e.detail.value;

    const db = wx.cloud.database();
    const newTodo = {
      text: this.data.completedInput,
      completed: true,
      createdAt: new Date(selectedDate),
      date: formatDate(new Date(selectedDate))
    };

    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('已完成事项添加成功', res);
        this.setData({
          completedInput: '',
          activeDate: null,
          showDatePicker: false
        });
      },
      fail: err => {
        console.error('已完成事项添加失败', err);
      }
    });
  },

  // 新增：将日期字符串转换为 Date 对象
  getDateFromString(dateString: string): Date {
    if (dateString === '无日期') return new Date();
    const [month, day] = dateString.split('-');
    const year = new Date().getFullYear();
    return new Date(year, parseInt(month) - 1, parseInt(day));
  },

  // 新增：显示日期选择器
  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  // 新增：隐藏日期选择器
  hideDatePicker() {
    this.setData({ showDatePicker: false });
  },

  // 修改：添加待办事项
  addTodo() {
    if (!this.data.newTodo.trim()) return;

    const db = wx.cloud.database();
    const newTodo = {
      text: this.data.newTodo,
      completed: false,
      createdAt: new Date(), // 创建时间使用当前时间
      dueDate: new Date(this.data.globalDueDate), // 使用页面级别的完成日期
    };

    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('待办事项添加成功', res);
        this.setData({ newTodo: '' });
      },
      fail: err => {
        console.error('待办事项添加失败', err);
      },
    });
  },

  // 新增：处理日期选择
  onDateChange(e: any) {
    const selectedDate = e.detail.value;
    this.setData({
      globalDueDate: selectedDate, // 更新页面级别的完成日期
      showDatePicker: false,
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
  
    // 从 groupedTodos 中查找待办事项
    let todoToUpdate = null;
    for (const group of this.data.groupedTodos) {
      todoToUpdate = group.items.find(todo => todo._id === id);
      if (todoToUpdate) break;
    }
  
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