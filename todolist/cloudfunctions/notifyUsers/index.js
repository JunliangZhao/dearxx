const cloud = require('wx-server-sdk');
cloud.init({
  env: 'liangliang-env-4gitrna94bbe96fe' // 替换为你的环境 ID
});

exports.main = async (event, context) => {
  const db = cloud.database();

  async function notifyUsers() {
    try {
    const subscriptions = await db.collection('subscriptions').get();

    const promises = subscriptions.data.map(async user => {
    return cloud.openapi.subscribeMessage.send({
          touser: user.openid,
          templateId: '14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I',
          page: 'pages/todolist/todolist',
      data: {
            date4: { value: new Date().toLocaleString() },
            thing5: { value: event.todo.text },
          },
    });
  });

    await Promise.all(promises);

    return {
      success: true,
        message: '消息推送成功',
};
  } catch (error) {
    return {
      success: false,
        error: error.message,
    };
  }
  }

  return notifyUsers();
};
