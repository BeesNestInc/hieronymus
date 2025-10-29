import { writable,get } from "svelte/store";

const initialPage = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : undefined;
export let currentPage = writable(initialPage);

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
    }
    currentPage.set(url);
}

export const link = (url, options = {}) => {
  console.log('link', url, options);
  if  ( routes && findRoute(routes, url) ) {
    _link(url, options);
  } else {
    console.log('location.href', url);
    window.location.href = url;
  }
}
currentPage.subscribe(v => {
  console.log('router.js GLOBAL SUB fired:', v);
});

