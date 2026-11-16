<div class="menu">
	<div class="body">
    {#if ( reports.length === 0 )}
    <div class="text-muted small p-2">承認待ちの経費精算はありません</div>
    {:else}
    <div class="row">
    	<ul class="list-group">
        <li class="list-group-item">
          件数: {reports.length}
        </li>
      </ul>
    </div>
    <div class="row full-height scroll-table">
		  <table class="table table-bordered">
        <thead class="table-light">
          <th>
            提出日
          </th>
          <th style="width: 100px;">
            提出者
          </th>
          <th>
            目的
          </th>
          <th style="width: 110px;">
            金額
          </th>
        </thead>
        <tbody>
          {#each reports as report}
          <tr>
            <td>
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openReport(report.id);
                }}>
                {formatDate(report.submittedAt)}
              </button>
            </td>
            <td class="">
              {report.submitter ? submitterName(report.submitter) : ''}
            </td>
            <td>
              {report.purpose || ''}
            </td>
            <td class="text-end">
              {formatMoney(sumOf(report))}円
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {/if}
  </div>
</div>

<style>

</style>
<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {formatDate, formatMoney} from '../../../libs/utils.js';
import {link} from '../../javascripts/router.js';

export let status;
export let toast;

let reports = [];

const sumOf = (report) => {
  return ( report.lines || [] )
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
};

const submitterName = (submitter) => {
  if ( !submitter ) {
    return '';
  }
  const member = submitter.member;
  return ( member && ( member.tradingName || member.legalName ) ) || submitter.name;
};

const openReport = (id) => {
  link(`/expense/entry/${id}`);
}

const getReports = () => {
  axios.get('/api/expense_reports/not_approved').then((result) => {
    reports = Array.isArray(result.data) ? result.data : [];
  })
}

onMount(() => {
  getReports();
})

</script>
