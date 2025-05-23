import "@formkit/tempo";
const formatDate = (_date, lang) => {
  let date;
  if (_date) {
    if (typeof _date === "string") {
      date = new Date(_date);
    } else {
      date = _date;
    }
  } else {
    date = /* @__PURE__ */ new Date();
  }
  {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
};
const formatMoney = (_val) => {
  let val;
  if (_val) {
    if (typeof _val === "string") {
      val = parseInt(_val);
    } else {
      val = _val;
    }
    return `￥${val.toLocaleString()}`;
  } else {
    return "";
  }
};
const BANK_ACCOUNT_TYPE = [
  [0, "未設定"],
  [1, "普通"],
  [2, "当座"],
  [9, "その他"]
];
const taxClass = (tC) => {
  switch (tC) {
    case 0:
      return "非課税";
    case 1:
      return "内税";
    case 2:
      return "外税";
    case 9:
      return "別計算";
  }
  return "";
};
export {
  BANK_ACCOUNT_TYPE as B,
  formatDate as a,
  formatMoney as f,
  taxClass as t
};
