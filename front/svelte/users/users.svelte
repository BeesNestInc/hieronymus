<div class="page-title d-flex justify-content-between">
  <h1>ユーザ一覧</h1>
</div> 
<UserList></UserList>

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import UserList from './user-list.svelte';

beforeUpdate(()	=> {
});
afterUpdate(() => {
})
</script>
