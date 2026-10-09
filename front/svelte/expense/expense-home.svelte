<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <MappingTable
        kind={'payee'}
        title={'支払先マッピング'}
        showCompany={true}
        showAdvance={false}
        bind:minimize={payeeMinimize}></MappingTable>
    </div>
  </div>
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <MappingTable
        kind={'payment'}
        title={'出金元マッピング'}
        showCompany={false}
        showAdvance={true}
        bind:minimize={paymentMinimize}></MappingTable>
    </div>
  </div>
</div>
<script>
import MappingTable from './mapping-table.svelte';

export let status;

let payeeMinimize = false;
let paymentMinimize = false;
</script>
