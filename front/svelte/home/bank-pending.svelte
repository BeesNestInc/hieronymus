{#if ( status.user.accounting )}
{#if ( total > 0 )}
<div class="card">
  <div class="card-header d-flex">
    <h3 class="card-title">通帳の対応待ち <span class="badge text-bg-primary ms-2" style="font-size:0.75rem;">{total}件</span></h3>
    <div class="ms-auto">
      <button type="button" class="btn" title="開閉します"
        on:click={() => { pendingMinimize = !pendingMinimize; }}>
        {#if pendingMinimize}
        <i class="bi bi-square"></i>
        {:else}
        <i class="bi bi-dash-square"></i>
        {/if}
      </button>
    </div>
  </div>
  {#if ( !pendingMinimize )}
  <div class="card-body">
    <div class="text-muted mb-1" style="font-size:0.8rem;">
      未照合（突合・起票待ち）と仮起票（実科目の伝票が入るのを待つ）の行です。行をクリックすると通帳へ移動します。
    </div>
 	  <div class="row scroll-table pending-scroll">
		  <table class="table table-bordered">
      <thead class="table-light">
        <th style="width:90px;">
          日付
        </th>
        <th>
          摘要
        </th>
        <th style="width:110px;" class="number">
          金額
        </th>
        <th style="width:80px;">
          状態
        </th>
        <th style="width:120px;">
          口座
        </th>
      </thead>
      <tbody>
        {#each lines as line (line.lineId)}
        <tr>
          <td>
            {formatDate(line.date)}
          </td>
          <td>
            <button type="button" class="btn btn-link btn-sm p-0 text-start"
              on:click|preventDefault={() => { openStatement(line.statementId); }}>
              {line.description || ''}
            </button>
          </td>
          <td class="number">
            {#if ( line.amountOut != null )}
            {numeric(line.amountOut).toLocaleString()}
            {:else}
            {numeric(line.amountIn).toLocaleString()}
            {/if}
          </td>
          <td>
            {#if ( line.kind === 'unmatched' )}
            <span class="badge bg-secondary" title="突合・起票されていません">未照合</span>
            {:else}
            <span class="badge bg-warning" title="仮入科目で起票されています。実科目の伝票（請求書等）を入力すると自動で差し替わります">仮起票</span>
            {/if}
          </td>
          <td>
            {line.financialName}
          </td>
        </tr>
        {/each}
        {#if ( lines.length === 0 )}
        <tr><td colspan="5" class="text-muted">読み込み中…</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
  </div>
  {/if}
</div>
{/if}
{/if}
<style>
/* 明細を約10行分に制限してスクロールさせる（承認待ちカードと同じ） */
.pending-scroll {
  max-height: 26rem;
}
</style>
<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {link} from '../../javascripts/router.js';
import {numeric, formatDate} from '../../../libs/utils.js';

export let status;
export let toast;

let total = -1;
let lines = [];
let pendingMinimize = false;

const openStatement = (id) => {
  link(`/bank-statement/${id}?returnTo=${encodeURIComponent('/home')}`);
}

const getPending = () => {
  axios.get('/api/bank_statement/pending').then((result) => {
    lines = ( result.data && result.data.values ) || [];
    total = ( result.data && result.data.total ) || 0;
  }).catch(() => {
    // 会計権限が無ければ403。カード自体を非表示にする
    total = 0;
  })
}

onMount(() => {
  if ( status.user && status.user.accounting ) {
    getPending();
  }
})
</script>
