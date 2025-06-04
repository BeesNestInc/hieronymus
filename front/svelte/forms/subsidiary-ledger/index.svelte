{#if ledgerPages}
<SubsidiaryLedger
  {company}
  {fy}
  {ledgerPages}
  ></SubsidiaryLedger>
{:else}
<p>読み込み中...</p>
{/if}

<script>
import { onMount } from 'svelte';
import SubsidiaryLedger from './subsidiary-ledger.svelte';
import myCompany from '../../../../libs/my-company.js';
import initializeSubsidiaryLedger from '../../../../libs/init-subsidiary-ledger.js';

export let term;

let fy;
let company;
let ledgerPages;

onMount(async () => {
  company = await myCompany();
  ({fy, ledgerPages} = await initializeSubsidiaryLedger(term));
  console.log({ledgerPages});
});
</script>