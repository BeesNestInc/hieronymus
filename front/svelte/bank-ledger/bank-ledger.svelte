<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>銀行元帳</h1>
  </div>
  <ul class="page-subtitle nav">
    <li class="nav-item dropdown">
      <button type="button"
        class="btn nav-link dropdown-toggle"
        style="background-color:var(--bs-primary);color:white;"
        rolw="button" data-bs-toggle="dropdown" aria-expanded="false">
        {#if status.account}
        {BANK_ACCOUNTS.find((el) => el[0] == status.account)[1]}
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
        {#if ( status.subAccount === bank.id )}
        <button type="button" class="btn btn-info"
          on:click|preventDefault={() => {
            openBank(bank.id);
          }}>
          {bank.name}
        </button>
        {:else}
        <button type="button" class="btn btn-outline-info"
          on:click|preventDefault={() => {
            openBank(bank.id);
          }}>
          {bank.name}
        </button>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="full-height" style="overflow-y: auto;">
    <table class="table table-bordered">
      <thead>
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
            <div class="appication">
              {line.application1 ? line.application1 : ''}
            </div>
            <div class="appication">
              {line.application2 ? line.application2 : ''}
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
<CrossSlipModal
  slip={slip}
  bind:modal={modal}
  term={status.term}
  user={status.user}
  accounts={accounts}
  bind:init={init}
  on:close={updateList}></CrossSlipModal>

<style>
</style>

<script>
import axios from 'axios';
import Modal from 'bootstrap/js/dist/modal';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import {ledgerLines} from '../../../libs/ledger';
import {setAccounts} from '../../javascripts/cross-slip';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';

export let status;

let	bank_list = { subAccounts: []};
let slip = {
    year: 0,
    month: 0,
    lines: []
  };
let	lines = [];
let	modal;
let	accounts;
let init;

const BANK_ACCOUNTS = [
  [ '1010000',	'当座預金' ],
  [ '1010010',	'普通預金' ],
  [ '1010020',	'定期預金' ],
  [ '1010030',	'定期積立' ]
];
const openAccount = (account) => {
  //console.log('openBank');
  status.account = account;
  updateAccount();
  window.history.pushState(status, "",
    `/bank-ledger/${status.term}/${status.account}`);
}
const openBank = (id) => {
  status.subAccount = id;
  updateList();
  window.history.pushState(status, "",
    `/bank-ledger/${status.term}/${status.account}/${status.subAccount}`);
}

const update = () => {
  updateAccount();
  updateList();
}
const checkPage = () => {
  let args = location.pathname.split('/');
  status.term = parseInt(args[2]);
  status.account = args[3];
  status.subAccount = args[4] ? parseInt(args[4]) : undefined;
  update();
}

onMount(() => {
  lines = [];
  bank_list = { subAccounts: []};
  axios.get('/api/accounts').then((result) => {
    accounts = result.data;
    setAccounts(accounts);
  });
  update();
  modal = new Modal(document.getElementById('cross-slip-modal'));
});

let _status;
beforeUpdate(() => {
  console.log('bank-ledger beforeUpdate', status);
  console.log('ledger beforeUpdate', status);
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    checkPage();
  }
})

const updateAccount = () => {
  if	( status.account )	{
    axios.get(`/api/account/${status.account}`).then((result) => {
      bank_list = result.data;
    });
  }
}

const updateList = () => {
  if	( status.subAccount )	{
    axios.get(`/api/remaining/${status.term}/${status.account}/${status.subAccount}`).then((result) => {
      let remaining = result.data;
      //console.log('remaining', remaining);

      axios.get(`/api/ledger/${status.term}/${status.account}/${status.subAccount}`).then((result) => {
        let details = result.data;
        let ret = ledgerLines(status.account, status.subAccount,
                        remaining, details);
        lines = ret.lines;
        //console.log('lines', lines);
      });
    });
  }
}

const	openSlip = (year, month, no) => {
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
    init = true;
    modal.show();
  });
}
</script>
