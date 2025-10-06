<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>銀行元帳</h1>
  </div>
  <ul class="page-subtitle d-flex justify-content-between">
    <div class="nav">
    <li class="nav-item dropdown">
      <button type="button"
        class="btn nav-link dropdown-toggle"
        style="background-color:var(--bs-primary);color:white;"
        rolw="button" data-bs-toggle="dropdown" aria-expanded="false">
        {#if accountCode}
        {BANK_ACCOUNTS.find((el) => el[0] == accountCode)[1]}
        {:else}
        科目
        {/if}
      </button>
      <ul class="dropdown-menu" aria-labelledby="field">
        {#each BANK_ACCOUNTS as account}
        <li>
          <button type="button" class="btn btn-link dropdown-item"
            on:click={() => {
              openAccount(account[0])}
            }>
            {account[1]}
          </button>
        </li>
        {/each}
      </ul>
    </li>
    {#each bank_list.subAccounts as bank}
      <li class="nav-item">
        {#if ( subAccountCode === bank.subAccountCode )}
        <button type="button" class="btn btn-info"
          on:click|preventDefault={() => {
            openBank(bank.subAccountCode);
          }}>
          {bank.name}
        </button>
        {:else}
        <button type="button" class="btn btn-outline-info"
          on:click|preventDefault={() => {
            openBank(bank.subAccountCode);
          }}>
          {bank.name}
        </button>
        {/if}
      </li>
    {/each}
    </div>
    <div>
    	<button type="button" class="btn btn-primary" id="open-cross-slip"
    		on:click={openSlip}>
        伝票入力&nbsp;<i class="bi bi-pencil-square"></i>
      </button>
    </div>
  </ul>
  <div class="full-height-2">
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
                openSlip(line.year, line.month, line.no)
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
{#if popUp}
{#key modalCount}
<CrossSlipModal
  slip={slip}
  status={status}
  accounts={accounts}
  bind:popUp={popUp}
  on:close={updateList}></CrossSlipModal>
{/key}
{/if}
  
<style>
</style>

<script>
import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';
import {ledgerLines} from '../../../libs/ledger';
import {setAccounts} from '../../javascripts/cross-slip';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {DateString} from '../../../libs/utils.js';
import {currentPage} from '../../javascripts/router.js';

export let status;

let	bank_list = { subAccounts: []};
let slip = {
    year: 0,
    month: 0,
    lines: []
  };
let	lines = [];
let	accounts;
let modalCount = 0;
let popUp;

$: checkPage($currentPage);

const BANK_ACCOUNTS = [
  [ '1010000',	'当座預金' ],
  [ '1010010',	'普通預金' ],
  [ '1010020',	'定期預金' ],
  [ '1010030',	'定期積立' ]
];

const link = (href) => {
  window.history.pushState(status, "", href);
  currentPage.set(href);
}

let accountCode;
let subAccountCode;

const openAccount = (_account) => {
  accountCode = _account;
  subAccountCode = undefined;
  link(`/bank-ledger/${accountCode}`);
}
const openBank = (id) => {
  subAccountCode = id;
  link(`/bank-ledger/${accountCode}/${subAccountCode}`);
}

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  accountCode = args[2];
  subAccountCode = args[3] ? parseInt(args[3]) : undefined;
  console.log('checkPage', args, accountCode, subAccountCode);
  updateAccount();
  if ( subAccountCode ) {
    updateList();
  } else {
    lines = [];
  }
}

onMount(async () => {
  lines = [];
  bank_list = { subAccounts: []};
  let result = await axios.get('/api/accounts');
  accounts = result.data;
  setAccounts(accounts);

  checkPage();

});
afterUpdate(() => {
  if  (!popUp)  {
    modalCount += 1;
  }
})

const updateAccount = () => {
  if	( accountCode )	{
    axios.get(`/api/account/${accountCode}`).then((result) => {
      bank_list = result.data;
    });
  } else {
    bank_list = { subAccounts: [] };
  }
}

const updateList = () => {
  if	( subAccountCode )	{
    axios.get(`/api/remaining/${status.fy.term}/${accountCode}/${subAccountCode}`).then((result) => {
      let remaining = result.data;

      axios.get(`/api/ledger/${status.fy.term}/${accountCode}/${subAccountCode}`).then((result) => {
        let details = result.data;
        let ret = ledgerLines(accountCode, subAccountCode, remaining, details);
        lines = ret.lines;
      });
    });
  }
}

const	openSlip = (year, month, no) => {
  if  ( !no ) {
    slip = {
      year: status.fy.startDate.getFullYear(),
      month: status.fy.startDate.getMonth()+1,
      lines: [{
        debitAccount: "",
        debitSubAccount: 0,
        debitAmount: "",
        debitTax: "",
        creditAccount: "",
        creditSubAccount: 0,
        creditAmount: "",
        creditTax: "",
      }]
    };
    popUp = true;
  } else {
    axios.get(`/api/cross_slip/${year}/${month}/${no}`).then((result) => {
      let data = result.data;
      slip = {
        year: data.year,
        month: data.month,
        day: data.day,
        no: data.no,
        createdBy: data.createdBy,
        approvedAt: data.approvedAt ? new Date(data.approvedAt): null,
        createrName: data.creater ? data.creater.name: '',
        approverName: data.approver ? data.approver.name : '',
        lines: data.lines
      };
      popUp = true;
    });
  }
}
</script>
