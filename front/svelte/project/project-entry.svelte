<div class="page-title">
  <h1>プロジェクト情報</h1>
</div>

<div class="row justify-content-center">
  <div class="col-md-10">
    <div class="mb-3 row">
      <label for="projectName" class="col-sm-2 col-form-label">プロジェクト名</label>
      <div class="col-sm-10">
        <input type="text" class="form-control" id="projectName" bind:value={project.name}>
      </div>
    </div>
    <div class="mb-3 row">
      <label for="projectCode" class="col-sm-2 col-form-label">コード</label>
      <div class="col-sm-10">
        <input type="text" class="form-control" id="projectCode" bind:value={project.code}>
      </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <div class="mb-3 row">
          <label for="startDate" class="col-sm-4 col-form-label">開始日</label>
          <div class="col-sm-8">
            <input type="date" class="form-control" id="startDate" bind:value={project.startDate}>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="mb-3 row">
          <label for="endDate" class="col-sm-4 col-form-label">終了日</label>
          <div class="col-sm-8">
            <input type="date" class="form-control" id="endDate" bind:value={project.endDate}>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>


<div class="mt-4">
  <button type="button" class="btn btn-danger" on:click={remove} disabled={!project.id}>削除</button>
  <button type="button" class="btn btn-secondary" on:click={() => history.back()}>もどる</button>
  <button type="button" class="btn btn-info" on:click={openLabelSettings} disabled={!project.id}>集計設定</button>
  <button type="button" class="btn btn-info" on:click={openSummary} disabled={!project.id}>集計表示</button>
  <button type="button" class="btn btn-primary" on:click={save}>保存</button>
</div>

<script>
  import axios from 'axios';
  import { createEventDispatcher } from 'svelte';
  import { link } from '../../javascripts/router.js';
  import { currentProject } from '../../javascripts/current-record.js';

  const dispatch = createEventDispatcher();

  export let project;

  const save = async () => {
    try {
      let response;
      if (project.id) {
        response = await axios.put(`/api/project/${project.id}`, project);
      } else {
        response = await axios.post('/api/project', project);
      }
      project = response.data;
      currentProject.set(project);
      dispatch('close');
      history.back(); // 保存後に戻る
    } catch (err) {
      console.error("プロジェクトの保存に失敗しました:", err);
      alert('エラー: プロジェクトの保存に失敗しました。');
    }
  };

  const remove = async () => {
    if (!project.id || !confirm(`プロジェクト「${project.name}」を削除します。よろしいですか？`)) {
      return;
    }
    try {
      await axios.delete(`/api/project/${project.id}`);
      dispatch('close');
      history.back(); // 削除後に戻る
    } catch (err) {
      console.error("プロジェクトの削除に失敗しました:", err);
      alert('エラー: プロジェクトの削除に失敗しました。');
    }
  };

  const openSummary = () => {
    if (project && project.id) {
      link(`/project/summary/${project.id}`);
    }
  };

  const openLabelSettings = () => {
    if (project && project.id) {
      link(`/project/settings/${project.id}`);
    }
  };

</script>