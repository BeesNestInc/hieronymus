<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>通帳元帳</h1>
  </div>
  <ul class="page-subtitle d-flex justify-content-between">
    <div class="nav">
    <li class="nav-item dropdown">
      <button type="button"
        class="btn nav-link dropdown-toggle"
        style="background-color:var(--bs-primary);color:white;"
        rolw="button" data-bs-toggle="dropdown" aria-expanded="false">
        {#if currentFinancial}
        {currentFinancial.name}
        {:else}
        通帳
        {/if}
      </button>
      <ul class="dropdown-menu" aria-labelledby="field">
        {#each financials as financial}
        <li>
          <button type="button" class="btn btn-link dropdown-item"
            on:click={() => {
              openFinancial(financial)}
            }>
            {financial.name}
          </button>
        </li>
        {/each}
        {#if ( financials.length === 0 )}
        <li><span class="dropdown-item-text text-muted">通帳がありません（明細取込で通帳を追加してください）</span></li>
        {/if}
      </ul>
    </li>
    </div>
    <div>
    	<button type="button" class="btn btn-outline-secondary" id="open-bank-statement"
    		on:click={() => { openStatement(); }}>
        明細取込&nbsp;<i class="bi bi-upload"></i>
      </button>
    	<button type="button" class="btn btn-primary" id="open-cross-slip"
    		on:click={openNewSlip}>
        伝票入力&nbsp;<i class="bi bi-pencil-square"></i>
      </button>
    </div>
  </ul>
  <div class="full-height-2 scroll-table">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" colspan="2">
            日付 / 伝番
          </th>
          <th scope="col" style="width: 150px;">
            相手勘定科目<br/>相手補助科目
          </th>
          <th scope="col" style="width: 300px;">
            適用<br/>補助科目
          </th>
          <th scope="col" style="width: 100px;">
            支払金額
          </th>
          <th scope="col" style="width: 100px;">
            預り金額
          </th>
          <th scope="col" style="width: 100px;">
            残高
          </th>
        </tr>
      </thead>
      <tbody>
      {#each lines as line}
        <tr>
          <td style="width:50px;text-align:center;">
            {line.month} / {line.day}
          </td>
          <td style="width:50px;" class={'number ' + ( line.approvedAt ? 'bg-body' : 'bg-warning' )}>
            <button type="button" class="btn btn-link"
              on:click={() => {
                openExistingSlip(line.year, line.month, line.no)
              }}>
              {line.no}
            </button>
          </td>
          <td>
            {line.otherAccount}<br/>
            {line.otherSubAccount}
          </td>
          <td>
            <div class="application">
              {line.application1 || ''}
              {#if line.application2}
              /
              {line.application2}
              {/if}
            </div>
            <div class="application d-flex">
              <div class="tax">
                {line.otherTaxRule}
              </div>
              <div class="">
                {#if (line.debitVoucher )}
                {#each line.debitVoucher.files as file}
                <a href="/voucher/file/{file.id}" target="_blank">
                  <i class="fas fa-file"></i>
                </a>
                {/each}
                {/if}
                {#if (line.creditVoucher )}
                {#each line.creditVoucher.files as file}
                <a href="/voucher/file/{file.id}" target="_blank">
                  <i class="fas fa-file"></i>
                </a>
                {/each}
                {/if}
              </div>
              <div class="ms-auto tax">
                {line.thisTaxRule}
              </div>
            </div>
          </td>
          <td class="number">
            {#if line.showCredit }
            {line.pureCreditAmount ? line.pureCreditAmount.toLocaleString(): ''}
            {/if}
          </td>
          <td class="number">
            {#if line.showDebit }
            {line.pureDebitAmount ? line.pureDebitAmount.toLocaleString(): ''}
            {/if}
          </td>
          <td class="number">
            {line.pureBalance.toLocaleString()}
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
import {onMount} from 'svelte';
import {ledgerLines} from '../../../libs/ledger';
import {setAccounts} from '../../javascripts/cross-slip';
import {DateString} from '../../../libs/utils.js';
import {currentPage, link as routerLink} from '../../javascripts/router.js';

export let status;

let	bank_list = { subAccounts: []};
let	lines = [];
let	accounts;
// 通帳（Financial）。通帳元帳の表示単位は「科目」ではなく通帳（口座）
let financials = [];
let currentFinancial = null;

$: checkPage($currentPage);

const link = (href) => {
  window.history.pushState({ page: href }, "", href);
  currentPage.set(href);
}

let accountCode;
let subAccountCode;

// 通帳（口座）を指定して開く。URLは従来どおり科目/補助をキープ
// （直リンク・履歴からの戻りも同じ形で動く）
const openFinancial = (financial) => {
  if ( financial.subAccountCode ) {
    link(`/bank-ledger/${financial.accountCode}/${financial.subAccountCode}`);
  } else {
    link(`/bank-ledger/${financial.accountCode}`);
  }
}

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  accountCode = args[2];
  subAccountCode = args[3] ? parseInt(args[3]) : undefined;
  updateAccount();
  if ( subAccountCode ) {
    updateList();
  } else {
    lines = [];
  }
}

// 通帳一覧を読む（通帳元帳の選択肢。取込の有無に関係なく全部を出す。
// 法人カード（未払金の口座）も出す。個人カードは精算フロー専用なので出さない）
// 表示中のURL(科目/補助)に対応する通帳も引いてdropdown表示に反映する
const resolveFinancial = async () => {
  try {
    const result = await axios.get('/api/financial');
    financials = ( ( result.data && result.data.values ) || [] )
      .filter((f) => ( f.kind === 'bank' || f.kind === 'corporate_card' ));
  } catch (e) {
    console.error('load financials failed', e);
    financials = [];
  }
  if ( !accountCode ) {
    currentFinancial = null;
    return;
  }
  currentFinancial = financials.find((f) => (
    f.accountCode === accountCode &&
    ( f.subAccountCode || undefined ) === ( subAccountCode || undefined )
  )) || null;
}

onMount(async () => {
  lines = [];
  bank_list = { subAccounts: []};
  let result = await axios.get('/api/accounts');
  accounts = result.data;
  setAccounts(accounts);

  await resolveFinancial();
  checkPage();

});

const updateAccount = () => {
  if	( accountCode )	{
    axios.get(`/api/account/${accountCode}`).then((result) => {
      bank_list = result.data;
    });
  } else {
    bank_list = { subAccounts: [] };
  }
  resolveFinancial();
}

const updateList = () => {
  if	( subAccountCode )	{
    axios.get(`/api/remaining/${status.fy.term}/${accountCode}/${subAccountCode}`).then((result) => {
      let remaining = result.data;

      axios.get(`/api/ledger/${status.fy.term}/${accountCode}/${subAccountCode}?includeUnapproved=1`).then((result) => {
        let details = result.data;
        let ret = ledgerLines(accountCode, subAccountCode, remaining, details);
        lines = ret.lines;
      });
    });
  }
}

const currentReturnTo = () => encodeURIComponent(location.pathname + location.search);
const	openExistingSlip = (year, month, no) => {
  routerLink(`/slip/${year}/${month}/${no}?returnTo=${currentReturnTo()}`);
}
const	openNewSlip = () => {
  const year = status.fy.startDate.getFullYear();
  const month = status.fy.startDate.getMonth() + 1;
  routerLink(`/slip/new?year=${year}&month=${month}&returnTo=${currentReturnTo()}`);
}
const openStatement = () => {
  routerLink('/bank-statement');
}
</script>
