{#if ( status.state === 'list' )}
<nav class="navbar navbar-expand-lg navbar-light bg-light">
  <div class="container-fluid">
    <span class="navbar-brand">取引一覧</span>
    <ul class="navbar-nav me-auto mb-2">
      <li class="nav-item">
        <button type="button" class="btn btn-primary"
          on:click={() => {
            openEntry(null);
          }}
          id="transaction-info">新規入力&nbsp;<i class="bi bi-pencil-square"></i></button>
      </li>
    </ul>
  </div> 
</nav>
<div class="row body-height">
  <TransactionList
    transactions={transactions}
    on:open={openEntry}
    on:selectKind={selectKind}
    on:selectCustomerId={selectCustomer}
    on:selectAmount={selectAmount}
    ></TransactionList>
</div>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <TransactionEntry
    bind:status={status}
    bind:transaction={transaction}
    bind:users={users}
    on:open={openEntry}
    on:close={closeEntry}>
  </TransactionEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import TransactionEntry from './transaction-entry.svelte';
import TransactionList from './transaction-list.svelte';
import {numeric} from '../../../libs/utils.js';
import {currentTransaction, currentTask, getStore} from '../../javascripts/current-record.js'

export let status;

let transaction;
let transactions;
let users;

const selectKind = (event) => {
  let kind = event.detail;
  updateTransactions({
    kind: kind
  });
}
const selectCustomer = (event) => {
  let	customerId = event.detail;
  console.log({customerId});
  updateTransactions({
    customer: customerId
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
  if	( !status.current_params )	{
    status.current_params = new Map();
  }
  if	( _params )	{
    Object.keys(_params).map((key) => {
      if	( !_params[key] )	{
        status.current_params.delete(key);
      } else {
        status.current_params.set(key,_params[key]);
      }
    });
  }
  //console.log('current_params', status.current_params);
  let _array = [];
  status.current_params.forEach((value, key) => {
    console.log('key, value', key, value);
    _array.push(encodeURI(`${key}=${value}`));
  });
  let param = _array.join('&');
  //console.log('param', param);
  axios.get(`/api/transaction?${param}`).then((result) => {
    transactions = result.data;
    //console.log('transactions', transactions);
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
    if ( !transaction.id )	{
      status.state = 'new';
      window.history.pushState(
        status, "", `/transaction/new`);
    } else {
      status.state = 'entry';
      axios(`/api/transaction/${transaction.id}`).then((result) => {
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
  //console.log('checkPage', {args});
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
    if	 ( !transaction )	{
      transaction = {
        issueDate: new Date(),
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
				transaction.customerId = task.customerId;
        transaction.customerName = task.customerName;
        transaction.chargeName = task.chargeName;
        transaction.zip = task.zip;
        transaction.address1 = task.address1;
        transaction.address2 = task.address2;
        transaction.subject = task.subject;
        transaction.lines = [...task.lines];
        transaction.taxClass = task.taxClass;
        transaction.tax = task.tax;
        transaction.amount = task.amount;
      }
    	let value = getStore(currentTransaction);
    	console.log({value});
    	if	( value )	{
	      transaction = value;
	    } else {
      	if	( status.state === 'entry' )	{
      		axios(`/api/transaction/${args[3]}`).then((result) => {
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
})

beforeUpdate(()	=> {
  checkPage();
  let _params = location.search.substr(1);
  //console.log('_params', _params);
  let params = [];
  if  ( _params )	{
    _params.split('&').map((item) => {
      let kv = item.split('=');
      params[decodeURI(kv[0])] = decodeURI(kv[1]);
    });
  	//console.log({params});
	}
  if  ( !users )  {
  	users = [];
    axios.get('/api/users/member').then((result) => {
      users = result.data;
    })
  }
  if	( !transactions )	{
    transactions = [];
  	updateTransactions();
  }
});
afterUpdate(() => {
  //console.log('transactions afterUpdate');
})
</script>
