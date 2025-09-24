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
    window.history.pushState({ page: url }, "", url);
  } else {
    window.location.href = url;
  }
}
currentPage.subscribe(v => {
  console.log('router.js GLOBAL SUB fired:', v);
});

/*
export const _link = (url) => {
  //console.log('link', url);
  if  ( routes[url] ) {
    currentPage.set(url);
  } else {
    window.location.href = url;
  }
  window.history.pushState(null, "", url);
}
export const link = (url) => {
  return  (event) => {
		event.preventDefault();
    _link(url);
  }
}

export const preventDefault = (fn) => {
  return (event) => {
		event.preventDefault();
		fn.call(this, event);
	};
}
*/