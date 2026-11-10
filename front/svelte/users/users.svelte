<div class="page-title d-flex justify-content-between">
  <h1>ユーザ一覧</h1>
</div>
{#if ( status.user && status.user.administrable )}
<UserList></UserList>
{:else}
<div class="alert alert-warning m-3">
  <i class="bi bi-exclamation-triangle-fill"></i>&nbsp;
  この画面を利用する権限がありません（管理者または人事管理権限が必要です）。
</div>
{/if}

<script>
import UserList from './user-list.svelte';

export let status;
</script>
