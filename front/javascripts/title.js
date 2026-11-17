import { writable } from "svelte/store";
import { findPage } from "./pages.js";

// 表示用に取得済みの値で上書きする場合に使う（タイトル用の新規fetchはしない）
// 例: メニューは表示用の menu.title をそのまま流用する
export const pageTitleDetail = writable(null);

// 各画面の見出し(h1)に合わせた基底名。routes の match と対になる
const baseTitles = [
  [/^\/login/, "ログイン"],
  [/^\/signup/, "アカウント登録"],
  [/^\/menu/, "メニュー"],
  [/^\/home/, "ホーム"],
  [/^\/journal/, "仕訳日記帳"],
  [/^\/slip/, "仕訳明細入力"],
  [/^\/ledger/, "元帳"],
  [/^\/bank-ledger/, "通帳元帳"],
  [/^\/bank-statement/, "通帳"],
  [/^\/trial-balance/, "残高試算表"],
  [/^\/changes/, "推移表"],
  [/^\/voucher/, "証憑"],
  [/^\/accounts/, "科目管理"],
  [/^\/company/, "取引先台帳"],
  [/^\/project/, "プロジェクト"],
  [/^\/expense/, "経費精算"],
  [/^\/karibarai/, "仮払金精算"],
  [/^\/task/, "案件"],
  [/^\/transaction/, "取引"],
  [/^\/item/, "品目"],
  [/^\/users/, "ユーザ"],
  [/^\/member/, "役職員"],
];

// URL の断片だけから作る詳細（区別用。DB読みはしない）
const parsePageUrl = (pageUrl) => {
  const url = new URL(pageUrl, "http://localhost");
  const args = url.pathname.split("/");
  return ({ args, params: url.searchParams });
};

const isNumeric = (value) => {
  return (value !== "" && !isNaN(Number(value)));
};

// 一覧/新規/ID の汎用詳細。args[2] が空なら一覧扱い
const genericDetail = (args) => {
  if  (!args[2]) {
    return ("一覧");
  } else
  if  (args[2] === "new") {
    return ("新規");
  } else
  if  (args[2] === "entry") {
    return (args[3] || "詳細");
  } else {
    return (args[3] ? `${args[2]}/${args[3]}` : args[2]);
  }
};

const journalDetail = (args) => {
  if  (isNumeric(args[2]) && isNumeric(args[3])) {
    return (`${args[2]}年${args[3]}月`);
  }
  return (genericDetail(args));
};

const slipDetail = (args, params) => {
  if  (args[2] === "new") {
    const year = params.get("year");
    const month = params.get("month");
    if  (isNumeric(year) && isNumeric(month)) {
      return (`新規 ${year}年${month}月`);
    }
    return ("新規");
  } else
  if  (isNumeric(args[2]) && isNumeric(args[3]) && isNumeric(args[4])) {
    return (`${args[2]}/${args[3]}-${args[4]}`);
  }
  return (genericDetail(args));
};

const bankStatementDetail = (args) => {
  if  (!args[2]) {
    return ("");
  }
  return (genericDetail(args));
};

const expenseDetail = (args) => {
  if  (!args[2]) {
    return ("一覧");
  } else
  if  (args[2] === "home" || args[2] === "unsorted" ||
       args[2] === "payee" || args[2] === "payment") {
    return (args[2]);
  }
  return (genericDetail(args));
};

const getUrlDetail = (pageUrl) => {
  const { args, params } = parsePageUrl(pageUrl);
  if  (pageUrl.match(/^\/journal/)) {
    return (journalDetail(args));
  } else
  if  (pageUrl.match(/^\/slip/)) {
    return (slipDetail(args, params));
  } else
  if  (pageUrl.match(/^\/bank-statement/)) {
    return (bankStatementDetail(args));
  } else
  if  (pageUrl.match(/^\/expense/)) {
    return (expenseDetail(args));
  }   else
  if  (pageUrl.match(/^\/(home|login|signup)/)) {
    return ("");
  } else
  if  (pageUrl.match(/^\/menu\/?(\?.*)?$/)) {
    return ("");
  }
  return (genericDetail(args));
};

export const getBaseTitle = (pageUrl) => {
  if  (!pageUrl) {
    return ("Hieronymus");
  }
  // 基底名は pages.js（module-list.js の title）から解決する。
  // タブタイトルの表をここで二重管理しない
  const found = findPage(pageUrl);
  if  ( found && found.title )  {
    // 通帳一覧は伝票指定の有無で呼び方が変わる（h1に合わせる）
    if  ( pageUrl.match(/^\/bank-statement\/\d+/) ) {
      return ("通帳");
    }
    return (found.title);
  }
  return ("Hieronymus");
};

// pageUrl: "/voucher/entry/123?..." 等、companyName: 取得済みの自社名、detailOverride: 表示用取得済み値
// 新規のfetchは行わず、手元の値だけで組み立てる
export const buildTitle = (pageUrl, companyName, detailOverride) => {
  const base = getBaseTitle(pageUrl);
  if  (base === "Hieronymus") {
    return (companyName ? `${companyName}::Hieronymus` : "Hieronymus");
  }
  const page = pageUrl || "";
  let detail = "";
  if  (page.match(/^\/menu/) && detailOverride) {
    detail = detailOverride;
  } else {
    try {
      detail = getUrlDetail(page);
    } catch (e) {
      console.log("buildTitle parse failed", e);
      detail = "";
    }
  }
  const head = detail ? `${base} ${detail}` : base;
  const companySuffix = companyName ? ` - ${companyName}` : "";
  return (`${head}${companySuffix}::Hieronymus`);
};
