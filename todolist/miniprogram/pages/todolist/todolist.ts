import { formatDate } from "../../utils/util";

Page({
  data: {
    todos: [],
    groupedTodos: [],
    watcher: null,
    showSubscribeModal: false,
    activeDate: null,
    completedInput: '',
    showDatePicker: false, // 控制日期选择器显示
    selectedDate: formatDate(new Date(), 'YY-MM-DD'), // 默认选中当天
    minDate: formatDate(new Date(), 'YY-MM-DD'), // 最小日期
    globalDueDate: formatDate(new Date(), 'YY-MM-DD'), // 页面级别的完成日期
    isLoading: true, // 新增：加载状态
    collapsedState: {}, // 新增：折叠状态
    isPersonalMode: false, // 新增：个人模式状态
    userId: '', // 新增：页面级别的 userId
    itemKeys: [], // 新增：本地缓存的itemKeys
  },

  onLoad() {
        wx.cloud.callFunction({
      name: 'login',
            success: res => {
        this.setData({ userId: res.result.openid }); // 设置页面级别的 userId
        console.log('用户登录成功，userId:', res.result.openid);

        // 确保登录成功后再启动实时监听器

    this.loadCollapsedState(); // 加载折叠状态
    this.startRealtimeListener();
  },
            fail: err => {
        console.error('获取用户 ID 失败', err);
        wx.showToast({
          title: '登录失败，请检查网络或云开发配置',
          icon: 'none',
        });
      }
    });

    wx.onPageTap = this.onPageTap.bind(this); // 替代 wx.getCurrentPages()[0].onTap
  },

  // 优化：优先加载缓存数据
  loadTodosFromCache() {
    const cachedTodos = wx.getStorageSync('todos');
    if (cachedTodos) {
      this.setData({ groupedTodos: cachedTodos });
      }
  },

  // 优化：首次加载时显示加载动画
  startRealtimeListener() {
    wx.showLoading({ title: '加载中...' }); // 显示加载动画
    const db = wx.cloud.database();

    if (this.data.watcher) {
      this.data.watcher.close();
      this.setData({ watcher: null }); // 清除当前 watcher
    }

    // 获取用户的 itemKeys
    this.fetchOrCreateUserDocument(this.data.userId)
      .then(userDoc => {
        const itemKeys = userDoc.itemKeys || [];
        // 更新本地缓存的itemKeys
        this.setData({ itemKeys });

        const watcher = db.collection('todos').watch({
          onChange: snapshot => {
            const todos = snapshot.docs.map(todo => ({
              ...todo,
              createdAt: todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '',
              date: todo.dueDate ? formatDate(new Date(todo.dueDate), 'YY-MM-DD') :
                todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '无日期',
            }));

            // 使用本地缓存的itemKeys过滤个人模式数据
            const personalTodos = todos.filter(todo => this.data.itemKeys.includes(todo.itemKey));
            // 公共模式：不存在 itemKey 的待办事项
            const publicTodos = todos.filter(todo => !todo.itemKey);

            // 处理公共数据
            const groupedPublicTodos = publicTodos.reduce((acc, todo) => {
              const dateKey = todo.date;
              if (!acc[dateKey]) {
                acc[dateKey] = [];
              }
              acc[dateKey].push(todo);
              return acc;
            }, {});

            const sortedPublicGroups = Object.entries(groupedPublicTodos)
              .sort(([dateA], [dateB]) => {
                if (dateA === '无日期') return 1;
                if (dateB === '无日期') return -1;
                return dateB.localeCompare(dateA);
              })
              .map(([date, items]) => ({
                date,
                items: items.sort((a, b) => a.completed - b.completed)
              }));

            // 处理个人数据
            const groupedPersonalTodos = personalTodos.reduce((acc, todo) => {
              const dateKey = todo.date;
              if (!acc[dateKey]) {
                acc[dateKey] = [];
              }
              acc[dateKey].push(todo);
              return acc;
            }, {});

            const sortedPersonalGroups = Object.entries(groupedPersonalTodos)
              .sort(([dateA], [dateB]) => {
                if (dateA === '无日期') return 1;
                if (dateB === '无日期') return -1;
                return dateB.localeCompare(dateA);
              })
              .map(([date, items]) => ({
                date,
                items: items.sort((a, b) => a.completed - b.completed)
              }));

            // 将数据存储在内存中
            this.setData({
              publicTodos: sortedPublicGroups,
              personalTodos: sortedPersonalGroups,
              groupedTodos: this.data.isPersonalMode ? sortedPersonalGroups : sortedPublicGroups,
              isLoading: false
            });

            wx.hideLoading(); // 隐藏加载动画
          },
          onError: err => {
            console.error('监听失败', err);
            wx.hideLoading(); // 隐藏加载动画
            this.reconnectWatcher(); // 自动重连
          }
        });

        this.setData({ watcher });
      })
      .catch(err => {
        console.error('获取用户 itemKeys 失败', err);
        wx.hideLoading(); // 隐藏加载动画
        this.reconnectWatcher(); // 自动重连
      });
  },

  // 优化：自动重连实时监听
  reconnectWatcher() {
    setTimeout(() => {
      console.log('尝试重新连接实时监听...');
      this.startRealtimeListener();
    }, 5000); // 5秒后重连
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

  // 修改：添加待办事项
  addTodo() {
    if (!this.data.newTodo.trim()) return;
    const db = wx.cloud.database();
    const globalDueDateParts = this.data.globalDueDate.split('-');
    const year = 2000 + parseInt(globalDueDateParts[0]);
    const month = parseInt(globalDueDateParts[1]) - 1;
    const day = parseInt(globalDueDateParts[2]);
    const dueDate = new Date(year, month, day);

    if (isNaN(dueDate.getTime())) {
      wx.showToast({
        title: '完成日期格式错误',
        icon: 'none',
      });
      return;
    }

    const newTodo: any = {
      text: this.data.newTodo,
      completed: false,
      createdAt: new Date(),
      dueDate,
      date: this.data.globalDueDate,
    };

    if (this.data.isPersonalMode) {
      const itemKey = `${Date.now()}_${this.data.userId}`;
      newTodo.itemKey = itemKey;
      // 更新本地缓存的itemKeys
      this.setData({
        itemKeys: [...this.data.itemKeys, itemKey]
      });
    }

    // 先更新UI
    const updatedGroupedTodos = [...this.data.groupedTodos];
    const groupIndex = updatedGroupedTodos.findIndex(group => group.date === newTodo.date);
    if (groupIndex !== -1) {
      updatedGroupedTodos[groupIndex].items.push(newTodo);
    } else {
      updatedGroupedTodos.push({ date: newTodo.date, items: [newTodo] });
    }
    this.setData({ groupedTodos: updatedGroupedTodos, newTodo: '' });

    // 再同步数据库
    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('待办事项添加成功', res);
        // 更新UI中的_id
        const addedTodoId = res._id;
        const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
          ...group,
          items: group.items.map(item => 
            item === newTodo ? { ...item, _id: addedTodoId } : item
          ),
        }));
        this.setData({ groupedTodos: updatedGroupedTodos });

        // 同步更新users表的itemKeys
        if (this.data.isPersonalMode && newTodo.itemKey) {
          db.collection('users').doc(this.data.userId).update({
            data: {
              itemKeys: db.command.addToSet(newTodo.itemKey),
            },
            success: () => {
              console.log('itemKey 更新成功');
            },
            fail: err => {
              console.error('itemKey 更新失败', err);
              // 回滚本地缓存的itemKeys
              this.setData({
                itemKeys: this.data.itemKeys.filter(key => key !== newTodo.itemKey)
              });
            }
          });
        }
      },
      fail: err => {
        console.error('待办事项添加失败', err);
        // 回滚UI和本地缓存的itemKeys
        const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
          ...group,
          items: group.items.filter(item => item !== newTodo),
        }));
        this.setData({ 
          groupedTodos: updatedGroupedTodos,
          itemKeys: this.data.itemKeys.filter(key => key !== newTodo.itemKey)
        });
      }
    });
  },

  // 修改：删除待办事项
  deleteTodo(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      console.error('待办事项 ID 为空，无法删除');
      wx.showToast({
        title: '删除失败，ID 为空',
        icon: 'none',
      });
      return;
    }

    const db = wx.cloud.database();
    // 先更新UI
    const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
      ...group,
      items: group.items.filter(todo => todo._id !== id),
    })).filter(group => group.items.length > 0);
    this.setData({ groupedTodos: updatedGroupedTodos });

    // 再同步数据库
    db.collection('todos')
      .doc(id)
      .remove()
      .catch(err => {
        console.error('删除待办事项失败', err);
        // 回滚UI
        this.startRealtimeListener();
      });
  },

  // 修改：切换完成状态
  toggleTodo(e: any) {
    const id = e.currentTarget.dataset.id;
    const db = wx.cloud.database();

    // 找到待办事项
    const todo = this.data.groupedTodos
      .flatMap(group => group.items)
      .find(item => item._id === id);

    if (!todo) {
      console.error('未找到对应的待办事项');
      return;
    }

    // 先更新UI
    const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
      ...group,
      items: group.items.map(item => 
        item._id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
    this.setData({ groupedTodos: updatedGroupedTodos });

    // 再同步数据库
    db.collection('todos')
      .doc(id)
      .update({
        data: { completed: !todo.completed },
      })
      .catch(err => {
        console.error('更新待办事项失败', err);
        // 回滚UI
        this.startRealtimeListener();
      });
  },

  loadCollapsedState() {
    const collapsedState = wx.getStorageSync('collapsedState') || {};
    this.setData({ collapsedState });
},

  toggleCollapse(e: any) {
    const date = e.currentTarget.dataset.date;
    const collapsedState = { ...this.data.collapsedState };
    collapsedState[date] = !collapsedState[date];
    this.setData({ collapsedState });
    wx.setStorageSync('collapsedState', collapsedState); // 缓存折叠状态
  },

  toggleMode() {
      const isPersonalMode = !this.data.isPersonalMode; // 切换模式
      this.setData({ isPersonalMode }); // 更新模式状态
  
      wx.showLoading({ title: '切换中...' }); // 显示切换加载动画
      console.log
      // 从内存中获取数据，确保默认值为空数组
      const currentGroups = isPersonalMode ? 
        (this.data.personalTodos || []) : 
        (this.data.publicTodos || []);
      this.setData({ groupedTodos: currentGroups });
  
      wx.hideLoading(); // 隐藏加载动画
    },

// 新增：封装查询或创建用户文档的逻辑
fetchOrCreateUserDocument(userId: string): Promise<any> {
    const db = wx.cloud.database();
    return db.collection('users').doc(userId).get()
        .then(res => res.data)
        .catch(err => {
            
                console.warn('用户文档不存在，尝试创建新文档');
                return db.collection('users').doc(userId).set({
                    data: { itemKeys: [] }, // 初始化数据
                }).then(() => {
                    console.log('用户文档已创建');
                    return { itemKeys: [] }; // 返回默认值
                }).catch(createErr => {
                    console.error('创建用户文档失败', createErr);
                    throw createErr; // 抛出错误以便后续处理
                });
            
        });
    },
    onDateChange(e: any) {
      const selectedDate = e.detail.value;
      // 将日期格式化为 YY-MM-DD
      const formattedDate = formatDate(new Date(selectedDate));
      this.setData({
        globalDueDate: formattedDate
      });
      console.log('选择的日期:', formattedDate);
    },
  // 新增：处理已完成事项的提交
  addCompletedTodo() {
    const completedText = this.data.completedInput.trim();
    if (!completedText) {
      wx.showToast({
        title: '请输入已完成事项',
        icon: 'none'
      });
      return;
    }

    const db = wx.cloud.database();
    const newCompletedItem: any = {
      text: completedText,
      completed: true,
      createdAt: new Date(),
      date: this.data.activeDate
    };

    // 如果是个人模式，添加itemKey
    if (this.data.isPersonalMode) {
      const itemKey = `${Date.now()}_${this.data.userId}`;
      newCompletedItem.itemKey = itemKey;
      // 更新本地缓存的itemKeys
      this.setData({
        itemKeys: [...this.data.itemKeys, itemKey]
      });
    }

    // 先更新UI
    const updatedGroupedTodos = [...this.data.groupedTodos];
    const groupIndex = updatedGroupedTodos.findIndex(group => group.date === this.data.activeDate);
    if (groupIndex !== -1) {
      updatedGroupedTodos[groupIndex].items.push(newCompletedItem);
    } else {
      updatedGroupedTodos.push({ date: this.data.activeDate, items: [newCompletedItem] });
    }
    this.setData({ 
      groupedTodos: updatedGroupedTodos,
      completedInput: '',
      activeDate: null
    });

    // 再同步数据库
    db.collection('todos').add({
      data: newCompletedItem,
      success: res => {
        console.log('已完成事项添加成功', res);
        // 更新UI中的_id
        const addedId = res._id;
        const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
          ...group,
          items: group.items.map(item => 
            item === newCompletedItem ? { ...item, _id: addedId } : item
          ),
        }));
        this.setData({ groupedTodos: updatedGroupedTodos });

        // 如果是个人模式，同步更新users表的itemKeys
        if (this.data.isPersonalMode && newCompletedItem.itemKey) {
          db.collection('users').doc(this.data.userId).update({
            data: {
              itemKeys: db.command.addToSet(newCompletedItem.itemKey),
            },
            success: () => {
              console.log('itemKey 更新成功');
            },
            fail: err => {
              console.error('itemKey 更新失败', err);
              // 回滚本地缓存的itemKeys
              this.setData({
                itemKeys: this.data.itemKeys.filter(key => key !== newCompletedItem.itemKey)
              });
            }
          });
        }
      },
      fail: err => {
        console.error('已完成事项添加失败', err);
        // 回滚UI和本地缓存的itemKeys
        const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
          ...group,
          items: group.items.filter(item => item !== newCompletedItem),
        }));
        this.setData({ 
          groupedTodos: updatedGroupedTodos,
          itemKeys: this.data.itemKeys.filter(key => key !== newCompletedItem.itemKey)
        });
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        });
      }
    });
  },
});

