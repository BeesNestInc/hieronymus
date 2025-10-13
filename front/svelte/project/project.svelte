{#if ( status.state === 'list' )}
<ProjectList
	bind:status={status}
  bind:projects={projects}
  on:open={openEntry}></ProjectList>
{:else if ( status.state === 'home')}
<ProjectHome
  bind:status={status}
></ProjectHome>
{:else if ( status.state === 'labels')}
<ProjectLabels
  bind:status={status}
></ProjectLabels>
{:else if ( status.state === 'settings')}
<ProjectLabelSettings
  bind:status={status}
></ProjectLabelSettings>
{:else if ( status.state === 'summary' )}
<ProjectSummary
  bind:status={status}
></ProjectSummary>
{:else}
  {#if (status.state === 'entry' && project && project.id) || (status.state === 'new' && project)}
  <ProjectEntry
	  bind:status={status}
	  bind:project={project}
    on:close={closeEntry}></ProjectEntry>
  {/if}
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import ProjectEntry from './project-entry.svelte';
import ProjectList from './project-list.svelte';
import {currentProject, getStore} from '../../javascripts/current-record.js'
import ProjectHome from './project-home.svelte';
import ProjectLabels from './project-labels.svelte';
import ProjectLabelSettings from './project-label-settings.svelte';
import ProjectSummary from './project-summary.svelte'; // インポートを追加
import { link, currentPage } from '../../javascripts/router.js';

export let status;

let	project;
let projects = [];

$: checkPage($currentPage);

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  status.state = args[2] || 'list';
  
  // summaryの場合は、URLから直接パラメータをstatusに設定
  if (status.state === 'summary') {
    status.id = parseInt(args[3], 10);
    // クエリパラメータはProjectSummaryコンポーネント自身が処理する
  } else {
    status.id = args[3];
  }

  switch  (status.state) {
  case  'home':
  case  'labels':
  case  'settings':
  case  'summary':
    break;
  case  'entry':
    if (!project || project.id != args[3]) { // projectが空か、違うIDのデータを持っている場合
      axios.get(`/api/project/${args[3]}`).then((result) => {
        project = result.data;
        currentProject.set(project)
      });
    }
    break;
  case  'new':
    project = {}; // 常に新しいオブジェクトを作成
    currentProject.set(project);
    break;
  default:
    break;
  }
}

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  const project_data = event.detail;
  if ( !project_data || !project_data.id )	{
    link('/project/new');
  } else {
    link(`/project/entry/${project_data.id}`);
  }
};

const closeEntry = (event) => {
  link('/project');
}

onMount(() => {
  checkPage($currentPage);
})

</script>
