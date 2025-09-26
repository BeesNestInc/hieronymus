{#key count}
<svelte:component
  this={component}
  {toast}
  bind:status={status}/>
{/key}
<script>
import {currentPage, setRoutes, getStore, findRoute} from '../../javascripts/router.js';

export let routes;
export let toast;
export let status;

let beforePage;
let component;
let count;

setRoutes(routes);
$: {
  const page = $currentPage;
  console.log({page});
  if  ( beforePage !== page ) {
    const route = findRoute(routes, page);
    if  ( route ) {
      component = route.component;
    }
    count += 1;
    beforePage = page;
  }
}

</script>