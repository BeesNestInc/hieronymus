<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1 class="fs-3">案件一覧</h1>
    <button type="button" class="btn btn-primary"
    on:click={() => {
      link('/task/new');
    }}
    id="task-info">新規入力&nbsp;<i class="bi bi-pencil-square"></i></button>
  </div>
  <div class="full-height-1 fontsize-12pt">
    <table class="table table-bordered">
      <thead class="table-light">
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
            <CompanySelect
              register=false
              on:input={(event) => {
                let value = parseInt(event.detail);
                status.params.set('company', value);
                updateTasks();
              }}
              companyId={status.params ? parseInt(status.params.get('company')) : -1}>
            </CompanySelect>
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
                link(`/task/entry/${line.id}`)
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
import axios from 'axios';
import CompanySelect from '../components/company-select.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate } from 'svelte';
import eventBus from '../../javascripts/event-bus.js';
import {parseParams, buildParam} from '../../javascripts/params.js';
import { link } from '../../javascripts/router.js';

export let status;
export let tasks;

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

beforeUpdate(() => {
  console.log('task-list beforeUpdate');
});

onMount(() => {
  status.params = parseParams();
  updateTasks();
})

</script>
