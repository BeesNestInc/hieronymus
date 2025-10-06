{#if ( status.state === 'list' )}
  <TransactionList
  	bind:status={status}
    transactions={transactions}
    ></TransactionList>
{:else if ( (status.state === 'entry' || status.state === 'new') && transaction )}
  <TransactionEntry
    bind:status={status}
    bind:toast={toast}
    bind:transaction={transaction}
    bind:users={users}>
  </TransactionEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import TransactionEntry from './transaction-entry.svelte';
import TransactionList from './transaction-list.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentTransaction, currentTask, getStore} from '../../javascripts/current-record.js'
import { currentPage } from '../../javascripts/router.js';

export let status;
export let toast;

let transaction;
let transactions = [];
let users = [];

$: checkPage($currentPage);

const checkPage = (page) => {
  page = page || location.pathname;
  let args = page.split('/');
  // /transaction/entry/23
  status.state = args[2] || 'list';
  //console.log('checkPage', {args});

  switch  (status.state)  {
  case  'entry':
    const entryId = args[3];
    if (!transaction || transaction.id != entryId) {
      axios.get(`/api/transaction/${entryId}`).then((result) => {
        console.log('new load', result.data);
        transaction = result.data.transaction;
        currentTransaction.set(transaction);
      });
    }
    break;
	case  'new':
    if  (!transaction || transaction.id) {
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
      currentTransaction.set(transaction);
    }
    console.log({transaction});
    break;
  default:
    break;
  }
}

onMount(() => {
  console.log('transaction onMount');
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  });
  checkPage($currentPage);
})

afterUpdate(() => {
  //console.log('transactions afterUpdate');
})
</script>
