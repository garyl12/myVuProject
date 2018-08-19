<template>
  <div class="wrapper clearfix">
    <div class="grid-container" ref="container"
      onselectstart="return false">
      <div v-show="gridData.length">
        <div class="buttons">
          <button-bar
            :padding-right="0"
            :buttons="buttons" />
        </div>
        <div class="first-row clearfix" v-if="headerRow">
          <div class="first-row-content" :style="{ width: width + 'px' }" ref="firstRow" >
            <div class="label-cell main">{{ $t_(headerRow) }}</div>
            <div class="cell" v-for="(d, index) in gridData" :key="index"  :title="d[headerRow].value" :style="{ width: columnWidth + 'px' }" >
              <span>{{ d[headerRow].value }}</span>
            </div>
          </div>
        </div>
        <div class="body" :style="{ height: this.bodyHeight + 'px'}" @scroll="scrollX" ref="body">
          <div v-for="(row, rowIndex) in rows" :key="rowIndex" v-if="!headerRow || headerRow !== row"
            :class="['row', 'clearfix', {'first-row': !headerRow && !rowIndex}]" :style="{ width: width + 'px' }" v-on:mouseover="toggleRemoveIcon(row,true)" v-on:mouseleave=toggleRemoveIcon(row,false)>
            <div :class="['label-cell',{'main':row.isMain}]" :title="$t_(row.attributeName)">
              {{ (row.isMain?$t_(row.attributeName):row.attributeName) }} 
            </div>
            <div v-for="(d, dIndex) in gridData" :key="dIndex" class="cell" :style="{ width: columnWidth + 'px' }"
              :title="(d[row.attributeName] || { value: '' }).value  | showLabel(row.attributeName,options)">
              <span v-show="!isEditing">{{ (d[row.attributeName] || { value: '' }).value | showLabel(row.attributeName,options) }}</span>
              <select class="selector" v-if="row.isSelector" v-show="isEditing" :value="d[row.attributeName].value" v-model="d[row.attributeName].value">
                  <option value=""></option>
                  <option v-for="(option,optionIndex) in (options[row.attributeName]||[])" :key="optionIndex"  :value="option.value" v-show="option.label!=='LnDF'||(riskGroupType=='IR')">{{option.label}}</option>
              </select>
              <input v-else v-show="isEditing" type="text" :class="[{'red':checkNumber((d[row.attributeName] || { value: '' }).value)}]"  v-model="(d[row.attributeName] || { value: '' }).value" ref="input">
            </div>
            <div class="btn-close" v-show="isEditing&&row.removeFlag"><span class="iconfont icon-close" @click="removeTerm(rowIndex,false)"></span></div>
          </div>
          <div v-show="newTerms.length">
            <div class="row clearfix" v-for="(newItem,nIndex) in newTerms" :key="nIndex"  :style="{ width: width + 'px' }"  v-on:mouseover="toggleRemoveIcon(newItem,true)" v-on:mouseleave=toggleRemoveIcon(newItem,false)>
              <div class="label-cell">
                <input type="text" v-model="newItem.term"  ref="term" @blur=translateTerm(newItem)>
              </div>
              <div v-for="(d, addIndex) in gridData" :key="addIndex"  class="cell" :style="{ width: columnWidth + 'px' }">
                  <input type="text" v-model="newItem[addIndex]" :class="[{'red':checkNumber(newItem[addIndex])}]" ref="input">
              </div>
              <div class="btn-close" v-show="isEditing&&newItem.removeFlag"><span class="iconfont icon-close" @click="removeTerm(nIndex,true)"></span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <resizer axis="x" @resize="resizeX" />
    <div class="section" ref="section">
      <tabs
      :tabs="curve.tabs"
      :active-index="curve.activeIndex"
      @click="activateTab"
      />
      <div class="panel" v-show="!curve.activeIndex">
        <vertical-grid
          :rows="termColumns"
          :data="termData"
          :isDataBean="true"
          key-row="Scenario ID"
          ref="termGrid"
          />
      </div>
      <div class="panel" v-show="curve.activeIndex">
        <div id="curveApp" ref="curve"></div>
      </div>
    </div>
    <alert :config="removeFactorConfirmation" />
    <alert :config="removeConfirmation" />
    <alert :config="alert" />
  </div>
