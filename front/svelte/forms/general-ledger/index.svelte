{#if ledgerPages}
<GeneralLedger
  {company}
  {fy}
  {accountPages}
  {ledgerPages}
  ></GeneralLedger>
{:else}
<p>読み込み中...</p>
{/if}

<script>
import { onMount } from 'svelte';
import GeneralLedger from './general-ledger.svelte';
import myCompany from '../../../../libs/my-company.js';
import initializeGeneralLedger from '../../../../libs/init-general-ledger.js';

export let term;

let fy;
let company;
let ledgerPages;
let accountPages;

onMount(async () => {
  company = await myCompany();
  ({fy, accountPages, ledgerPages} = await initializeGeneralLedger(term));
  console.log({accountPages},{ledgerPages});
});
</script>