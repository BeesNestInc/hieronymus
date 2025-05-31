{#if ( args[1] === 'forms')}
  {#if ( args[2] === 'transaction')}
    {#if ( args[3] === 'estimate')}
    <Estimate
      id={parseInt(args[4])}></Estimate>
    {:else if ( args[3] === 'invoice' )}
    <Invoice
      id={parseInt(args[4])}></Invoice>
    {:else if ( args[3] === 'receipt' )}
    <Receipt
      id={parseInt(args[4])}></Receipt>
    {/if}
  {:else if ( args[2] === 'explanatory_journal' )}
  <ExplanatoryJournal
    term={args[3]}></ExplanatoryJournal>
  {:else if ( args[2] === 'general_ledger' )}
  <GeneralLedger
    term={args[3]}></GeneralLedger>
  {:else if ( args[2] === 'subsidiary_ledger' )}
  <SubsidiaryLedger
    term={args[3]}></SubsidiaryLedger>
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

import Estimate from './estimate/index.svelte';
import Invoice from './invoice/index.svelte';
import Receipt from './receipt/index.svelte';

import ExplanatoryJournal from './explanatory-journal/index.svelte';
import GeneralLedger from './general-ledger/index.svelte';
import SubsidiaryLedger from './subsidiary-ledger/index.svelte';
import TrialBalance from './trial-balance/index.svelte';
import FinancialStatement from './financial-statement/index.svelte';

let args = [];

beforeUpdate(() => {
  args = location.pathname.split('/');
})
</script>