const cloud = require('wx-server-sdk');

cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID, // 用户唯一标识
    appid: wxContext.APPID,   // 小程序的 AppID
    unionid: wxContext.UNIONID || null, // 用户在开放平台的唯一标识（需要绑定开放平台）
  };
};
