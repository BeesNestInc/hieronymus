<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  export let toast;
  export let title = 'システム設定';
  export let minimize = true;

  let company = {};
  let useProjectAccounting = false;

  onMount(async () => {
    try {
      const res = await axios.get('/api/company/info');
      company = res.data.company || {};
      useProjectAccounting = company.useProjectAccounting || false;
    } catch (error) {
      console.error(error);
      toast('システム設定の読み込みに失敗しました。', 'danger');
    }
  });

  const handleChange = async () => {
    try {
      const updatedCompany = { ...company, useProjectAccounting };
      await axios.put('/api/company/info', updatedCompany);
      company = updatedCompany;
      toast('設定を保存しました。', 'success');
    } catch (error) {
      console.error(error);
      toast('設定の保存に失敗しました。', 'danger');
      // 変更を元に戻す
      useProjectAccounting = company.useProjectAccounting || false;
    }
  };
</script>

<div class="card">
  <div class="card-header d-flex">
    <h5 class="card-title">{title}</h5>
    <div class="d-flex ms-auto">
      <button type="button" class="btn"
        on:click={() => {
          minimize = !minimize;
        }}>
        {#if minimize}
        <i class="bi bi-square"></i>
        {:else}
        <i class="bi bi-dash-square"></i>
        {/if}
      </button>
    </div>
  </div>
  {#if !minimize}
  <div class="card-body">
    <div class="form-check form-switch">
      <input class="form-check-input" type="checkbox" role="switch" id="useProjectAccountingSwitch" bind:checked={useProjectAccounting} on:change={handleChange}>
      <label class="form-check-label" for="useProjectAccountingSwitch">プロジェクト管理機能を有効にする</label>
    </div>
  </div>
  {/if}
</div>
