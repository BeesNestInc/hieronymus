{#if ( status.state === 'list' )}
  <TransactionList
  	bind:status={status}
    transactions={transactions}
    on:open={openEntry}
    ></TransactionList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <TransactionEntry
    bind:status={status}
    bind:toast={toast}
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

export let status;
export let toast;

let transaction;
let transactions = [];
let users = [];


const	openEntry = (event)	=> {
  status.change = true;
  currentTransaction.set(null);
  currentTask.set(null);
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
      transaction = null;
      window.history.pushState(
        status, "", `/transaction/new`);
    } else {
      status.state = 'entry';
      window.history.pushState(
        status, "", `/transaction/entry/${transaction.id}`);
    }
  }
  //console.log('transaction', transaction)
};
const closeEntry = (event) => {
  status.state = 'list';
  console.log('closeEntry');
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
          tax: 0,
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
  console.log(status.state);
}

onMount(() => {
  console.log('transaction onMount');
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  })
})

let _status;
beforeUpdate(()	=> {
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    checkPage();
  }
});
afterUpdate(() => {
  //console.log('transactions afterUpdate');
})
</script>
