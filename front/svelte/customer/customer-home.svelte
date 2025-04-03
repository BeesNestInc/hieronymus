<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div> 
<div class="col-6" style="padding:10px;">
  <TableMaintenance
    title={'取引先種別'}
    endpoint={'/api/customer/kinds'}
    bind:minimize={customerMinimize}
    columns={[
      { type: "id", name: 'id'},
      { type: "order", name: 'displayOrder'},
      { type: "text", name: 'name', title: "種別名", align: "left"},
      { type: "checkbox", name: 'isClient', title: "顧客", width: "50px"}
  ]}></TableMaintenance>
</div>

<script>
import TableMaintenance from '../components/table-maintenance.svelte';

export let status;

let customerMinimize = false;
</script>