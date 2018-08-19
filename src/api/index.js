const baseUrlRegexp = /^https?:\/\/[\w:\.]+/g
// const baseUrl = window.location.href.match(baseUrlRegexp)[0]

const baseUrl = "http://localhost:8080"
const AuthTokenHeader = "Access-Token"
import axios from 'axios'
import { setCookie, getCookie } from "@/utils"
import { resolve } from "dns";

let loadingInstance = null;
const initializeLoading = () => {
  loadingInstance = Loading.service({
    lock: true,
    text: interceptor.i18n.t("processing"),
    background: "rgba(255, 255, 255, 0.6)",
    customClass: "loading"
  });
}

export default {
  request(endpoint, data) {
    return new Promise((resolve, reject) => {
      axios({
        methods: endpoint.method,
        url: baseUrl + endpoint.url,
        data: data || endpoint.data,
        headers: {
          "Access-Token": 'userDefine',
        }
      }).then(res => {
        resolve(res.data)
      }, ({
        res = {
          data: null,
          status: 0
        }
      }) => {
          reject(res.data)
        })
    })
  }

}