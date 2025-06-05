{#if ( status.state === 'list' )}
  <TaskList
  	bind:status={status}
    bind:tasks={tasks}
    on:open={openEntry}
    ></TaskList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <TaskEntry
    users={users}
    bind:status={status}
    bind:toast={toast}
    bind:task={task}
    on:openTransaction={openTransaction}
    on:open={openEntry}
    on:close={closeEntry}>
  </TaskEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import TaskEntry from './task-entry.svelte';
import TaskList from './task-list.svelte';
import {currentTask, currentTransaction, getStore} from '../../javascripts/current-record.js'
import {numeric, formatDate} from '../../../libs/utils.js';

export let status;
export let toast;

let task;
let tasks = [];
let users = [];

const	openEntry = (event)	=> {
  status.change = true;
  currentTransaction.set(null);
  currentTask.set(null);
  if  ( !event )  {
    task = null;
    status.state = 'new';
    window.history.pushState(
      status, "", `/task/new`);
  } else {
    console.log('open', event.detail);
    task = event.detail;
    if ( !task || !task.id )	{
      status.state = 'new';
      window.history.pushState(
        status, "", `/task/new`);
    } else {
      status.state = 'entry';
      window.history.pushState(
        status, "", `/task/entry/${task.id}`);
    }
  }
  //console.log('task', task)
};
const openTransaction = (event) => {
  let id = event.detail;
  status.state = 'entry';
  status.change = true;
  window.history.pushState(
    status, "", `/transaction/entry/${id}`);
}
const closeEntry = (event) => {
  status.state = 'list';
}

const checkPage = () => {
  let args = location.pathname.split('/');
  // /task
  // /task/entry/23
  console.log('checkPage', {args});
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
    //console.log('task', task);
    if  ( !task ) {
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
      let value = getStore(currentTask);
      //console.log({value});
      if	( value )	{
        task = value;
      } else {
        if	( status.state === 'entry' )	{
      		axios(`/api/task/${args[3]}`).then((result) => {
        		task = result.data.task;
        		console.log({task});
          	currentTask.set(task);
      		});
        } else {
          currentTask.set(task);
        }
      }
    }
  } else {
    status.state = 'list';
  }
  console.log({status});
}

onMount(() => {
  console.log('task onMount');
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  })
})

beforeUpdate(()	=> {
  console.log('task beforeUpdate');
  checkPage();
});
afterUpdate(() => {
  //console.log('tasks afterUpdate');
})
</script>
