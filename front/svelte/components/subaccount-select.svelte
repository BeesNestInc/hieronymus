<ul class="page-subtitle nav">
  {#each account.subAccounts as sub}
    <li class="nav-item pe-2">
      <button type="button"
        class="btn {sub.subAccountCode === sub_account_code ? ' btn-primary disabled' : 'btn-outline-primary'}"
        on:click={() => {
          select(account.accountCode, sub.subAccountCode);
        }}>
        {sub.name}
      </button>
    </li>
  {/each}
</ul>
<script>
import {createEventDispatcher} from 'svelte';

export let account;
export let sub_account_code;

const dispatch = createEventDispatcher();

const select = (code, sub) => {
  console.log('select');
  account = account;
  sub_account_code = sub;
  dispatch('select', {
    code: code,
    sub: sub
  });
}
</script>