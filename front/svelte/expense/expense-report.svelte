{#if ( status.state === 'list' )}
<ExpenseList
  bind:status={status}
  bind:reports={reports}
  on:open={openEntry}
  on:update={refreshReports}
  ></ExpenseList>
{:else if ( status.state === 'unsorted' )}
<ExpenseUnsorted
  bind:status={status}
  {toast}></ExpenseUnsorted>
{:else if ( status.state === 'payee' || status.state === 'payment' )}
<ExpenseMapping
  bind:status={status}
  kind={status.state}
  {toast}></ExpenseMapping>
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
import ExpenseUnsorted from './expense-unsorted.svelte';
import ExpenseMapping from './expense-mapping.svelte';
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
  const query = status.params ? `?${new URLSearchParams(status.params).toString()}` : '';
  link(`/expense${query}`);
}

const refreshReports = (event) => {
  const param = status.params ? new URLSearchParams(status.params).toString() : '';
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
  // 旧URL（/expense/home=設定ページ）は支払先マッピングへ誘導する
  if ( status.state === 'home' ) {
    status.state = 'payee';
  }
  // list時のみparamsを更新する（entry/newに遷移した時に絞り込み条件を消さないため）
  switch  (status.state)  {
  case  'entry':
    {
      const t = ++pageToken;
      axios.get(`/api/expense_report/${args[3]}`).then((result) => {
        if ( t !== pageToken ) return;
        if ( result.data && result.data.id ) {
          report = result.data;
        } else {
          // 削除済み等で取得できない精算書を「新規精算書」として
          // 編集可能に扱わないよう、不在は一覧へ戻す
          toast.show('経費精算', '精算書が見つかりません。削除された可能性があります。', 'warning');
          report = undefined;
          link('/expense');
        }
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
    //  URLSearchParams は structured clone 不可のため pushState(status) が失敗する（Map は可）
    status.params = new Map(url.searchParams);
    refreshReports();
    break;
  }
}

onMount(() => {
  checkPage(location.href);
})
</script>
