<script>
import { onMount } from 'svelte';
import EstimateView from './estimate.svelte';
import myCompany from '../../../../libs/my-company.js';

export let id;

console.log('params:', id);

let transaction;
let company;
  
onMount(async () => {
  const res = await fetch(`/api/transaction/${id}`);
  const data = await res.json();
  transaction = data.transaction;
  company = await myCompany();
});
</script>
  
{#if transaction }
  <EstimateView {transaction} {company} />
{:else}
  <p>読み込み中...</p>
{/if}
  