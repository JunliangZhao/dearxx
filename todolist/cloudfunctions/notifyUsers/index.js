const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const { todo } = event;
  const users = await cloud.database().collection('users').get(); // 获取所有用户
  const sendPromises = users.data.map(user => {
    return cloud.openapi.subscribeMessage.send({
      touser: user.openid,
      templateId: '14lu1h_J8fljME1O0ME1ecucn59dMQ84QvcSwF_M88I', // 替换为你的订阅消息模板ID
      page: 'pages/todolist/todolist', // 跳转页面
      data: {
        date4: { value: new Date().toLocaleString() }, // 日程时间
        thing5: { value: todo.text } // 日程标题
      }
    }).then(res => {
      console.log(`消息发送成功给用户 ${user.openid}:`, res);
    }).catch(err => {
      console.error(`消息发送失败给用户 ${user.openid}:`, err);
    });
  });
  return Promise.all(sendPromises);
};
