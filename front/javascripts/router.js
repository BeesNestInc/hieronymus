import { writable,get } from "svelte/store";

export let currentPage = writable();
export const getStore = get;

let routes;
export const setRoutes = (_routes) => {
  routes = _routes;
}
export const link = (url) => {
  console.log('link', url);
  if  ( routes[url] ) {
    currentPage.set(url);
  } else {
    window.location.href = url;
  }
  window.history.pushState(null, "", url);
}
