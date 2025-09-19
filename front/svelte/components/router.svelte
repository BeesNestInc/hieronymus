{#key count}
<svelte:component
  this={component}
  {toast}
  bind:status={status}/>
{/key}
<script>
import {currentPage, setRoutes, getStore} from '../../javascripts/router.js';

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
    for ( const route of routes ) {
      if  ( page.match(route.match) ) {
        component = route.component;
        break;
      }
    }
    count += 1;
    beforePage = page;
  }
}

</script>