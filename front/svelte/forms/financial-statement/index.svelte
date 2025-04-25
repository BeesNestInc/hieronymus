{#if sgaPage}
<FinancialStatement
  {fy}
  {company}
  {bsLines}
  {plOut}
  {sgaPage}
  {sgaSum}
  {asset}
  {liabilities}
  {networth}
  ></FinancialStatement>
{:else}
  <p>読み込み中...</p>
{/if}
<script>
import { onMount } from 'svelte';
import myCompany from '../../../../libs/my-company.js';
import initializeFinancialStatement from '../../../../libs/init-financial-statement.js';

import FinancialStatement from './financial-statement.svelte';

export let term;

const formatMonth = (date) => {
  return `${date.year}年${date.month}月`;
};

let fy;
let company = {};
let bsLines;
let plOut;
let sgaPage;
let asset;
let liabilities;
let networth;
let sgaSum;

onMount(async () => {
  company = await myCompany();
  console.log({company});
  ({fy, bsLines, plOut, sgaPage, asset, liabilities, networth, sgaSum} = await initializeFinancialStatement(term));
});

</script>