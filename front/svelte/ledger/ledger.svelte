<div class="list">
  <div class="page-title d-flex justify-content-between">
  	<h1>元帳</h1>
  	<a href="/forms/general_ledger/{status.term}" download="総勘定元帳.xlsx" class="btn btn-primary">
    	総勘定元帳.xlsx&nbsp;をダウンロード&nbsp;<i class="bi bi-download"></i>
  	</a>
	</div>
	<AccountSelect
  	on:select={(event) => {
    	accountSelect(event.detail);
  	}}
  	fields={fields}/>
	<nav class="page-subtitle navbar">
  	{#if (account)}
  	<button class="btn btn-link fs-4"
    	on:click={() => {
      	accountSelect({
        	code: account.accountCode
      	})
    	}}>
    	{ account ? account.name : ''}
  	</button>
  	{/if}
	</nav>
	{#if (account && (account.subAccounts.length > 0))}
	<div class="page-subtitle d-flex justify-content-between">
  	<div>
  		<SubAccountSelect
    		on:select={(event) => {
      		accountSelect(event.detail);
    		}}
    		account={account}
    		sub_account_code={status.subAccountCode} />
    </div>
    <div>
    	{#if status.subAccountCode}
      <button type="button" class="btn btn-info"
        on:click={() => {
          link(`/changes/${status.term}/${status.accountCode}/${status.subAccountCode}`)
        }}>
      	推移表を見る
    	</button>
    	{:else}
      <button type="button" class="btn btn-info"
        on:click={() => {
          link(`/changes/${status.term}/${status.accountCode}`);
        }}>
      	推移表を見る
    	</button>
    	{/if}
      <a href="/forms/subsidiary_ledger/{status.term}" download="補助元帳.xlsx" class="btn btn-primary">
          補助元帳.xlsx&nbsp;をダウンロード&nbsp;<i class="bi bi-download"></i>
      </a>
    </div>
	</div>
	{/if}
	<LedgerList
  	account={account}
  	pickup={pickup}
  	sums={sums}
  	lines={lines}
  	bind:status={status}
  	on:link={_link}
  	on:select={(event) => {
    	accountSelect(event.detail);
  	}}
  	on:open={openSlip}></LedgerList>
</div>
<CrossSlipModal
  slip={slip}
  bind:modal={modal}
  term={status.term}
  user={status.user}
  accounts={accounts}
  bind:init={init}
  on:close={updateList}></CrossSlipModal>

<script>

import axios from 'axios';
import Modal from 'bootstrap/js/dist/modal';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import LedgerList from './ledger-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {ledger_lines} from '../../../libs/ledger';
import AccountSelect from '../components/account-select.svelte';
import SubAccountSelect from '../components/subaccount-select.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import parse_account_code from '../../../libs/parse_account_code';

export let status;

let accounts = [];
let account;
let details;
let remaining;
let modal;
let slip = {
    year: 0,
    month: 0,
    lines: []
  };
let pickup;
let sums;
let lines;
let init;
let fields = [
  {
    title: '資産',
    accounts: []
  },{
    title: '負債',
    accounts: []
  },{
    title: '純資産',
    accounts: []
  },{
    title: '売上高',
    accounts: []
  },{
    title: '売上原価',
    accounts: []
  },{
    title: '営業外',
    accounts: []
  }
];

const _link = (event) => {
  link(event.detail);
}
const link = (href) => {
  window.history.pushState(status, "", href);
  status.change = true;
}

const accountSelect = (code) => {
  let href;
  if  ( code.sub )  {
    href = `/ledger/${status.term}/${code.code}/${code.sub}`;
  } else {
    href = `/ledger/${status.term}/${code.code}`;
  }
  status.pathname = href;
  status.accountCode = code.code;
  status.subAccountCode = code.sub;
  update(true);
  window.history.pushState(status, "", href);
}

const update = async (list) => {
  let args = status.pathname.split('/');
  status.current = args[1];
  status.term = args[2];
  status.accountCode = args[3];
  status.subAccountCode = args[4] ? parseInt(args[4]) : undefined;
  let result = await axios.get(`/api/account/${status.accountCode}`);
  account = result.data;
  //console.log('account', account);
  //console.log(status.accountCode, status.subAccountCode);
  if  ( list )  {
    let pr;
  	if ( status.subAccountCode ) {
    	//console.log('sub');
    	pr = axios.get(`/api/remaining/${status.term}/${status.accountCode}/${status.subAccountCode}`);
  	} else {
    	pr = axios.get(`/api/remaining/${status.term}/${status.accountCode}`);
  	}
  	remaining = [];
  	pr.then((result) => {
    	remaining = result.data;
    	//console.log('remaining', remaining);
      updateList();
  	});
  }
}
const checkPage = () => {
  update(true);
}

let _status;
beforeUpdate(()	=> {
  console.log('ledger beforeUpdate', status);
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    checkPage();
  }
});
afterUpdate(() => {
  console.log('ledger afterUpdate');
})
onMount(() => {
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
    for ( let i = 0; i < accounts.length; i ++ ) {
      let account = accounts[i];
      switch (parse_account_code.field(account.code)) {
        case '1':
        case '2':
          fields[0].accounts.push(account);
          break;
        case '3':
        case '4':
          fields[1].accounts.push(account);
          break;
        case '5':
          fields[2].accounts.push(account);
          break;
        case '6':
          fields[3].accounts.push(account);
          break;
        case '7':
          fields[4].accounts.push(account);
          break;
        default:
          fields[5].accounts.push(account);
          break;
      }
    }
    fields = fields;
  });
  if  ( !status.pathname ) {
    status.pathname = location.pathname;
  }
  console.log('ledger onMount');
  update(false);
  modal = new Modal(document.getElementById('cross-slip-modal'));
})

afterUpdate(() => {
});

const updateList = () => {
  console.log('updateList', status);
  let pr;
  if ( status.subAccountCode ) {
    console.log('sub');
    pr = axios.get(`/api/ledger/${status.term}/${status.accountCode}/${status.subAccountCode}`);
  } else {
    pr = axios.get(`/api/ledger/${status.term}/${status.accountCode}`);
  }
  details = [];
  pr.then((result) => {
    details = result.data;
    console.log('details', details);
    let ret = ledger_lines(status.accountCode, status.subAccountCode,
        remaining, details);
    console.log('ret', ret);
    lines = ret.lines;
    sums = ret.sums;
    pickup = ret.pickup;
  });
}
const openSlip = (event) => {
  let dataset = event.detail;
  axios.get(`/api/cross_slip/${dataset.year}/${dataset.month}/${dataset.no}`).then((result) => {
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