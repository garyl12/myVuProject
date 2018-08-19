import Vue from 'vue';

const dayMillisecond = 24 * 60 * 60 * 1000;
const numberRegexp = /^[+-]?\d+(\.\d+)?(e[+-]\d+)?$/;
const filters = {
  lookup: function (dictionary, key) {
    if (!key) return [];
    key = key.trim();
    let sourceOptions = (dictionary[key.replace(/global\./i, "")] || {}).childs;
    return (sourceOptions || []).map(item => {
      return {
        logicVal: item.value,
        displayVal: item.label
      };
    });
  },
  toDate: function (day) {
    var now = new Date().getTime();
    var millisecond = parseInt(day) * dayMillisecond + now;
    var reshapeDate = new Date(millisecond);
    var yy = reshapeDate.getFullYear();
    var mm = reshapeDate.getMonth() + 1;
    var dd = reshapeDate.getDate();
    return [(yy > 9 ? '' : '0') + yy, (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
  },
  decorateFieldName: function (name, displayFormat) {
    if (!displayFormat) return name;
    let unitDivisor = displayFormat.split(";")[2];
    if (unitDivisor.length) {
      let unit = unitDivisor.split("/")[0];
      if (unit.length && unit !== "hm") name += "(" + unit + ")";
    }
    return name;
  }
}

export default {
  register() {
    for (var filterName in filters) {
      Vue.filter(filterName, filters[filterName]);
    }
  }
}
