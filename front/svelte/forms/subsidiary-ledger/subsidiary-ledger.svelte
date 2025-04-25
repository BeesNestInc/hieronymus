<FrontCover
	title="補助元帳"
  {fy}
  {company}
  ></FrontCover>
{#each ledgerPages as ledgerPage}
<LedgerPage
  {fy}
  {company}
	title="補助元帳"
  {ledgerPage}
  ></LedgerPage>
{/each}
<script>
import FrontCover from '../components/front-cover.svelte';
import LedgerPage from '../components/ledger-page.svelte';

export let fy;
export let company;
export let ledgerPages;

</script>