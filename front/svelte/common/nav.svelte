<div class="container-fluid">
  <ul class="navbar-nav">
  </ul>
  <span class="havbar-text">
    {#if ( status.startDate && status.endDate )}
    第{status.term}期
    ({status.startDate.getFullYear()}年
    ({wareki(status.startDate)})
        {status.startDate.getMonth()+1}月
        {status.startDate.getDate()}日
    〜
    {status.endDate.getFullYear()}年
    ({wareki(status.endDate)})
        {status.endDate.getMonth()+1}月
        {status.endDate.getDate()}日)
    {:else}
      <span class="text-danger fw-bold"><i class="bi bi-exclamation-diamond-fill"></i>&nbsp; 会計年度を選択してください</span>
    {/if}
  </span>
  <ul class="navbar-nav ms-auto">
    <li class="nav-item dropdown">
      <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown" id="user_menu"
          role="button" aria-expanded="false">
        <span class="d-none d-md-inline">{status.user.name}</span>
      </a>
      <ul class="dropdown-menu"
          aria-labelledby="user_menu">
        <li>
          <a href="/logout" class="dropdown-item">Sign out</a>
        </li>
      </ul>
    </li>
  </ul>
</div>

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import {wareki} from '../../../libs/utils';

export let status;

beforeUpdate(() => {
});
</script>
