<ul class="page-subtitle nav">
  {#each fields as field, index}
  <li class="nav-item dropdown pe-2">
    <button type="button" class="btn btn-outline-primary dropdown-toggle" id="field_{index}" rolw="button" data-bs-toggle="dropdown" aria-expanded="false">
      {field.title}
    </button>
    <ul class="dropdown-menu" aria-labelledby="field_{index}">
      {#each field.accounts as account}
      <li>
        <button type="button" class="dropdown-item btn btn-link"
          on:click={() => {
            select(account.code);
          }}>{account.name}</button>
      </li>
      {/each}
    </ul>
  </li>
  {/each}
</ul>
<script>
import {createEventDispatcher} from 'svelte';

const dispatch = createEventDispatcher();

export let fields;

const select = (code) => {
  dispatch('select', {
    code: code
  });
}

</script>