const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const db = cloud.database();

  async async function notifyUsers() {
    try {
    // 查询所有订阅的用户
    const subscriptions = await db.collection('subscriptions').get();

    // 推送消息给每个订阅用户
    const promises = subscriptions.data.map(async user => {
    return cloud.openapi.subscribeMessage.send({
        touser: user.openid, // 用户的 openid
        templateId: '14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I', // 更新后的模板 ID
        page: 'pages/todolist/todolist', // 跳转的页面
      data: {
            date4: { value: new Date().toLocaleString() }, // 日程时间
            thing5: { value: event.todo.text } // 日程标题
      }
    });
  });

    // 等待所有推送完成
    await Promise.all(promises);

    return {
      success: true,
      message: '消息推送成功'
};
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
  }

  return notifyUsers();
};
