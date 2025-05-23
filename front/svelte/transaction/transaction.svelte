{#if ( status.state === 'list' )}
  <TransactionList
  	bind:status={status}
    transactions={transactions}
    on:open={openEntry}
    on:selectKind={selectKind}
    on:selectCompanyId={selectCompany}
    on:selectAmount={selectAmount}
    ></TransactionList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <TransactionEntry
    bind:status={status}
    bind:transaction={transaction}
    bind:users={users}
    on:close={closeEntry}>
  </TransactionEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import TransactionEntry from './transaction-entry.svelte';
import TransactionList from './transaction-list.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentTransaction, currentTask, getStore} from '../../javascripts/current-record.js'
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let transaction;
let transactions = [];
let users = [];

const selectKind = (event) => {
  updateTransactions({});
}
const selectCompany = (event) => {
  let	companyId = event.detail;
  console.log({companyId});
  updateTransactions({
    company: companyId
  });
}
const selectAmount = (event) => {
  let amounts = event.detail;
  console.log({amounts});
  updateTransactions({
    upper: numeric(amounts.upperAmount),
    lower: numeric(amounts.lowerAmount)
  });
}

const updateTransactions = (_params) => {
  let param = buildParam(status, _params);
  //console.log('param', param);
  axios.get(`/api/transaction?${param}`).then((result) => {
    transactions = result.data.transactions;
    console.log('transactions', transactions);
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const	openEntry = (event)	=> {
  if  ( !event )  {
    transaction = null;
    status.state = 'new';
    window.history.pushState(
      status, "", `/transaction/new`);
  } else {
    console.log('open', event.detail);
    transaction = event.detail;
    if ( !transaction || !transaction.id )	{
      status.state = 'new';
      window.history.pushState(
        status, "", `/transaction/new`);
    } else {
      status.state = 'entry';
      axios.get(`/api/transaction/${transaction.id}`).then((result) => {
        transaction = result.data.transaction;
      	window.history.pushState(
        	status, "", `/transaction/entry/${transaction.id}`);
      });
    }
  }
  //console.log('transaction', transaction)
};
const closeEntry = (event) => {
  status.state = 'list';
  updateTransactions();
}
const checkPage = () => {
  let args = location.pathname.split('/');
  // /transaction/14
  // /transaction/entry/23
  console.log('checkPage', {args});
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
    if	 ( !transaction )	{
      transaction = {
        issueDate: formatDate(new Date()),
        tax: 0,
        amount: 0,
        lines: [{
          itemId: null,
          itemName: '',
          itemSpec: '',
          unitPrice: 0,
          itemNumber: 0,
          unit: '',
          amount: 0,
          description: ''
        }]};
      let task = getStore(currentTask);
      if	( task )	{
        transaction.taskId = task.id;
				transaction.companyId = task.companyId;
        transaction.companyName = task.companyName;
        transaction.chargeName = task.chargeName;
        transaction.zip = task.zip;
        transaction.address1 = task.address1;
        transaction.address2 = task.address2;
        transaction.subject = task.subject;
        transaction.lines = [...task.lines];
        transaction.taxClass = task.taxClass;
        transaction.tax = task.tax;
        transaction.amount = task.amount;
        transaction.handledBy = task.handledBy;
      }
    	let value = getStore(currentTransaction);
    	console.log({value});
    	if	( value )	{
	      transaction = value;
	    } else {
      	if	( status.state === 'entry' )	{
      		axios.get(`/api/transaction/${args[3]}`).then((result) => {
        		console.log('new load', result.data);
        		transaction = result.data.transaction;
        		currentTransaction.set(transaction);
          });
      	} else {
          currentTransaction.set(transaction);
      	}
      }
    }
    console.log({transaction});
  } else {
    status.state = 'list';
  }
}

onMount(() => {
  console.log('transaction onMount');
  status.params = parseParams();
  updateTransactions();
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  })
})

beforeUpdate(()	=> {
  checkPage();
});
afterUpdate(() => {
  //console.log('transactions afterUpdate');
})
</script>
