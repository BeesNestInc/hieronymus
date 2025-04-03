{#if (column.type === 'text')}
<input type="text" style="{style}" class="w-100"
  bind:value={value}/>
{:else if (column.type === 'numeric')}
<input type="text" style="text-align:right;{style}" class="w-100"
  bind:value={value}/>
{:else if (column.type === 'checkbox')}
<input type="checkbox" style="{style}" class="w-100"
  bind:checked={value}/>
{:else if (column.type === 'dropdown')}
<select style="{style}" class="w-100"
  bind:value={value}>
  {#each column.source as source}
  <option value={source[0]}>{source[1]}</option>
  {/each}
</select>
{/if}
<script>
import { onMount, beforeUpdate } from "svelte";

export let value;
export let column;
export let style = "";

beforeUpdate(() => {
  //console.log('omni-input beforeUpdate', column)
})
</script>