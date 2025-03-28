export const formatTime = (date: Date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  return `${[month, day].map(formatNumber).join('-')} ${[hour, minute].map(formatNumber).join(':')}`; // 格式化为 mm-dd hh:mm
};
const formatNumber = (n: number) => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}
