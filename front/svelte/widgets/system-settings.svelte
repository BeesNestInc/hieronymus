<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  export let toast;
  export let title = 'システム設定';
  export let minimize = true;

  let company = {};
  let useProjectAccounting = false;
  let showIntercompanyAsSundries = false;

  onMount(async () => {
    try {
      const res = await axios.get('/api/company/info');
      company = res.data.company || {};
      useProjectAccounting = company.useProjectAccounting || false;
      showIntercompanyAsSundries = company.showIntercompanyAsSundries || false;
    } catch (error) {
      console.error(error);
      toast.show('システム設定', '読み込みに失敗しました。');
    }
  });

  const handleChange = async () => {
    console.log({company});
    try {
      const updatedCompany = { ...company, useProjectAccounting, showIntercompanyAsSundries };
      await axios.put('/api/company/info', updatedCompany);
      company = updatedCompany;
      toast.show('システム設定', '設定を保存しました。');
    } catch (error) {
      console.error(error);
      toast.show('システム設定', '設定の保存に失敗しました。');
      // 変更を元に戻す
      useProjectAccounting = company.useProjectAccounting || false;
      showIntercompanyAsSundries = company.showIntercompanyAsSundries || false;
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
    <div class="form-check form-switch">
      <input class="form-check-input" type="checkbox" role="switch" id="showIntercompanyAsSundriesSwitch" bind:checked={showIntercompanyAsSundries} on:change={handleChange}>
      <label class="form-check-label" for="showIntercompanyAsSundriesSwitch">複合仕訳で相手勘定科目を「諸口」と表示する</label>
    </div>
  </div>
  {/if}
</div>
