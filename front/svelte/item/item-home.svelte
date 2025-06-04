<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div> 
<div class="col-6" style="padding:10px;">
  <TableMaintenance
    title={'品目種別'}
    endpoint={'/api/item/classes'}
    bind:minimize={itemMinimize}
    columns={[
      { type: "id", name: 'id'},
      { type: "order", name: 'displayOrder'},
      { type: "text", name: 'name', title: "種別名", align: "left"},
      { type: "checkbox", name: 'product', title: "商品", width: "50px"},
      { type: "checkbox", name: 'inventoryManagement', title: "在庫管理", width: "100px"}
  ]}></TableMaintenance>
  </div>

<script>
import TableMaintenance from '../components/table-maintenance.svelte';

export let status;

let itemMinimize = false;
</script>