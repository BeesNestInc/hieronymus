{#if ( args[1] === 'forms')}
  {#if ( args[2] === 'transaction')}
    {#if ( args[3] === 'estimate')}
    <Estimate
      id={parseInt(args[4])}></Estimate>
    {:else if ( args[3] === 'invoice' )}
    <Invoice
      id=parseInt(args[4])></Invoice>
    {/if}
  {:else if ( args[2] === 'trial_balance' )}
    <TrialBalance
    term={args[3]}></TrialBalance>
  {:else if ( args[2] === 'financial_statement' )}
  <FinancialStatement
    term={args[3]}></FinancialStatement>
  {/if}
{/if}
<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';

import Estimate from './estimate/estimate.svelte';
import Invoice from './invoice/invoice.svelte';

import TrialBalance from './trial-balance/index.svelte';
import FinancialStatement from './financial-statement/index.svelte';

let args = [];

beforeUpdate(() => {
  args = location.pathname.split('/');
})
</script>