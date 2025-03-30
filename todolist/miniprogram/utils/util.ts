export const formatTime = (date: Date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  return `${[month, day].map(formatNumber).join('-')} ${[hour, minute].map(formatNumber).join(':')}`; // 格式化为 mm-dd hh:mm
};

export const formatDate = (date: Date) => {
  const year = date.getFullYear().toString().slice(-2); // 获取年份后两位
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${[year, month, day].map(formatNumber).join('-')}`; // 格式化为 YY-MM-DD
};
const formatNumber = (n: number) => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}