</template>

<script>
const KEY_COLUMN_WIDTH = 100;
const COLUMN_MAIN_WIDTH = 100;
const ROW_HEIGHT = 20;
const BUTTON_BAR_HEIGHT = 42;
const MARGIN = 10;
const SIZES = {
  FACTOR_EDITOR_MIN_WIDTH: 300,
  FACTOR_TERM_MIN_WIDTH: 300
};
const KEYS = {
  SHOCK_VALUE: "Shock Value",
  SHOCK_TYPE: "Shock Type",
  SHOCK_UNIT: "Shock Unit",
  SHOCK_UNIT_TYPE: "Shock Unit Type",
  PARALLEL_VALUE: "Parallel Value",
  PARALLEL: "PARALLEL",
  SCENARIO_ID: "Scenario ID"
};

import ButtonBar from "@/components/common/ButtonBar";
import Alert from "@/components/common/Alert";
import Resizer from "@/components/common/Resizer";
import Tabs from "@/components/common/Tabs";
import VerticalGrid from "@/components/common/VerticalGrid";
import echarts from "echarts/dist/echarts.common.min.js";
import endpoints from "@/api/endpoints";
import processApiHelper from "@/utils/processApiHelper";
import csvParser from "@/utils/csvParser";
import { mapGetters } from "vuex";
import {
  SIZE,
  DATA_KEYS,
  DATA_TYPES,
  RESPONSE_CODE,
  CURVE_OPTION_PATTERN,
  CURVE_YAXIS_DATA_PATTERN
} from "@/consts";
import {
  merge,
  clone,
  isNumber,
  validateStandardTerm,
  convertStandardTermToDays,
  convertStandardTermToDate
} from "@/utils";
export default {
  name: "FactorEditor",
  components: {
    ButtonBar,
    Alert,
    Resizer,
    Tabs,
    VerticalGrid
  },
  props: {
    entry: {
      type: Object,
      require: true
    }
  },
  data() {
    return {
      rows: [],
      headerRow: "Scenario ID",
      isEditing: false,
      columnWidth: 0,
      isOverflowY: false,
      bodyHeight: 0,
      newTerms: [],
      gridData: [],
      termList: [],
      gridDataCopy: [],
      factors: [],
      removeInfo: null,
      curve: {
        tabs: ["Term Structure", "curve"],
        activeIndex: 0
      },
      curveApp: null,
      shockData: [],
      termColumns: [],
      termData: [],
      uniqueTerm: [],
      curveApp: null,
      alert: {
        visible: false,
        title: "warning",
        message: "",
        logs: [],
        buttons: [
          {
            title: "confirm",
            callback: () => {
              this.alert.visible = false;
            }
          }
        ]
      },
      removeConfirmation: {
        visible: false,
        title: "warning",
        message: "remove_confirmation",
        buttons: [
          {
            title: "confirm",
            callback: () => {
              this.removeConfirmation.visible = false;
              this.removeCurrentTerm();
            }
          },
          {
            title: "cancel",
            callback: () => {
              this.removeConfirmation.visible = false;
            }
          }
        ]
      },
      removeFactorConfirmation: {
        visible: false,
        title: "warning",
        message: "remove_confirmation",
        buttons: []
      },
      resizeHandler: function() {
        this.resizeEditGrid();
      }.bind(this)
    };
  },
  filters: {
    showLabel(value, attributeName, options) {
      let val = "";
      if (options[attributeName]) {
        options[attributeName].forEach(dict => {
          if (dict.value === value) val = dict.label;
        });
      } else {
        val = value;
      }
      return val;
    }
  },
  computed: {
    ...mapGetters({
      templates: "getTemplates",
      marketDate: "getMarketDate",
      dictionary: "getDicts"
    }),
    shockParameters(){

    },
    riskGroupType() {
      return this.entry ? this.entry.attributes["Risk Group Type"].value : null;
    },
    options() {
      return {
        "Shock Type": (this.dictionary[KEYS.SHOCK_TYPE] || { childs: [] })
          .childs,
        "Shock Unit": (this.dictionary[KEYS.SHOCK_UNIT_TYPE] || { childs: [] })
          .childs
      };
    },
    factorTemplate() {
      return this.templates[DATA_KEYS.FACTOR_TEMPLATE];
    },
    buttons() {
      return [
        {
          icon: "icon-bianji",
          active: !this.isEditing,
          text: "edit",
          callback: () => {
            this.isEditing = true;
            this.$emit("edit", { update: false, coverStatus: true });
          }
        },
        {
          icon: "icon-close1",
          text: "cancel",
          active: this.isEditing,
          callback: () => {
            this.isEditing = false;
            this.newTerms = [];
            this.gridData = clone(this.gridDataCopy);
            this.$emit("edit", { update: false, coverStatus: false });
          }
        },
        {
          icon: "icon-baocun",
          text: "save",
          active: this.isEditing,
          callback: () => {
            this.saveEditTerms();
          }
        },
        {
          icon: "icon-plus",
          text: "add",
          active: this.isEditing,
          callback: () => {
            this.newTerms.push({ term: "" });
          }
        }
      ];
    },
    width() {
      let width = 0;
      width += KEY_COLUMN_WIDTH;
      width += this.columnWidth * this.gridData.length;
      return width;
    }
  },
  watch: {
    gridData() {
      this.resizeEditGrid();
    },
    rows() {
      this.resizeEditGrid();
    }
  },
  mounted() {
    this.checkOverflowY();
    this.calculateWidth();
    this.bindWindowResize();
    this.curveApp = echarts.init(this.$refs.curve);
  },
  beforeDestroy() {
    this.unbindWindowResize();
  },
  methods: {
    resize() {
      this.resizeEditGrid();
      this.resetCurve();
      this.$refs.termGrid.resize();
    },
    
    reset() {
      this.termData = [];
      this.termColumns = [];
      this.newTerms = [];
      this.resetCurve();
    },
    load() {
      this.$nextTick(() => {
        this.initShockState();
      });
    },
    initShockState() {
      this.reset();
      let factorData = this.entry ? this.entry.scenarios : [];
      // set parallel value when type ='parallel'
      this.factors = factorData.map(factor => {
        if (factor.attributes[KEYS.SHOCK_TYPE].value === KEYS.PARALLEL) {
          factor.attributes[KEYS.PARALLEL_VALUE] = {
            value: factor.attributes[KEYS.SHOCK_VALUE].value.surfaceValue1D[0]
          };
        } else {
          factor.attributes[KEYS.PARALLEL_VALUE] = { value: "" };
        }
      });
      this.factors = this.entry ? this.entry.scenarios : [];
      this.newTerms = [];
      this.getGridData();
      this.getShockResult(this.factors, false);
    },
    saveEditTerms() {
      let isValidTerm = true,
        newTermObj = {},
        allTerms = clone(this.termList);
      // valid and no repeat;
      this.newTerms.forEach((item, i) => {
        let isRepeat = allTerms.some(term => {
          return (
            convertStandardTermToDays(term, this.marketDate) ===
            convertStandardTermToDays(item.term, this.marketDate)
          );
        });
        if (!validateStandardTerm(item.term) || isRepeat) {
          isValidTerm = false;
        } else {
          allTerms.push(item.term);
          newTermObj[item.term] = item;
        }
      });
      if (!isValidTerm) {
        this.alert.message = "Term :" + this.$t_("field_invalid_adding");
        this.alert.visible = true;
        return;
      }
      let isValidVal = this.$refs.input.some(vm => {
        return vm.value ? !isNumber(vm.value) : false;
      });
      if (isValidVal) {
        this.alert.message = "Value :" + this.$t_("field_invalid_adding");
        this.alert.visible = true;
        return;
      }
      // validate success ! then combine Data
      let editFactors = this.entry.scenarios;
      let orderedTerm = allTerms.sort((a, b) => {
        return convertStandardTermToDays(a) - convertStandardTermToDays(b);
      });
      let tipFlag = false,
        tipMsg = "required_parallel_value";
      this.gridData.forEach((scenarioItem, index) => {
        let surfaceValue1D = [],
          dimension = [],
          terms = [],
          relation = {};
        orderedTerm.forEach(term => {
          if (newTermObj[term]) {
            if (newTermObj[term][index]) {
              relation[term] = newTermObj[term][index];
            }
          } else {
            relation[term] = scenarioItem[term] ? scenarioItem[term].value : "";
          }
          dimension.push(term);
        });
        dimension.forEach((term, index) => {
          if (relation[term]) {
            surfaceValue1D.push(relation[term]);
            terms.push(term);
          }
        });
        if (scenarioItem[KEYS.SHOCK_TYPE].value === KEYS.PARALLEL) {
          if (!scenarioItem[KEYS.PARALLEL_VALUE].value) {
            tipFlag = true;
            scenarioItem[KEYS.SHOCK_VALUE] = { value: "" };
          } else {
            scenarioItem[KEYS.SHOCK_VALUE] = {
              value: {
                surfaceValue1D: [scenarioItem[KEYS.PARALLEL_VALUE].value] || [],
                dimensions: [{ dimension: ["SPOT"] }]
              }
            };
          }
        } else {
          scenarioItem[KEYS.SHOCK_VALUE] = {
            value: {
              surfaceValue1D: surfaceValue1D,
              dimensions: [{ dimension: terms }]
            }
          };
          scenarioItem[KEYS.PARALLEL_VALUE] = {
            value: ""
          };
        }
        editFactors[index].attributes[KEYS.SHOCK_UNIT] = {
          value: scenarioItem[KEYS.SHOCK_UNIT].value
        };
        editFactors[index].attributes[KEYS.SHOCK_TYPE] = {
          value: scenarioItem[KEYS.SHOCK_TYPE].value
        };
        editFactors[index].attributes[KEYS.SHOCK_VALUE] = {
          value: scenarioItem[KEYS.SHOCK_VALUE].value
        };
        editFactors[index].attributes[KEYS.PARALLEL_VALUE] = {
          value: scenarioItem[KEYS.PARALLEL_VALUE].value
        };
      });
      if (tipFlag) {
        this.alert.message = tipMsg;
        this.alert.visible = true;
        this.alert.title = "warning";
      } else {
        this.termList = allTerms;
        this.getShockResult(editFactors, true);
        this.getGridData(editFactors);
      }
    },
    getShockResult(editFactors, isSave) {
      //isSave: weather send delete Request or not
      let deleteFactors = [],
        updateFactors = [];
      //if factor's shock value  is null delete it  and save others;
      editFactors.forEach(factor => {
        if (
          !factor.attributes[KEYS.SHOCK_TYPE].value ||
          !factor.attributes[KEYS.SHOCK_UNIT].value
        ) {
          if (!factor.virtual && isSave) {
            //set a virtual value since it can't be empty when delete
            if (!factor.attributes[KEYS.SHOCK_TYPE].value)
              factor.attributes[KEYS.SHOCK_TYPE] = { value: "virtual" };
            if (!factor.attributes[KEYS.SHOCK_UNIT].value)
              factor.attributes[KEYS.SHOCK_UNIT] = { value: "virtual" };
            deleteFactors.push(factor);
          }
        } else {
          if (
            (factor.attributes[KEYS.SHOCK_TYPE].value === KEYS.PARALLEL &&
              factor.attributes[KEYS.PARALLEL_VALUE] &&
              factor.attributes[KEYS.PARALLEL_VALUE].value) ||
            (factor.attributes[KEYS.SHOCK_TYPE].value !== KEYS.PARALLEL &&
              factor.attributes[KEYS.SHOCK_VALUE].value.surfaceValue1D.length)
          ) {
            updateFactors.push(factor);
          } else {
            if (!factor.virtual && isSave) deleteFactors.push(factor);
          }
        }
      });
      if (deleteFactors.length) {
        let ids = deleteFactors
            .map(factor => factor.attributes[KEYS.SCENARIO_ID].value)
            .join(","),
          msg = ids + " " + this.$t_("remind_delete");
        this.removeFactorConfirmation.visible = true;
        this.removeFactorConfirmation.message = msg;
        this.removeFactorConfirmation.buttons = [
          {
            title: "confirm",
            callback: () => {
              this.removeFactorConfirmation.visible = false;
              this.calculateShockResult(deleteFactors, updateFactors);
            }
          },
          {
            title: "cancel",
            callback: () => {
              this.removeFactorConfirmation.visible = false;
              return;
            }
          }
        ];
      } else {
        this.calculateShockResult([], updateFactors);
      }
    },
    calculateShockResult(deleteFactors, updateFactors) {
      let deleteParameters = null,
        updateParameters = null,
        calculateParameters = null,
        deleteAction = null,
        updateAction = null;
      if (deleteFactors.length) {
        deleteFactors.forEach((item, index) => {
          if (index) {
            deleteParameters.inputData += csvParser.parseToCsvContent(
              item,
              this.factorTemplate
            );
          } else {
            deleteParameters = processApiHelper.getDeleteRequestData(
              item,
              this.factorTemplate,
              DATA_TYPES.SCENARIO
            );
          }
        });
      }
      // if update.length, send calculate request;
      // if calculate request success, send update and delete request; if success update editGrid Data、termGrid Data、InitCurve;
      // if noUpdate(need delete all shock), send delete request;
      if (updateFactors.length) {
        updateFactors.forEach((item, index) => {
          if (index) {
            updateParameters.inputData += csvParser.parseToCsvContent(
              item,
              this.factorTemplate
            );
            calculateParameters.inputData += csvParser.parseToCsvContent(
              item,
              this.factorTemplate
            );
          } else {
            updateParameters = processApiHelper.getUpdateRequestData(
              item,
              this.factorTemplate,
              DATA_TYPES.SCENARIO
            );
            calculateParameters = processApiHelper.getCalculateRequestData(
              item,
              this.factorTemplate,
              DATA_TYPES.SCENARIO
            );
          }
        });
        updateAction = this.$api.request(
          endpoints.processProduct,
          updateParameters
        );
        this.$api
          .request(endpoints.processProduct, calculateParameters)
          .then(({ code, data, messages }) => {
            if (code === RESPONSE_CODE.INFO) {
              let shockResult = data;
              //if  deleteData is exist, send request together else send update only;
              if (deleteAction) {
                Promise.all([deleteAction.updateAction]).then(
                  ([delRes, updateRes]) => {
                    if (
                      delRes.code === RESPONSE_CODE.INFO &&
                      updateRes.code === RESPONSE_CODE
                    ) {
                      this.newTerms = [];
                      this.shockData = shockResult;
                      this.isEditing = false;
                      this.createCurveData();
                      this.$emit("edit", { update: true, coverStatus: false });
                    } else {
                      this.alert.message = "";
                      this.alert.title = "error";
                      this.alert.logs = updateRes.messages.concat(
                        delRes.messages
                      );
                      this.alert.visible = true;
                    }
                  }
                );
              } else {
                this.$api
                  .request(endpoints.processProduct, updateParameters)
                  .then(({ code, data, messages }) => {
                    if (code === RESPONSE_CODE.INFO) {
                      this.newTerms = [];
                      this.shockData = shockResult;
                      this.isEditing = false;
                      this.createCurveData();
                      this.$emit("edit", { update: true, coverStatus: false });
                    } else {
                      this.alert.message = "";
                      this.alert.title = "error";
                      this.alert.logs = messages;
                      this.alert.visible = true;
                    }
                  });
              }
            } else {
              this.alert.message = "";
              this.alert.title = code;
              this.alert.log = messages;
              this.alert.visible = true;
            }
          });
      } else {
        if (deleteFactors.length) {
          this.$api
            .request(endpoints.processProduct, deleteParameters)
            .then(({ code, data, messages }) => {
              if (code === RESPONSE_CODE.INFO) {
                this.newTerms = [];
                this.shockData = [];
                this.isEditing = false;
                this.createCurveData();
                this.$emit("edit", { update: true, coverStatus: false });
              } else {
                this.alert.message = "";
                this.alert.title = "error";
                this.alert.logs = messages;
                this.alert.visible = true;
              }
            });
        } else {
          this.newTerms = [];
          this.shockData = [];
          this.createCurveData();
        }
      }
    },
    createCurveData() {
      let columns = [],
        data = [],
        series = [],
        terms = [],
        curveData = [],
        baseItem = clone(this.entry) || { attributes: {} };
      baseItem.attributes[KEYS.SCENARIO_ID] = { value: "Base Scenario" };
      curveData.push(baseItem);
      this.gridData.forEach(editFactor => {
        let flag = false;
        this.shockData.forEach(resFactor => {
          if (
            resFactor.attributes[KEYS.SCENARIO_ID].value ===
            editFactor[KEYS.SCENARIO_ID].value
          ) {
            flag = true;
            curveData.push(resFactor);
          }
        });
        //if shift item be delete,  replace it with baseItem
        if (!flag) {
          let item = clone(baseItem);
          item.attributes[KEYS.SCENARIO_ID] = editFactor[KEYS.SCENARIO_ID];
          if (item.attributes["Curve Value"].value)
            item.attributes["Curve Value"].value.surfaceValue1D = [];
          curveData.push(item);
        }
      });

      curveData.forEach(record => {
        let mapping = {},
          item = record.attributes["Curve Value"];
        if (item && item.value) {
          item.value.dimensions[0].dimension.forEach((term, index) => {
            terms.push(term);
            mapping[term] = item.value.surfaceValue1D[index] || "";
          });
          mapping[KEYS.SCENARIO_ID] = record.attributes[KEYS.SCENARIO_ID].value;
          data.push(mapping);
        }
      });
      //TODO: if terms are  standTerm only
      let uniqueTerm = terms.deduplicate().sort((a, b) => {
        return convertStandardTermToDays(a) - convertStandardTermToDays(b);
      });
      uniqueTerm.forEach(term => {
        columns.push({
          attributeName: term,
          displayName: term,
          displayFormat: "8;;"
        });
      });
      this.termColumns = columns;
      this.termData = data;
      this.resetCurve();
    },
    getGridData() {
      let termList = [],
        rows = [
          {
            attributeName: "Shock Unit",
            isSelector: true,
            isMain: true
          },
          {
            attributeName: "Shock Type",
            isSelector: true,
            isMain: true
          },
          {
            attributeName: "Parallel Value",
            isMain: true
          }
        ];
      let editData = [];
      this.factors.forEach(factor => {
        let editItem = {};
        editItem[KEYS.SCENARIO_ID] = factor.attributes[KEYS.SCENARIO_ID] || {
          value: ""
        };
        editItem[KEYS.SHOCK_UNIT] = factor.attributes[KEYS.SHOCK_UNIT] || {
          value: ""
        };
        editItem[KEYS.SHOCK_TYPE] = factor.attributes[KEYS.SHOCK_TYPE] || {
          value: ""
        };
        if (editItem[KEYS.SHOCK_TYPE].value === KEYS.PARALLEL) {
          editItem[KEYS.PARALLEL_VALUE] = {
            value:
              factor.attributes[KEYS.SHOCK_VALUE].value["surfaceValue1D"][0]
          };
        } else {
          editItem[KEYS.PARALLEL_VALUE] = factor.attributes[
            KEYS.PARALLEL_VALUE
          ] || {
            value: ""
          };
        }
        if (
          factor.attributes[KEYS.SHOCK_VALUE] &&
          factor.attributes[KEYS.SHOCK_VALUE].value
        ) {
          if (factor.attributes[KEYS.SHOCK_TYPE].value !== KEYS.PARALLEL) {
            let curveData = factor.attributes[KEYS.SHOCK_VALUE].value;
            curveData["dimensions"][0]["dimension"].forEach((term, index) => {
              termList.push(term);
              editItem[term] = { value: curveData["surfaceValue1D"][index] };
            });
          }
        }
        editData.push(editItem);
      });
      //TODO: How to choose "ON" value when term ="1D"(ignore it and  modify it when save)
      this.termList = termList.deduplicate().sort((a, b) => {
        return convertStandardTermToDays(a) - convertStandardTermToDays(b);
      });

      this.termList.forEach(term => {
        rows.push({
          attributeName: term,
          term
        });
        editData.forEach(item => {
          if (!item[term]) {
            item[term] = { value: "" };
          }
        });
      });
      this.rows = rows;
      this.gridDataCopy = editData;
      this.gridData = clone(editData);
    },
    toggleRemoveIcon(item, mouseIn) {
      if (!this.isEditing) return;
      if (item.isMain) return;
      if (mouseIn) {
        this.$set(item, "removeFlag", true);
      } else {
        this.$set(item, "removeFlag", false);
      }
    },
    removeTerm(index, isAdd) {
      this.removeConfirmation.visible = true;
      this.removeInfo = { rowIndex: index, inNew: isAdd };
    },
    removeCurrentTerm() {
      if (this.removeInfo.inNew) {
        this.newTerms.splice(this.removeInfo.rowIndex, 1);
      } else {
        //TODO: modify delete logic
        this.rows.splice(this.removeInfo.rowIndex, 1);
        this.termList.splice(this.removeInfo.rowIndex - 3, 1);
      }
    },
    translateTerm(col) {
      if (!isNaN(Number(col.term))) {
        col.term = col.term + "D";
      }
      col.term = col.term.toUpperCase();
    },
    checkNumber(val) {
      return val ? isNaN(Number(val)) : true;
    },
    activateTab({ tab, index }) {
      this.curve.activeIndex = index;
      this.$nextTick(() => {
        if (index) {
          this.resetCurve();
        } else {
          this.$refs.termGrid.resize();
        }
      });
    },
    resetCurve() {
      if (this.curveApp) {
        this.curveApp.dispose();
        this.curveApp = null;
      }
      this.curveApp = echarts.init(this.$refs.curve);

      let axisData = [];
      this.termColumns.forEach(col => {
        axisData.push(col.displayName);
      });

      let curveAppOption = clone(CURVE_OPTION_PATTERN),
        legendData = [];
      curveAppOption.xAxis.data = axisData;
      curveAppOption.xAxis.type = "category";
      this.termData.forEach(item => {
        var name = item[KEYS.SCENARIO_ID],
          data = [],
          yAxisData = clone(CURVE_YAXIS_DATA_PATTERN);

        legendData.push(name);
        axisData.forEach(term => {
          data.push(item[term] || "");
        });
        yAxisData.name = name;
        yAxisData.data = data;
        yAxisData.connectNulls = true;
        if (data.filter(val => val).length === 1) {
          yAxisData.symbolSize = 5;
          yAxisData.symbol = "circle";
        }
        curveAppOption.series.push(yAxisData);
      });
      curveAppOption.legend = {
        data: legendData,
        type: "scroll",
        left: "20px",
        right: "20px"
      };
      curveAppOption.tooltip.formatter = function(params) {
        return "Date: {0}<br/>Term: {1}<br/>{2}".format(
          convertStandardTermToDate(params[0].name, this.marketDate),
          params[0].name,
          params
            .map(item => "{0}:{1}".format(item.seriesName, item.value))
            .join("<br/>")
        );
      }.bind(this);
      this.curveApp.setOption(curveAppOption);
    },
    resizeEditGrid() {
      this.$nextTick(function() {
        this.checkOverflowY();
        this.calculateWidth();
      });
    },
    resizeX(offset) {
      //TODO: set min_width for factorsEditor
      let leftWidth = this.$refs.container.clientWidth,
        rightWidth = this.$refs.section.clientWidth,
        distance = Math.min(
          Math.max(SIZES.FACTOR_EDITOR_MIN_WIDTH - leftWidth, offset),
          rightWidth - SIZES.FACTOR_TERM_MIN_WIDTH
        );

      this.$refs.container.style.width = leftWidth + distance + "px";
      this.$refs.section.style.width = rightWidth - distance + "px";

      this.resizeEditGrid();
      this.$refs.termGrid.resize();
      if (this.curve.activeIndex) this.resetCurve();
    },
    bindWindowResize() {
      window.addEventListener("resize", this.resizeHandler);
    },
    unbindWindowResize() {
      window.removeEventListener("resize", this.resizeHandler);
    },
    scrollX() {
      if (this.headerRow) {
        this.$refs.firstRow.style.left = -this.$refs.body.scrollLeft + "px";
      }
    },
    calculateWidth() {
      let containerWidth = this.$refs.container.clientWidth;
      let columnWidth =
        (containerWidth -
          KEY_COLUMN_WIDTH -
          (this.isOverflowY ? SIZE.SCROLL_BAR_WIDTH : 0)) /
        this.gridData.length;
      this.columnWidth = Math.max(columnWidth, COLUMN_MAIN_WIDTH);
    },
    checkOverflowY() {
      this.isOverflowY =
        this.$refs.container.clientHeight - MARGIN * 2 <
        this.rows.length * ROW_HEIGHT;
      this.bodyHeight =
        this.$refs.container.clientHeight -
        (this.headerRow ? ROW_HEIGHT : 0) -
        BUTTON_BAR_HEIGHT;
    }
  }
};
</script>

