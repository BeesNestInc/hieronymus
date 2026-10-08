{#if ( status.state === 'list' )}
<ExpenseList
  bind:status={status}
  bind:reports={reports}
  on:open={openEntry}
  on:update={refreshReports}
  ></ExpenseList>
{:else if ( status.state === 'home' )}
<ExpenseHome
  bind:status={status}></ExpenseHome>
{:else if ( (status.state === 'entry' || status.state === 'new') && report )}
<ExpenseEntry
  bind:status={status}
  bind:report={report}
  {toast}
  on:close={closeEntry}>
</ExpenseEntry>
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount} from 'svelte';
import ExpenseEntry from './expense-entry.svelte';
import ExpenseList from './expense-list.svelte';
import ExpenseHome from './expense-home.svelte';
import {formatDate} from '../../../libs/utils.js';
import {parseParams, buildParam} from '../../javascripts/params.js';
import {currentPage, link} from '../../javascripts/router.js';

export let status;
export let toast;

let	report;
let reports = [];

// 非同期GETの遅延到着による古いreportでの上書きを防ぐためのトークン
let pageToken = 0;

$: checkPage($currentPage);

const openEntry = (event) => {
  report = event.detail;
  if ( !report || !report.id )	{
    link('/expense/new');
  } else {
    link(`/expense/entry/${report.id}`);
  }
};

const closeEntry = (event) => {
  const query = status.params ? `?${status.params.toString()}` : '';
  link(`/expense${query}`);
}

const refreshReports = (event) => {
  const param = status.params ? status.params.toString() : '';
  const t = ++pageToken;
  axios.get(`/api/expense_reports?${param}`).then((result) => {
    if ( t !== pageToken ) return;
    reports = result.data || [];
  });
};

const buildNewReport = () => {
  return {
    submittedAt: formatDate(new Date()),
    companyId: null,
    taskId: null,
    purpose: '',
    lines: [{}]
  };
};

const checkPage = (pageUrl) => {
  if (!pageUrl) return;
  const url = new URL(pageUrl, window.location.origin);
  const args = url.pathname.split('/');

  status.state = args[2] || 'list';
  // list時のみparamsを更新する（entry/newに遷移した時に絞り込み条件を消さないため）
  switch  (status.state)  {
  case  'entry':
    {
      const t = ++pageToken;
      axios.get(`/api/expense_report/${args[3]}`).then((result) => {
        if ( t !== pageToken ) return;
        report = result.data;
      });
    }
    break;
  case  'new':
    {
      const t = ++pageToken;
      report = buildNewReport();
    }
    break;
  default:
    status.params = url.searchParams;
    refreshReports();
    break;
  }
}

onMount(() => {
  checkPage(location.href);
})
</script>
