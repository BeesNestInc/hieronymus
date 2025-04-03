<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>科目管理</h1>
  </div>
  <div class="full-height fontsize-12pt">
    <AccountsList
      status={status}
      lines={lines}
      accounts={accounts}
      on:open={openAccount}>
    </AccountsList>
  </div>
</div>

<AccountModal
  account={account}
  sub_account={sub_account}
  mode={mode}
  status={status}
  modal={modal}
  on:close={updateAccounts}>
</AccountModal>

<style>
</style>

<script>
import axios from 'axios';
import Modal from 'bootstrap/js/dist/modal';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import AccountsList from './accounts-list.svelte';
import AccountModal from './account-modal.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {numeric, formatDate} from '../../../libs/utils.js';
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let fy;
let accounts;
let	lines = [];
let modal;
let	mode;
let	account = {};
let	sub_account = {};

const ready = () => {
  lines = [];
  let last_account = {};
  for ( let i = 0; i < accounts.length; i ++ ) {
    let account = accounts[i];
    let new_line = {
      acl_id: account.acl_id,
      acl_code: account.acl_code
    };
    if ( last_account.major_name != account.major_name ) {
      new_line.major_name = account.major_name;
    } else {
      new_line.major_name = '';
    }
    if ( last_account.middle_name != account.middle_name ) {
      new_line.middle_name = account.middle_name;
    } else {
      new_line.middle_name = '';
    }
    if ( last_account.minor_name != account.minor_name ) {
      new_line.minor_name = account.minor_name;
    } else {
      new_line.minor_name = '';
    }
    if		(( new_line.major_name != '') ||
         ( new_line.middle_name != '' ) ||
         ( new_line.minor_name != '' )) {
      lines.push(new_line);
    }
    if	( account.name && ( account.name != '' ) )	{
      lines.push({
        major_name: '',
        middle_name: '',
        minor_name: '',
        account_name: account.name,
        sub_account_name: '',
        tax_class: 0,
        key: account.key ? account.key : '',
        debit: account.debit ? numeric(account.debit) : 0,
        credit: account.credit ? numeric(account.credit) : 0,
        remaining: account.balance ? numeric(account.balance) : 0,
        sub_code: -1,
        code: account.code
      });
      if ( account.subAccounts && account.subAccounts.length > 0 ) {
        for ( let j = 0; j < account.subAccounts.length; j ++) {
          let sub = account.subAccounts[j];
          lines.push({
            major_name: '',
            middle_name: '',
            minor_name: '',
            account_name: '',
            sub_account_name: sub.name,
            tax_class: sub.taxClass,
            key: sub.key,
            debit: sub.debit ? numeric(sub.debit) : 0,
            credit: sub.credit ? numeric(sub.credit) : 0,
            remaining: sub.balance ? numeric(sub.balance) : 0,
            sub_code: sub.code,
            code: account.code
          });
        }
      }
    }
    last_account = account;	 
  }
}


const	updateAccounts = () => {
  axios.get(`/api/accounts/${status.term}`).then((result) => {
    accounts = result.data;
    console.log('accounts', accounts);
    setAccounts(accounts);
    ready();
  });
}

const checkPage = () => {
  let args = location.pathname.split('/');
}
onMount(() => {
  status.params = parseParams();
  modal = new Modal(document.getElementById('account-modal'));
  status.term = location.pathname.split('/')[2];
  axios.get(`/api/term/${status.term}`).then((result) => {
    fy = result.data;
  }).then(() => {
    updateAccounts();
  });
})

beforeUpdate(() => {
  checkPage();
});

let openModal = false;
afterUpdate(() => {
  if	( openModal )	{
    modal.show();
    openModal = false;
  }
});
const	openAccount = (event) => {
  let	args = event.detail;
  console.log({args});
  mode = args.mode;
  account = args.account;
  sub_account = args.sub_account;
  openModal = true;
}
</script>