<style scoped>
div {
  box-sizing: border-box;
  -moz-box-sizing: border-box;
  -webkit-box-sizing: border-box;
}
.wrapper {
  padding: 0 10px;
  height: 100%;
  overflow: hidden;
}
.buttons {
  height: 33px;
  line-height: 33px;
}
.grid-container,
.section {
  height: 100%;
  float: left;
  width: calc(50% - 4px);
  width: -ms-calc(50% - 4px);
  width: -moz-calc(50% - 4px);
  width: -webkit-calc(50% - 4px);
  box-shadow: 0 1px 3px 1px #777;
}
.body {
  overflow: auto;
}
select,
input {
  margin: 0;
  width: 99.6%;
  text-align: center;
}
input:focus {
  background-color: lightblue;
}
.label-cell,
.cell {
  float: left;
  text-align: center;
  min-width: 100px;
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  height: 20px;
  line-height: 18px;
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label-cell.main {
  background-color: #565c6b;
  color: #fff;
}
.first-row {
  position: relative;
  height: 20px;
  overflow: hidden;
}
.first-row-content {
  position: absolute;
}
.first-row .cell {
  border-top: 1px solid #ccc;
}
.row {
  position: relative;
}
.row:nth-child(odd) {
  background-color: #e9e7e7;
  color: #000;
}

.label-cell {
  width: 100px;
}
.btn-close {
  position: absolute;
  right: 0;
  top: 0;
  line-height: 18px;
  background: rgba(128, 128, 128, 0.5);
  width: 60px;
  text-align: center;
}
.btn-close .iconfont {
  cursor: pointer;
}
.h-drag {
  box-sizing: content-box;
  -moz-box-sizing: content-box;
  -webkit-box-sizing: content-box;
}
.panel {
  height: -webkit-calc(100% - 30px);
  height: -moz-calc(100% - 30px);
  height: -ms-calc(100% - 30px);
  height: -o-calc(100% - 30px);
  height: calc(100% - 30px);
}
#curveApp {
  height: 100%;
}
input.red {
  color: red;
}
</style>
