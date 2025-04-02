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
  },

  onLoad() {
        wx.cloud.callFunction({
      name: 'login',
            success: res => {
        this.setData({ userId: res.result.openid }); // 设置页面级别的 userId
        console.log('用户登录成功，userId:', res.result.openid);

        // 确保登录成功后再启动实时监听器
    this.loadTodosFromCache(); // 优先加载缓存数据
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
    const isPersonalMode = this.data.isPersonalMode; // 获取当前模式

    const fetchItemKeys = isPersonalMode
        ? this.fetchOrCreateUserDocument(this.data.userId).then(userDoc => userDoc.itemKeys || [])
        : Promise.resolve([]); // 公共模式直接返回空数组

    fetchItemKeys.then(itemKeys => {
        if (this.data.watcher) {
            this.data.watcher.close();
            this.setData({ watcher: null }); // 清除当前 watcher
        }

        const watcher = db.collection('todos')
            .where(isPersonalMode
                ? { itemKey: db.command.in(itemKeys) } // 个人模式匹配 itemKey 在 itemKeys 中的项目
                : { itemKey: db.command.exists(false) }) // 公共模式匹配 itemKey 不存在的项目
            .watch({
                onChange: snapshot => {
                    const todos = snapshot.docs.map(todo => ({
                        ...todo,
            createdAt: todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '',
        date: todo.dueDate ? formatDate(new Date(todo.dueDate), 'YY-MM-DD') :
                  todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '无日期',
        }));

                    const groupedTodos = todos.reduce((acc, todo) => {
            const dateKey = todo.date;
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(todo);
            return acc;
        }, {});

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

                    this.setData({ groupedTodos: sortedGroups, isLoading: false });
        wx.setStorageSync('todos', sortedGroups); // 缓存数据
                    wx.hideLoading(); // 隐藏加载动画
},
                onError: err => {
                    console.error('监听失败', err);
                    wx.hideLoading(); // 隐藏加载动画
                    this.reconnectWatcher(); // 自动重连
                }
    });

        this.setData({ watcher });
    }).catch(err => {
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

  // 修改：添加待办事项时同步更新 users 表的 itemKeys
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
    }

    // 数据库操作
    db.collection('todos').add({
      data: newTodo,
      success: res => {
        console.log('待办事项添加成功', res);
            const addedTodoId = res._id;

            // 更新 UI 中的 _id
            const updatedGroupedTodos = [...this.data.groupedTodos];
            const groupIndex = updatedGroupedTodos.findIndex(group => group.date === newTodo.date);
            if (groupIndex !== -1) {
                updatedGroupedTodos[groupIndex].items.push({ ...newTodo, _id: addedTodoId });
    } else {
                updatedGroupedTodos.push({ date: newTodo.date, items: [{ ...newTodo, _id: addedTodoId }] });
            }
            this.setData({ groupedTodos: updatedGroupedTodos, newTodo: '' });

            // 同步更新 users 表的 itemKeys
            if (this.data.isPersonalMode) {
                db.collection('users').doc(this.data.userId).update({
                    data: {
                        itemKeys: db.command.addToSet(newTodo.itemKey), // 添加新的 itemKey
},
                }).then(() => {
                    console.log('用户 itemKeys 更新成功');
                }).catch(err => {
                    console.error('用户 itemKeys 更新失败', err);
    });
            }
},
        fail: err => {
            console.error('待办事项添加失败', err);
        }
    });
},

  // 修改：添加已完成的待办事项时同步更新 users 表的 itemKeys
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

    if (labelDate !== '无日期') {
        const dateParts = labelDate.split('-');
        if (dateParts.length === 3) {
            const year = 2000 + parseInt(dateParts[0]);
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
    if (this.data.isPersonalMode) {
        const itemKey = `${Date.now()}_${this.data.userId}`;
        newTodo.itemKey = itemKey;
    }

    // 数据库操作
    db.collection('todos').add({
        data: newTodo,
        success: res => {
            console.log('已完成事项添加成功', res);
            const addedTodoId = res._id;

            // 更新 UI 中的 _id
            const updatedGroupedTodos = [...this.data.groupedTodos];
            const groupIndex = updatedGroupedTodos.findIndex(group => group.date === newTodo.date);
            if (groupIndex !== -1) {
                updatedGroupedTodos[groupIndex].items.push({ ...newTodo, _id: addedTodoId });
    } else {
                updatedGroupedTodos.push({ date: newTodo.date, items: [{ ...newTodo, _id: addedTodoId }] });
            }
            this.setData({
                groupedTodos: updatedGroupedTodos,
                completedInput: '',
                activeDate: null
            });

            // 同步更新 users 表的 itemKeys
            if (this.data.isPersonalMode) {
                db.collection('users').doc(this.data.userId).update({
                    data: {
                        itemKeys: db.command.addToSet(newTodo.itemKey), // 添加新的 itemKey
},
                }).then(() => {
                    console.log('用户 itemKeys 更新成功');
                }).catch(err => {
                    console.error('用户 itemKeys 更新失败', err);
                });
            }
},
        fail: err => {
            console.error('已完成事项添加失败', err);
        }
    });
},

  // 新增：处理日期选择
  onDateChange(e: any) {
    const selectedDate = formatDate(new Date(e.detail.value), 'YY-MM-DD'); // 转换为 YY-MM-DD 格式
        this.setData({
      globalDueDate: selectedDate, // 更新页面级别的完成日期
      showDatePicker: false,
    });
},

  // 新增：将日期字符串转换为 Date 对象
  getDateFromString(dateString: string): Date {
    if (dateString === '无日期') return new Date();
    const [month, day] = dateString.split('-');
    const year = new Date().getFullYear();
    return new Date(year, parseInt, parseInt(day));
},

  // 新增：显示日期选择器
  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  // 新增：隐藏日期选择器
  hideDatePicker() {
    this.setData({ showDatePicker: false });
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

    // 数据库操作
    db.collection('todos')
        .doc(id)
        .remove()
        .then(() => {
            console.log('待办事项删除成功');
            // 更新 UI
            const updatedGroupedTodos = this.data.groupedTodos.map(group => ({
                ...group,
                items: group.items.filter(todo => todo._id !== id),
            })).filter(group => group.items.length > 0);
            this.setData({ groupedTodos: updatedGroupedTodos });
        })
        .catch(err => {
            console.error('删除待办事项失败', err);
        });
},

  // 修改：切换完成状态
  toggleTodo(e: any) {
    const id = e.currentTarget.dataset.id;
    const db = wx.cloud.database();

    // 数据库操作
    db.collection('todos')
        .doc(id)
        .update({
            data: { completed: !updatedGroupedTodos.find(group => group.items.some(todo => todo._id === id)).items.find(todo => todo._id === id).completed },
        })
            .then(() => {
            console.log(`待办事项 ${id} 状态更新成功`);
            })
            .catch(err => {
            console.error('更新待办事项失败', err);
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

    // 关闭当前监听
    if (this.data.watcher) {
        this.data.watcher.close();
        this.setData({ watcher: null }); // 清除当前 watcher
    }

    // 重新启动监听
    this.fetchOrCreateUserDocument(this.data.userId).then(() => {
    this.startRealtimeListener();
        wx.hideLoading(); // 隐藏加载动画
    }).catch(err => {
        console.error('切换模式时查询或创建用户文档失败', err);
                wx.hideLoading(); // 隐藏加载动画
            });
},

  refreshTodos() {
    const db = wx.cloud.database();
    const isPersonalMode = this.data.isPersonalMode;
    const MAX_LIMIT = 20; // 每次查询的最大条数
    let allTodos: any[] = []; // 用于存储所有查询结果

    const fetchTodos = async (itemKeys: string[], skip = 0) => {
        try {
            const res = await db.collection('todos')
                .where(isPersonalMode
                    ? { itemKey: db.command.in(itemKeys) } // 个人模式匹配 itemKey 在 itemKeys 中的项目
                    : { itemKey: db.command.exists(false) }) // 公共模式匹配 itemKey 不存在的项目
                .skip(skip) // 跳过前 skip 条数据
                .limit(MAX_LIMIT) // 每次查询最多 MAX_LIMIT 条数据
                .get();

            allTodos.push(...res.data); // 合并查询结果

            if (res.data.length === MAX_LIMIT) {
                // 如果本次查询返回的数据条数达到 MAX_LIMIT，说明可能还有更多数据
                await fetchTodos(itemKeys, skip + MAX_LIMIT); // 递归查询下一页数据
            }
        } catch (err) {
            console.error('查询待办事项失败', err);
            throw err; // 抛出错误以便在调用处捕获
        }
    };

    wx.showLoading({ title: '加载中...' }); // 显示加载动画

    if (isPersonalMode) {
        // 个人模式：先查询或创建用户文档获取 itemKeys
        this.fetchOrCreateUserDocument(this.data.userId)
            .then(userDoc => {
                const itemKeys = userDoc.itemKeys || []; // 获取用户的 itemKeys
                return fetchTodos(itemKeys); // 查询 todos 表
            })
            .then(() => {
                this.processTodos(allTodos); // 处理并展示 todos
                wx.hideLoading(); // 隐藏加载动画
            })
            .catch(err => {
                console.error('个人模式查询失败', err);
                wx.hideLoading(); // 隐藏加载动画
            });
    } else {
        // 公共模式：直接查询 todos 表
        fetchTodos([])
            .then(() => {
                this.processTodos(allTodos); // 处理并展示 todos
                wx.hideLoading(); // 隐藏加载动画
            })
            .catch(err => {
                console.error('公共模式查询失败', err);
                wx.hideLoading(); // 隐藏加载动画
            });
    }
},

processTodos(todos: any[]) {
    const formattedTodos = todos.map(todo => ({
            ...todo,
        _id: todo._id || '', // 确保 _id 存在
            createdAt: todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '',
        date: todo.dueDate ? formatDate(new Date(todo.dueDate), 'YY-MM-DD') :
                  todo.createdAt ? formatDate(new Date(todo.createdAt), 'YY-MM-DD') : '无日期',
        }));

    const groupedTodos = formattedTodos.reduce((acc, todo) => {
            const dateKey = todo.date;
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(todo);
            return acc;
        }, {});

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
        wx.setStorageSync('todos', sortedGroups); // 缓存数据
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
});
