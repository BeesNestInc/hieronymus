<script>
import { onMount } from 'svelte';
import EstimateView from './estimate.svelte';
import company from '../../../../config/company.js';

export let id;

console.log('params:', id);
let transaction;
  
onMount(async () => {
  const res = await fetch(`/api/transaction/${id}`);
  const data = await res.json();
  transaction = data.transaction;
});
</script>
  
{#if transaction }
  <EstimateView {transaction} {company} />
{:else}
  <p>読み込み中...</p>
{/if}
  