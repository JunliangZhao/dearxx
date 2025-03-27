const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext(); // 获取用户的 openid

  try {
    // 检查用户是否已存在
    const user = await db.collection('subscriptions').where({
      openid: OPENID
    }).get();

    if (user.data.length > 0) {
      // 更新用户订阅信息
      await db.collection('subscriptions').where({
        openid: OPENID
      }).update({
        data: {
          templateId: event.templateId, // 更新订阅的模板 ID
          updatedAt: new Date() // 更新时间
        }
      });
    } else {
      // 新增用户订阅信息
      await db.collection('subscriptions').add({
        data: {
          openid: OPENID,
          templateId: event.templateId, // 保存订阅的模板 ID
          createdAt: new Date() // 创建时间
        }
      });
    }

    return {
      success: true,
      message: '订阅信息保存成功'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
