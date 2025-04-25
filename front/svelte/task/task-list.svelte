<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1 class="fs-3">案件一覧</h1>
    <button type="button" class="btn btn-primary"
    on:click={() => {
      openTask(null);
    }}
    id="task-info">新規入力&nbsp;<i class="bi bi-pencil-square"></i></button>
  </div>
  <div class="full-height fontsize-12pt">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th scope="col" style="width: 300px;">
            相手先
          </th>
          <th scope="col">
            件名
          </th>
          <th scope="col" style="width: 100px;">
            発生日
          </th>
          <th scope="col" style="width: 100px;">
            終了日
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:5px;">
            <CustomerSelect
              register=false
              on:input={(event) => {
                let value = parseInt(event.detail);
                status.params.set('company', value);
                dispatch('selectCustomerId');
              }}
              companyId={status.params ? parseInt(status.params.get('company')) : -1}>
            </CustomerSelect>
          </td>
          <td>
          </td>
          <td>
          </td>
          <td>
          </td>
        </tr>
        {#each tasks as line}
        <tr>
          <td>
            {#if (line.companyId)}
            <button type="button" class="btn btn-link"
              on:click={() => {
                link(`/company/entry/${line.companyId}`)
              }}>
              {line.companyName ? line.companyName : line.company.name}
            </button>
            {:else}
            {line.companyName ? line.companyName : '__' }
            {/if}
          </td>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
              openTask(line.id)
              }}>
              {line.subject ? line.subject : '__'}
            </button>
          </td>
          <td>
            {formatDate(line.issueDate)}
          </td>
          <td>
            {formatDate(line.endedAt)}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script>
import CustomerSelect from '../components/company-select.svelte';

import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import eventBus from '../../javascripts/event-bus.js';

export let status;
export let tasks;

const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
}

beforeUpdate(() => {
  console.log('task-list beforeUpdate');
});

const openTask = (id) => {
  let	task;
  if  ( id )  {
    for ( let i = 0; i < tasks.length; i ++ ) {
      if ( tasks[i].id == id ) {
        task = tasks[i];
        break;
      }
    }
  }
  dispatch('open', task);
  eventBus.emit('taskSelected', task);
}
</script>
