<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
  <span class="text-muted" style="font-size:0.8rem;">消費税区分・システム設定・AIのAPI設定</span>
</div>
<div class="full-height-1">
  <div class="row">
    {#if ( status.user && status.user.administrable )}
    <div class="col-6" style="padding:10px;">
      <TableMaintenance
        title={'消費税区分'}
        endpoint={'/api/tax-rule'}
        bind:minimize={taxRuleMinimize}
        columns={[
          { type: "id", name: 'id'},
          { type: "order", name: 'displayOrder'},
          { type: "text", name: 'label', title: "ラベル", align: "left"},
          { type: "dropdown", name: 'taxClass', title: "方式", width: "80px",
            source: [
              [ 0, '非課税' ],
              [ 1, '内税' ],
              [ 2, '外税'],
              [ 9, '別計算']
            ]
          },
          { type: "numeric", name: 'rate', title: "税率", width: "50px"},
          { type: "date", name: 'startDate', title: "開始日", width: "110px"},
          { type: "date", name: 'endDate', title: "終了日", width: "110px"}
      ]}></TableMaintenance>
    </div>
    <div class="col-6" style="padding:10px;">
      <SystemSettings
        title={'システム設定'}
        bind:minimize={systemSettingsMinimize}
        bind:toast={toast}
      />
    </div>
    {/if}
    {#if ( status.user && status.user.aiManage )}
    <div class="col-6" style="padding:10px;">
      <AiSettings
        title={'AI設定'}
        bind:minimize={aiSettingsMinimize}
        bind:toast={toast}
      />
    </div>
    {/if}
  </div>
</div>
<script>
import TableMaintenance from '../components/table-maintenance.svelte';
import SystemSettings from '../widgets/system-settings.svelte';
import AiSettings from '../widgets/ai-settings.svelte';

export let status;
export let toast;

let taxRuleMinimize = false;
let systemSettingsMinimize = false;
let aiSettingsMinimize = false;
</script>
