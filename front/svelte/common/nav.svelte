<div class="container-fluid">
  <ul class="navbar-nav">
  </ul>
  <span class="havbar-text">
    {#if ( status.fy.startDate && status.fy.endDate )}
    <div class="dropdown d-inline-block">
      <button type="button" class="btn btn-sm btn-outline-light dropdown-toggle"
        data-bs-toggle="dropdown" aria-expanded="false"
        title="処理する会計年度を切り替えます（取込・伝票入力はここで選んだ年度に行われます）">
        第{status.fy.term}期
        {#if ( status.fy.lockedAt )}
        <span class="badge bg-warning text-dark ms-1">確定済み</span>
        {/if}
      </button>
      <ul class="dropdown-menu">
        {#each fiscalYears as fy}
        <li>
          <a class="dropdown-item" href="/home/{fy.term}"
            on:click|preventDefault={() => { switchTerm(fy.term); }}>
            第{fy.term}期 {fyLabel(fy)}
            {#if ( fy.lockedAt )}<span class="badge bg-warning text-dark ms-1">確定済み</span>{/if}
          </a>
        </li>
        {/each}
      </ul>
    </div>
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
import axios from 'axios';
import {wareki} from '../../../libs/utils';

export let status;

// 期切替。セッションの処理年度を変える（サーバ側で /home/{term} が
// session.termを書き替える。フルリロードで全画面が新しい期で開く）
let fiscalYears = [];
onMount(async () => {
  try {
    const res = await axios.get('/api/term');
    fiscalYears = res.data.map((fy) => ({
      term: fy.term,
      startDate: new Date(fy.startDate),
      endDate: new Date(fy.endDate),
      lockedAt: fy.lockedAt
    }));
  } catch (e) {
    console.error('load fiscal years failed', e);
  }
});
const fyLabel = (fy) => {
  return `${fy.startDate.getFullYear()}/${fy.startDate.getMonth()+1}〜${fy.endDate.getFullYear()}/${fy.endDate.getMonth()+1}`;
};
const switchTerm = (term) => {
  window.location.href = `/home/${term}`;
};
</script>
