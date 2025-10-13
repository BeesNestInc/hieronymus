import { writable,get } from "svelte/store";

export let currentPage = writable();
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

export const link = (url, options = {}) => {
  console.log('link', url, options);
  if  ( findRoute(routes, url) ) {
    if (options.replace) {
      window.history.replaceState({ page: url }, "", url);
    } else {
      window.history.pushState({ page: url }, "", url);
    }
    currentPage.set(url);
  } else {
    window.location.href = url;
  }
}
currentPage.subscribe(v => {
  console.log('router.js GLOBAL SUB fired:', v);
});

