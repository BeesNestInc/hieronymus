{#if ( status.state === 'list' )}
<VoucherList
  bind:status={status}
  bind:vouchers={vouchers}
  on:open={openEntry}
  on:slip={openSlip}
  on:update={changeMonth}
  ></VoucherList>
{:else if ( (status.state === 'entry' || status.state === 'new') && voucher )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:open={openSlip}
  on:copy={copyVoucher}
  on:close={closeEntry}>
</VoucherEntry>
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js';
import {setAccounts} from '../../javascripts/cross-slip';
import {parseParams, buildParam} from '../../javascripts/params.js';
import {currentPage, link, getStore as getPage} from '../../javascripts/router.js';

export let status;

let	voucher;
let vouchers = [];
let accounts = [];

// 非同期GETの遅延到着による古いvoucherでの上書きを防ぐためのトークン
let pageToken = 0;

$: checkPage($currentPage);

const openSlip = (event) => {
  const slipNo = event.detail;
  const returnTo = encodeURIComponent(location.pathname + location.search);
  if	( slipNo.no )	{
    link(`/slip/${slipNo.year}/${slipNo.month}/${slipNo.no}?returnTo=${returnTo}`);
  } else {
    link(`/slip/new?year=${slipNo.year}&month=${slipNo.month}&day=${slipNo.day}&returnTo=${returnTo}`);
  }
};

const	openEntry = (event)	=> {
  voucher = event.detail;
  if ( !voucher || !voucher.id )	{
    link('/voucher/new');
  } else {
    link(`/voucher/entry/${voucher.id}`);
  }
};

const updateSlip = (event) => {
  checkPage(location.href);
}

const closeEntry = (event) => {
  const query = status.params ? `?${new URLSearchParams(status.params).toString()}` : '';
  link(`/voucher${query}`);
}

const changeMonth = (event) => {
  const param = buildParam(status, event.detail);
  link(`/voucher?${param}`);
}

const updateVouchers = (event) => {
  const param = status.params ? new URLSearchParams(status.params).toString() : '';
  axios.get(`/api/voucher?${param}`).then((result) => {
    vouchers = result.data.vouchers;
  });
};

const buildNewVoucher = (d) => {
  const v = {
    issueDate: d.issueDate || formatDate(new Date()),
    paymentDate: d.paymentDate || null,
    amount: 0,
    taxClass: -1,
    tax: 0,
    type: (d.voucherClassId != null) ? parseInt(d.voucherClassId) : -1
  };
  // 種別・相手先が指定されている場合はデフォルト値として引き継ぐ（idは持たせない）
  if ( v.type !== -1 ) {
    v.voucherClassId = v.type;
  }
  if ( d.companyId != null ) {
    v.companyId = parseInt(d.companyId);
  }
  return v;
};

const buildNewUrl = (d) => {
  const params = new URLSearchParams();
  if ( d.voucherClassId != null ) {
    params.set('voucherClassId', d.voucherClassId);
  }
  if ( d.issueDate ) {
    params.set('issueDate', d.issueDate);
  }
  if ( d.paymentDate ) {
    params.set('paymentDate', d.paymentDate);
  }
  if ( d.companyId != null ) {
    params.set('companyId', d.companyId);
  }
  const query = params.toString();
  return query ? `/voucher/new?${query}` : '/voucher/new';
};

// 相手先が指定されている場合は会社情報を取得して表示用に設定する。
// 取得完了前にユーザーが別の相手先を選び直していたら上書きしない。
const fetchCompanyFor = (v, companyId, t) => {
  axios.get(`/api/company/${companyId}`).then((result) => {
    if ( t !== pageToken ) return;
    if ( v.companyId != null && String(v.companyId) !== String(companyId) ) return;
    if ( result.data && result.data.company ) {
      v.company = result.data.company;
      voucher = v;
      currentVoucher.set(voucher);
    }
  }).catch(() => {});
};

const copyVoucher = (event) => {
  // 新規入力ボタンの処理。URLが変わらない場合でもcheckPageが走らないため、
  // ここで同期的にIDなしの新規voucherに置き換える（削除・伝票ボタンを隠す）。
  const d = event.detail || {};
  const t = ++pageToken;
  voucher = buildNewVoucher(d);
  currentVoucher.set(voucher);
  status.state = 'new';
  if ( d.companyId != null ) {
    fetchCompanyFor(voucher, d.companyId, t);
  }
  const target = buildNewUrl(d);
  link(target, {replace: getPage(currentPage) === target});
};

const checkPage = (pageUrl) => {
  if (!pageUrl) return; // 初回レンダリング時など、URLがまだない場合は何もしない
  const url = new URL(pageUrl, window.location.origin); // 相対URLを絶対URLに変換してパース
  const args = url.pathname.split('/');
  console.log('voucher checkPage', args);

  status.state = args[2] || 'list';
  // status.params は一覧の絞り込み条件の保持場所。
  // entry/new のURLにはクエリがないため、ここで上書きすると
  // 一覧に戻った時に月選択等が消えてしまう。list時のみ更新する。
  switch  (status.state)  {
  case  'entry':
    {
      const t = ++pageToken;
      axios.get(`/api/voucher/${args[3]}`).then((result) => {
        if ( t !== pageToken ) return;
        voucher = result.data.voucher;
        currentVoucher.set(voucher);
      });
    }
    break;
  case  'new':
    {
      const t = ++pageToken;
      const params = url.searchParams;
      const d = {};
      for ( const key of ['voucherClassId', 'issueDate', 'paymentDate', 'companyId'] ) {
        const value = params.get(key);
        if ( value !== null ) d[key] = value;
      }
      voucher = buildNewVoucher(d);
      currentVoucher.set(voucher);
      if ( d.companyId != null ) {
        fetchCompanyFor(voucher, d.companyId, t);
      }
    }
    break;
  default:
    //  URLSearchParams は structured clone 不可のため pushState(status) が失敗する（Map は可）
    status.params = new Map(url.searchParams);
    console.log('voucher list params', status.params.get('month'));
    updateVouchers();
    break;
  }
}

onMount(async () => {
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
  });

  checkPage(location.href);

})
</script>
