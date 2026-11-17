import { writable,get } from "svelte/store";

const initialPage = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : undefined;
export let currentPage = writable(initialPage);

// 現在ページのパラメータ。
// - path: URLを'/'で分割した配列（ページ側の location.pathname.split('/') と
//   同じ並び。leading の空文字もそのまま）
// - query: クエリ文字列の URLSearchParams
// 各ページは location の直解析の代わりにこれを参照する
const [initialPath, initialQuery] = (initialPage || '').split('?');
export const pageParams = writable({
  path: ( initialPath || '' ).split('/'),
  query: new URLSearchParams(initialQuery || '')
});

export const getStore = get;

let routes;
export const setRoutes = (_routes) => {
  routes = _routes;
}

export const findRoute = (routes, page) => {
  let route;
  for ( const _route of routes ) {
    if  ( page.match(_route.match) ) {
      route = _route;
      break;
    }
  }
  return  (route);
}

export const _link = (url, options = {}) => {
  if (options.replace) {
    window.history.replaceState({ page: url }, "", url);
  } else {
    window.history.pushState({ page: url }, "", url);
    navCount += 1;
  }
  currentPage.set(url);
}

export const link = (url, options = {}) => {
  if  ( routes && findRoute(routes, url) ) {
    _link(url, options);
  } else {
    console.log('location.href', url);
    window.location.href = url;
  }
}

// アプリ内でのpushStateの回数（戻れるスタックの有無を知るために数える）。
// ページ再読込でリセットされる（深リンクで開いた場合はスタックが無い）
let navCount = 0;
export const canGoBack = () => ( navCount > 1 );

// 遷移スタックで戻る。アプリ内の履歴が無い（直リンク等）ときだけ
// フォールバック先へ遷移する。returnTo等の個別引き回しの代わりに使う
export const goBack = (fallbackUrl) => {
  if ( canGoBack() ) {
    window.history.back();
    return;
  }
  link(fallbackUrl);
}

// ブラウザの戻る/進むでもアプリが追従する（popstateでURLを再読み込みする）
if ( typeof window !== 'undefined' ) {
  window.addEventListener('popstate', () => {
    const page = window.location.pathname + window.location.search;
    currentPage.set(page);
  });
}

currentPage.subscribe((pageUrl) => {
  const [path, qs] = ( pageUrl || '' ).split('?');
  pageParams.set({
    path: ( path || '' ).split('/'),
    query: new URLSearchParams(qs || '')
  });
});

