const state = {
  userInfo: {},
  loadState: false,
}

const mutations = {
  setUserInfo(state, val) {
    state.userInfo = val;
  },
  setLoadState(state, val) {
    state.isLoad = val
  }
}

const getters = {
  getUerInfo: state => state.userInfo,
  getLoadState: state => state.userInfo,
}


export default {
  state,
  mutations,
  getters
}