{#if ( status.current === 'login') }
<Login
  bind:current={status.current}></Login>
{:else if ( status.current === 'signup' ) }
<SignUp
  bind:current={status.current}></SignUp>
{/if}

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import axios from 'axios';

import Login from './login/login.svelte';
import SignUp from './login/signup.svelte';

export let term;

let status = {
  current: 'login'
}
let reply;
// ログイン系はSPA外の別バンドルのためここで直接付ける（会社名はログイン前なので付けない）
$: loginTitle = status.current === 'signup' ? 'アカウント登録::Hieronymus' : 'ログイン::Hieronymus';
$: if (typeof document !== 'undefined' && loginTitle) { document.title = loginTitle; }
onMount(() => {
  console.log('index onMount');
  status.pathname = location.pathname;
  axios.get('/api/user').then((res) => {
    status.user = res.data.user;
  });
})

beforeUpdate(() => {
  let args = location.pathname.split('/');
  console.log('index beforeUpdate', args);
  status.current = args[1];
  status = status;
})

</script>