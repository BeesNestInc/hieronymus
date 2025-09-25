{#if assetPages}
<TrialBalance
  {fy}
  {company}
  {assetPages}
  {liabilitiesAndCapitalPages}
  {incomeStatementPages}
  ></TrialBalance>
{:else}
  <p>読み込み中...</p>
{/if}
<script>
import { onMount } from 'svelte';
import myCompany from '../../../../libs/my-company.js';
import initializeTrialBalance from '../../../../libs/init-trial-balance.js';

import TrialBalance from './trial-balance.svelte';

export let term;

let fy;
let company;
let assetPages;
let liabilitiesAndCapitalPages;
let incomeStatementPages;

onMount(async () => {
  company = await myCompany();
  ({fy, assetPages, liabilitiesAndCapitalPages, incomeStatementPages} = await initializeTrialBalance(term));
})

</script>