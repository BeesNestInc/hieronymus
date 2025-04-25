{#if sgaPage}
<ExplanatoryJournal
  {fy}
  {company}
  {dates}
  ></ExplanatoryJournal>
{:else}
  <p>読み込み中...</p>
{/if}
<script>
import { onMount } from 'svelte';
import myCompany from '../../../../libs/my-company.js';
import initializeExplanatoryJournal from '../../../../libs/init-explanatory-journal.js';

import ExplanatoryJournal from './explanatory-journal.svelte';

export let term;

let fy;
let company;
let dates;

onMount(async () => {
  company = await myCompany();
  ({fy, dates} = await initializeExplanatoryJournal(term));
});

</script>