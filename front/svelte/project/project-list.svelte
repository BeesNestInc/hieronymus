<div class="page-title d-flex justify-content-between">
  <h1>プロジェクト台帳</h1>
  <button type="button" class="btn btn-primary"
    on:click={() => {
      openProject(null);
    }}>新規プロジェクト入力&nbsp;<i class="bi bi-pencil-square"></i></button>
</div>
<div class="full-height-1 fontsize-12pt">
  <table class="table table-bordered">
    <thead class="table-light">
      <tr>
        <th scope="col" style="width: 200px;">
          プロジェクト名
        </th>
        <th scope="col" style="width: 150px;">
          コード
        </th>
        <th scope="col" style="width: 150px;">
          開始日
        </th>
        <th scope="col" style="width: 150px;">
          終了日
        </th>
        <th scope="col" style="width: 120px;"></th>
      </tr>
    </thead>
    <tbody>
      {#each projects as line}
      <tr class="fontsize-12pt">
        <td>
          <button type="button" class="btn btn-link"
            on:click={openProject} data-no={line.id}>
            {line.name}
          </button>
        </td>
        <td>
          {line.code}
        </td>
        <td>
          {line.startDate || ''}
        </td>
        <td>
          {line.endDate || ''}
        </td>
        <td>
          <button type="button" class="btn btn-sm btn-info" on:click={() => openSummary(line)}>集計表示</button>
        </td>
      </tr>
      {/each}
    </tbody>
  </table>
</div>
<style>
th {
  text-align: center;
}
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import { buildParam, parseParams } from '../../javascripts/params';
import { link } from '../../javascripts/router.js';

export let status;
export let projects;

const updateProjects = (_params) => {
  let param = buildParam(status, _params);
  axios.get(`/api/projects?${param}`).then((result) => {
    projects = result.data;
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const openProject = (event) => {
  let	project;
  if  ( event ) {
    let id = event.target.dataset.no;
    for ( let i = 0; i < projects.length; i ++ ) {
      if ( projects[i].id == id ) {
        project = projects[i];
        break;
      }
    }
  } else {
    project = {};
  }
  dispatch('open', project);
}

const openSummary = (project) => {
  link(`/project/summary/${project.id}`);
}

onMount(() => {
  console.log('project-list onMount');
  status.params = parseParams();
  updateProjects();
})
beforeUpdate(() => {
});
</script>