<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>経費精算</h1>
    <button type="button" class="btn btn-primary"
	  on:click={() => {
	    dispatch('open', null);
	  }}
	  id="expense-entry">精算書入力&nbsp;<i class="bi bi-pencil-square"></i>
    </button>
  </div>
  <div class="full-height-2 fontsize-12pt scroll-table">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 120px;">
            提出日
          </th>
          <th scope="col" style="width: 120px;">
            提出者
          </th>
          <th scope="col" style="width: 180px;">
            取引先
          </th>
          <th scope="col">
            案件
          </th>
          <th scope="col">
            目的
          </th>
          <th scope="col" style="width: 120px;">
            金額
          </th>
          <th scope="col" style="width: 80px;">
            承認
          </th>
          <th scope="col" style="width: 100px;">
            会計処理
          </th>
        </tr>
      </thead>
      <tbody>
        {#each reports as report}
        <tr>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
                dispatch('open', report);
              }}>
              {formatDate(report.submittedAt)}
            </button>
            {#if ( hasLineWithoutVoucher(report) )}
            <i class="bi bi-exclamation-triangle text-danger"
              title="証憑が紐付いていない明細があります"></i>
            {/if}
          </td>
          <td>
            {report.submitter ? report.submitter.name : ''}
          </td>
          <td>
            {report.company ? report.company.name : ''}
          </td>
          <td>
            {report.task ? report.task.name : ''}
          </td>
          <td>
            {report.purpose || ''}
          </td>
          <td class="number">
            {total(report).toLocaleString()}
          </td>
          <td style="text-align:center;">
            {#if ( report.approvedAt )}
            <i class="bi bi-check-circle-fill text-success" title="承認済み"></i>
            {:else}
            <span class="text-warning">未承認</span>
            {/if}
          </td>
          <td>
            {#each ( report.crossSlips || [] ) as slip}
            <button type="button" class="btn btn-link"
              on:click|preventDefault={() => {
                openSlip(slip);
              }}>
              {slip.month}-{slip.no}
            </button>
            {/each}
            {#if ( canMerge && mergeMap[report.id] && mergeMap[report.id].length > 0 )}
            {#each mergeMap[report.id] as group}
            <div class="merge-panel" style="font-size:0.8rem;">
              <i class="bi bi-arrow-left-right me-1" title="同じ取引の出金仮の仮伝票が残っています。選ぶと精算書側の伝票に統合します"></i>
              出金仮の伝票:
              {#if ( group.candidates.length === 1 )}
              <button type="button" class="btn btn-sm btn-outline-warning py-0 px-1 my-0"
                disabled={busy}
                title="カード取り込みの仮伝票（{group.candidates[0].month}/{group.candidates[0].day}-{group.candidates[0].no}）をこの精算書の伝票（{group.month}-{group.no}）に統合します"
                on:click={() => { runMerge(group, group.candidates[0]); }}>
                {group.candidates[0].month}/{group.candidates[0].day}-{group.candidates[0].no} と統合
              </button>
              {:else}
              <select class="form-select form-select-sm d-inline-block w-auto py-0"
                bind:value={group.choice}>
                {#each group.candidates as c}
                <option value={c.slipId}>{c.month}/{c.day}-{c.no}</option>
                {/each}
              </select>
              <button type="button" class="btn btn-sm btn-outline-warning py-0 px-1 my-0"
                disabled={busy || !group.choice}
                title="選んだ仮伝票をこの精算書の伝票に統合します"
                on:click={() => { runMerge(group, group.candidates.find((c) => ( c.slipId === group.choice ))); }}>
                統合
              </button>
              {/if}
            </div>
            {/each}
            {/if}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
</style>

<script>
import axios from 'axios';
import {numeric, formatDate} from '../../../libs/utils';
import {onMount, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {link} from '../../javascripts/router.js';

export let status;
export let reports;
// 統合の結果や警告はトーストで出す（親からtoastインスタンスを受ける）
export let toast;

let busy = false;
// 自動統合できなかった出金仮の候補（精算書ごと）。会計権限のときだけ読む
let mergeGroups = [];
let mergeMap = {};
$: canMerge = status && status.user && status.user.accounting;
const loadMergeCandidates = async () => {
  mergeGroups = [];
  mergeMap = {};
  if ( !canMerge || !reports || reports.length === 0 ) {
    return;
  }
  try {
    const result = await axios.get('/api/expense_report/merge_candidates');
    mergeGroups = ( result.data && result.data.merges ) || [];
    mergeMap = {};
    for ( const group of mergeGroups ) {
      if ( !mergeMap[ group.reportId ] ) {
        mergeMap[ group.reportId ] = [];
      }
      mergeMap[ group.reportId ].push(group);
    }
  } catch (e) {
    // 権限や通信の問題は無視する（統合候補が無い扱いにする）
  }
};
// 出金仮の仮伝票を精算書側の伝票に統合する（OUT mergeの手動突合）。
// 終わったら一覧の再読込を促す（親にupdateイベントを出す）
const runMerge = async (group, candidate) => {
  if ( !group || !candidate ) {
    return;
  }
  if ( !window.confirm(`カード取り込みの仮伝票（${candidate.month}/${candidate.day}-${candidate.no}）を精算書の伝票（${group.month}/${group.day}-${group.no}）に統合します。よろしいですか？`) ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/expense_report/${group.reportId}/merge_spend`, {
      expenseSlipId: group.expenseSlipId,
      placeholderSlipId: candidate.slipId
    });
    if ( result.data && result.data.code === 0 ) {
      toast.show('経費精算', `仮伝票（${candidate.month}/${candidate.day}-${candidate.no}）を統合しました`);
      await loadMergeCandidates();
      dispatch('update', {});
    } else {
      const message = ( result.data && result.data.message ) || '統合に失敗しました';
      toast.show('経費精算', message, 'warning');
    }
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '統合に失敗しました';
    toast.show('経費精算', message, 'warning');
  }
  busy = false;
};
$: reports, loadMergeCandidates();

const total = (report) => {
  return (report.lines || []).reduce((sum, line) => sum + numeric(line.amount), 0);
};

const hasLineWithoutVoucher = (report) => {
  return (report.lines || []).some((line) => numeric(line.amount) && !line.voucherId);
};

const openSlip = (slip) => {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  link(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${returnTo}`);
};

onMount(() => {
})
</script>
