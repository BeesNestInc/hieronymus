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
  <div class="full-height-2 fontsize-12pt">
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
