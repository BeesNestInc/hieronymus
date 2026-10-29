{#if ( status.user.approvable )}
{#if ( count > 0 ) }
<div class="card">
  <div class="card-header">
    <h3 class="card-title">承認待ち</h3>
  </div>
  <div class="card-body">
    <div class="row">
    	<ul class="list-group">
        <li class="list-group-item">
          件数: {count}
        </li>
      </ul>
    </div>
	  <div class="row full-height scroll-table">
		  <table class="table table-bordered">
        <thead class="table-light">
          <th colspan="2">
            日付 / 伝番
          </th>
          <th style="width: 100px;">
            作成者
          </th>
          <th style="width: 100px;">
            更新者
          </th>
          <th>
            適用
          </th>
        </thead>
        <tbody>
          {#each slips as slip}
          <tr>
            <td style="width:50px;text-align:center;">
              {slip.month}/{slip.day}
            </td>
            <td style="width:50px;" class='number'>
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openSlip(slip.year, slip.month, slip.no);
                }}>
                {slip.no}
              </button>
            </td>
            <td class="">
              {slip.creater ? slip.creater.name: ''}
            </td>
            <td class="">
              {slip.updater ? slip.updater.name: ''}
            </td>
            <td>
              {#if slip.lines[0]?.application1 }
              {#if slip.lines[0]?.application2 }
              {slip.lines[0]?.application1}/{slip.lines[0]?.application2}
              {:else}
              {slip.lines[0]?.application1}
              {/if}
              {:else}
              {#if slip.lines[0]?.application2 }
              {slip.lines[0]?.application2}
              {/if}
              {/if}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
{/if}
{#if ( expenseCount > 0 ) }
<div class="card">
  <div class="card-header">
    <h3 class="card-title">経費精算の承認待ち</h3>
  </div>
  <div class="card-body">
    <div class="row full-height scroll-table">
		  <table class="table table-bordered">
        <thead class="table-light">
          <th>
            提出日
          </th>
          <th style="width: 120px;">
            提出者
          </th>
          <th>
            目的
          </th>
          <th style="width: 100px;">
            金額
          </th>
        </thead>
        <tbody>
          {#each expenseReports as report}
          <tr>
            <td>
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openExpense(report.id);
                }}>
                {formatDate(report.submittedAt)}
              </button>
            </td>
            <td>
              {report.submitter ? report.submitter.name : ''}
            </td>
            <td>
              {report.purpose || ''}
            </td>
            <td class="number">
              {expenseTotal(report).toLocaleString()}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
{/if}
{/if}
<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {link} from '../../javascripts/router.js';
import {numeric, formatDate} from '../../../libs/utils.js';

export let status;
export let toast;

let count = 0;
let slips = [];
let accounts;
let expenseReports = [];
let expenseCount = 0;

const expenseTotal = (report) => {
  return (report.lines || []).reduce((sum, line) => sum + numeric(line.amount), 0);
};

const openExpense = (id) => {
  link(`/expense/entry/${id}?returnTo=${encodeURIComponent('/home')}`);
}

const getExpenseReports = () => {
  axios.get('/api/expense_reports/not_approved').then((result) => {
    expenseReports = result.data || [];
    expenseCount = expenseReports.length;
  })
}

const setupAccount = () => {
	accounts = [];
	axios.get(`/api/accounts`).then((res) => {
		accounts = res.data;
		setAccounts(accounts);
	});
}

const openSlip = (year, month, no) => {
  link(`/slip/${year}/${month}/${no}?returnTo=${encodeURIComponent('/home')}`);
}

const getSlips = () => {
  axios.get('/api/cross_slips/not_approved').then((result) => {
    slips = result.data;
    count = slips.length;
  })
}

onMount(() => {
  if  ( !accounts ) {
    setupAccount();
  }
  getSlips();
  getExpenseReports();
})

</script>