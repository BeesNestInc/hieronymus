<FrontCover
  title="残高試算表"
  {company}
  {fy}
  ></FrontCover>
{#if assetPages}
<Print
  {company}
  {fy}
  title="残高試算表"
  sub_title= "貸借対照表 資産の部"
  pages={assetPages}></Print>
{/if}
{#if liabilitiesAndCapitalPages}
<Print
  {company}
  {fy}
  title="残高試算表"
  sub_title="貸借対照表 負債・資本の部"
  pages={liabilitiesAndCapitalPages}></Print>
{/if}
{#if incomeStatementPages}
<Print
  {company}
  {fy}
  title="残高試算表"
  sub_title="損益計算書"
  pages={incomeStatementPages}></Print>
{/if}
<script>
import Print from './print.svelte';
import FrontCover from '../components/front-cover.svelte';

export let company;
export let fy;
export let assetPages;
export let liabilitiesAndCapitalPages;
export let incomeStatementPages;
</script>