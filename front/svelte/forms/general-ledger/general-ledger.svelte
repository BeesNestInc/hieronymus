<FrontCover
	title="総勘定元帳"
  {fy}
  {company}
  ></FrontCover>
{#if accountPages}
<AccountPage
	title="総勘定元帳"
  {fy}
  {company}
  {accountPages}
  ></AccountPage>
{#each ledgerPages as ledgerPage}
<LedgerPage
  {fy}
  {company}
	title="総勘定元帳"
  {ledgerPage}
  ></LedgerPage>
{/each}
{/if}
<script>
import AccountPage from '../components/account-page.svelte';
import FrontCover from '../components/front-cover.svelte';
import LedgerPage from '../components/ledger-page.svelte';

export let fy;
export let company;
export let accountPages;
export let ledgerPages;

</script>