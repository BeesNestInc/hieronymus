<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>案件情報</h1>
  </div> 
  <div class="row full-height fontsize-12pt">
    <div class="content">
      <div class="body">
        <FormError
        	messages={errorMessages}></FormError>
        <TaskInfo
          users={users}
          on:startregister={() => { disabled = true}}
          on:endregister={() => { disabled = false}}
          on:openTransaction
          bind:task={task}
          bind:files={files}></TaskInfo>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={back}>もどる</button>
        {#if ( task && task.id && task.id > 0 )}
        <button type="button" class="btn btn-danger" disabled={disabled}
          on:click={deleteTask}
          id="delete-button">削除</button>
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={() => {
              task.id = undefined;
              save()
            }
          }
          id="create-button">複製</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={save}
          id="save-button">保存</button>
        {#if ( task && task.id && ( !transaction || !transaction.id ))}
        <button type="button" class="btn btn-warning"
          on:click={create}
          id="save-button">取引文書作成</button>
				{/if}
      </div>
    </div>
  </div>
</div>

<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={operation}
  ></OkModal>

<script>
import axios from 'axios';
import {numeric, formatDate} from '../../../libs/utils.js';
import {bindFile} from '../../javascripts/document';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import TaskInfo from './task-info.svelte';
import FormError from '../common/form-error.svelte';
import OkModal from '../common/ok-modal.svelte';
import eventBus from '../../javascripts/event-bus.js';
import {currentTask, currentTransaction, getStore} from '../../javascripts/current-record.js'

export  let users;
export	let	status;
export	let task;

let disabled = false;
let files;
let transaction;
let errorMessages = [];

let modal;
let title;
let description;
let operation = () => {};

const create_task = async (_task) => {
  let result = await axios.post('/api/task', _task);
  console.log(result);
  return	(result);
}
const update_task = async (_task) => {
  console.log('save_task', _task);
  let result = await axios.put('/api/task', _task);
     
  console.log(result);
  return	(result);
}
const deleteTask = (event) => {
  console.log('deleteTask', task);
  title = '案件の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
			<td>相手先</td><td>${task.companyName}</td>
		</tr>
    <tr>
			<td>件名</td><td>${task.subject}</td>
		</tr>
    <tr>
			<td>担当</td><td>${task.handleUser.member.tradingName}</td>
    </tr>
  </tbody>
`;
  operation = doDelete;
  modal.show();
}

const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
  		let result = await axios.delete(`/api/task/${task.id}`);
  		console.log(result);
    	back();
  	} catch (e) {
	    console.log(e);
  	}
  }
}

const save = () => {
  if	( task.companyId )	{
    task.companyId = parseInt(task.companyId);
  }
  try {
    let	pr;
    let create = false;
    if ( task.id  ) {
      task.id = parseInt(task.id);
      pr = update_task(task);
    } else {
      pr = create_task(task);
      create = true;
    }
    pr.then((result) => {
      console.log('result', result);
      if  ( !result.data.code ) {
        task = result.data.task;
        bindFile(files,task.documentId);
      }
      eventBus.emit('taskSelected', task);
      console.log('save', {status})
      if  ( create )  {
        window.history.replaceState(
          status, "", `/task/entry/${task.id}`);
      }
    });
  }
  catch(e) {
    console.log(e);
    // can't save
    //	TODO alert
  }
}

const create = () => {
	currentTask.set(task);
  window.history.pushState(
    status, "", `/transaction/new`);
  status.current = 'transaction';
  status.state = 'new';
}

const	back = (event) => {
  dispatch('close');
  currentTask.set(null);
  errorMessages = [];
  window.history.back();
}

beforeUpdate(() => {
  //console.log('task-entry beforeUpdate', task);
/*
  if	( !task )	{
    task = {
      issueDate: formatDate(new Date()),
      subject: '',
      document: {}
    };
  }
*/
});

onMount(() => {
	transaction = getStore(currentTransaction);
})

</script>
