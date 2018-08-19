const dayMilliseconds = 24 * 60 * 60 * 1000;
const specialTermPattern = /^[otsOTS][nN]|SPOT$/;
const numberTermPattern = /^[-+]?\d+(\.?\d*)?$/;
const numberWithStringTermPattern = /^[-+]?\d+(\.?\d*)?[dwmyDWMY]$/;

export const getDateTime = function (millisecond) {
  var date = new Date(parseInt(millisecond));
  var YY = date.getFullYear();
  var MM = date.getMonth() + 1;
  var DD = date.getDate();
  var hh = date.getHours();
  var mm = date.getMinutes();
  var ss = date.getSeconds();
  return [
    YY,
    (MM > 9 ? '' : '0') + MM,
    (DD > 9 ? '' : '0') + DD,
    (hh > 9 ? '' : '0') + hh,
    (mm > 9 ? '' : '0') + mm,
    (ss > 9 ? '' : '0') + ss
  ];
}

export const setCookie = function (c_name, value, expireDays) {
  var expireDate = new Date()
  expireDate.setDate(expireDate.getDate() + expireDays)
  document.cookie = c_name + "=" + escape(value) +
    ((expireDays == null) ? "" : ";expires=" + expireDate.toGMTString())
}

export const getCookie = function (c_name) {
  if (document.cookie.length > 0) {
    c_start = document.cookie.indexOf(c_name + "=")
    if (c_start != -1) {
      c_start = c_start + c_name.length + 1
      c_end = document.cookie.indexOf(";", c_start)
      if (c_end == -1) c_end = document.cookie.length
      return unescape(document.cookie.substring(c_start, c_end))
    }
  }
  return ""
}