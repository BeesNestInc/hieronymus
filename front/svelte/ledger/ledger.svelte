<div class="page-title d-flex justify-content-between">
  <h1>元帳</h1>
  <a href="/forms/general_ledger/{status.fy.term}?format=pdf" download="総勘定元帳-{today}.pdf" class="btn btn-primary">
    総勘定元帳をダウンロード&nbsp;<i class="bi bi-download"></i>
  </a>
</div>
<AccountSelect
  on:select={(event) => {
    accountSelect(event.detail);
  }}
  fields={fields}/>
<nav class="page-subtitle navbar d-flex justify-content-between">
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
  <div>
    <button type="button" class="btn btn-primary" id="open-cross-slip"
    	on:click={openSlip}>
      伝票入力&nbsp;<i class="bi bi-pencil-square"></i>
    </button>
  </div>
</nav>
{#if (account && (account.subAccounts.length > 0))}
  <div class="row page-subtitle">
    <div class="col-8">
  		<SubAccountSelect
    		on:select={(event) => {
      		accountSelect(event.detail);
    		}}
    		account={account}
    		sub_account_code={status.subAccountCode} />
    </div>
    <div class="col-4" style="text-align:right;">
    	{#if status.subAccountCode}
      <button type="button" class="btn btn-info"
        on:click={() => {
          link(`/changes/${status.accountCode}/${status.subAccountCode}`)
        }}>
      	推移表を見る
    	</button>
    	{:else}
      <button type="button" class="btn btn-info"
        on:click={() => {
          link(`/changes/${status.accountCode}`);
        }}>
      	推移表を見る
    	</button>
    	{/if}
      <a href="/forms/subsidiary_ledger/{status.fy.term}?format=pdf" download="補助元帳-{today}.pdf" class="btn btn-primary">
          補助元帳をダウンロード&nbsp;<i class="bi bi-download"></i>
      </a>
    </div>
  </div>
{/if}
<div class="full-height-4" style="overflow-y: auto;">
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

<script>

import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import LedgerList from './ledger-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {ledgerLines} from '../../../libs/ledger';
import AccountSelect from '../components/account-select.svelte';
import SubAccountSelect from '../components/subaccount-select.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import parse_account_code from '../../../libs/parse_account_code';

export let status;

let modalCount = 0;
let popUp;
let accounts = [];
let account;
let details;
let remaining;
let slip = {
    year: 0,
    month: 0,
    lines: []
  };
let pickup;
let sums;
let lines;
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
let today;

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
    href = `/ledger/${code.code}/${code.sub}`;
  } else {
    href = `/ledger/${code.code}`;
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
  status.accountCode = args[2];
  status.subAccountCode = args[3] ? parseInt(args[3]) : undefined;
  let result = await axios.get(`/api/account/${status.accountCode}`);
  account = result.data;
  //console.log('account', account);
  //console.log(status.accountCode, status.subAccountCode);
  if  ( list )  {
    let pr;
  	if ( status.subAccountCode ) {
    	//console.log('sub');
    	pr = axios.get(`/api/remaining/${status.fy.term}/${status.accountCode}/${status.subAccountCode}`);
  	} else {
    	pr = axios.get(`/api/remaining/${status.fy.term}/${status.accountCode}`);
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
  let now = new Date();
  today = `${now.getUTCFullYear()}${("00"+(now.getMonth()+1).toString()).slice(-2)}${("00"+now.getDate().toString()).slice(-2)}`;

  console.log('ledger onMount');
  update(false);
})

afterUpdate(() => {
  if  (!popUp)  {
    modalCount += 1;
  }
});

const updateList = () => {
  console.log('updateList', status);
  let pr;
  if ( status.subAccountCode ) {
    console.log('sub');
    pr = axios.get(`/api/ledger/${status.fy.term}/${status.accountCode}/${status.subAccountCode}`);
  } else {
    pr = axios.get(`/api/ledger/${status.fy.term}/${status.accountCode}`);
  }
  details = [];
  pr.then((result) => {
    details = result.data;
    console.log('details', details);
    let ret = ledgerLines(status.accountCode, status.subAccountCode,
        remaining, details);
    console.log('ret', ret);
    lines = ret.lines;
    sums = ret.sums;
    pickup = ret.pickup;
  });
}
const openSlip = (event) => {
  let dataset = event.detail;
  if  ( dataset.no ) {
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
      popUp = true;
    });
  } else {
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
  }
}
</script>