{#if ( args[1] === 'forms')}
  {#if ( args[2] === 'transaction')}
    {#if ( args[3] === 'estimate')}
    <Estimate
      id={parseInt(args[4])}></Estimate>
    {/if}
  {/if}
{/if}
<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';

import Estimate from './estimate/index.svelte';

let args = [];

beforeUpdate(() => {
  args = location.pathname.split('/');
})
</script>