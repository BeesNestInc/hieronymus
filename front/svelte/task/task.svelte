{#if ( status.state === 'list' )}
  <TaskList
  	bind:status={status}
    tasks={tasks}
    on:open={openEntry}
    on:selectKind={selectKind}
    on:selectCustomerId={selectCustomer}
    ></TaskList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <TaskEntry
    users={users}
    bind:status={status}
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
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let task;
let tasks = [];
let users = [];

const selectKind = (event) => {
  updateTasks({});
}
const selectCustomer = (event) => {
  updateTasks({
  });
}
const updateTasks = (_params) => {
  let param = buildParam(status, _params);
  console.log('param', param);
  axios.get(`/api/task?${param}`).then((result) => {
    tasks = result.data.tasks;
    console.log('tasks', tasks);
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const	openEntry = (event)	=> {
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
  console.log('task', task)
};
const openTransaction = (event) => {
  let id = event.detail;
  status.state = 'entry';
  window.history.pushState(
    status, "", `/transaction/entry/${id}`);
}
const closeEntry = (event) => {
  status.state = 'list';
  updateTasks();
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
				task.customerId = transaction.customerId;
        task.customerName = transaction.customerName;
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
  status.params = parseParams();
  updateTasks();
  axios.get('/api/users/member').then((result) => {
    users = result.data.users;
  })
})

beforeUpdate(()	=> {
  //console.log('task beforeUpdate');
  checkPage();
});
afterUpdate(() => {
  //console.log('tasks afterUpdate');
})
</script>
