<div class="container-fluid">
  <ul class="navbar-nav">
  </ul>
  <span class="havbar-text">
    {#if ( status.fy.startDate && status.fy.endDate )}
    第{status.fy.term}期
    ({status.fy.startDate.getFullYear()}年
    ({wareki(status.fy.startDate)})
        {status.fy.startDate.getMonth()+1}月
        {status.fy.startDate.getDate()}日
    〜
    {status.fy.endDate.getFullYear()}年
    ({wareki(status.fy.endDate)})
        {status.fy.endDate.getMonth()+1}月
        {status.fy.endDate.getDate()}日)
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

</script>
