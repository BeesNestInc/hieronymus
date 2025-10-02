{#if ( status.state === 'list' )}
  <TaskList
  	bind:status={status}
    bind:tasks={tasks}
    ></TaskList>
{:else if (status.state === 'entry' && task && task.id) || (status.state === 'new' && task)}
  <TaskEntry
    users={users}
    bind:status={status}
    bind:toast={toast}
    bind:task={task}
    on:openTransaction={openTransaction}>
  </TaskEntry>
{/if}

<script>
import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';
import TaskEntry from './task-entry.svelte';
import TaskList from './task-list.svelte';
import {currentTask, currentTransaction, getStore} from '../../javascripts/current-record.js'
import {numeric, formatDate} from '../../../libs/utils.js';
import { currentPage, link } from '../../javascripts/router.js';

export let status;
export let toast;

let task;
let tasks = [];
let users = [];

const openTransaction = (event) => {
  let id = event.detail;
  link(`/transaction/entry/${id}`);
}

const checkPage = () => {
  const args = location.pathname.split('/');
  const page_state = args[2];

  if (page_state === 'entry') {
    status.state = 'entry';
    const entry_id = args[3];
    axios.get(`/api/task/${entry_id}`).then((result) => {
      task = result.data.task;
      currentTask.set(task);
    });
  } else if (page_state === 'new') {
    status.state = 'new';
    task = {
      issueDate: formatDate(new Date()),
      tax: 0,
      amount: 0,
      document: {
        descriptionType: 'html',
        description: ''
      },
      lines: [{
        itemName: '',
        itemSpec: '',
        unitPrice: 0,
        itemNumber: 0,
        unit: '',
        amount: 0,
        description: ''
      }]};
    let transaction = getStore(currentTransaction);
    if	( transaction )	{
      task.companyId = transaction.companyId;
      task.companyName = transaction.companyName;
      task.chargeName = transaction.chargeName;
      task.zip = transaction.zip;
      task.address1 = transaction.address1;
      task.address2 = transaction.address2;
      task.subject = transaction.subject;
      task.document.title= transaction.subject;
      task.lines = [...transaction.lines];
      task.taxClass = transaction.taxClass;
      task.tax = transaction.tax;
      task.amount = transaction.amount;
    }
    currentTask.set(task);
  } else {
    status.state = 'list';
    task = null;
  }
  console.log({status});
}

onMount(() => {
  console.log('task onMount');
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  });
  checkPage();
})

$: $currentPage, checkPage();

afterUpdate(() => {
  //console.log('tasks afterUpdate');
})
</script>
