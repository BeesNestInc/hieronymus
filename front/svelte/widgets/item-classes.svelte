<TableMaintenance
  endpoint={'/api/item/classes'}
  columns={[
    { type: "id", name: 'id'},
    { type: "order", name: 'displayOrder'},
    { type: "text", name: 'name', title: "種別名", align: "left"},
    { type: "checkbox", name: 'product', title: "商品", width: "50px"},
    { type: "checkbox", name: 'inventoryManagement', title: "在庫管理", width: "100px"}
]}></TableMaintenance>
<script>
import TableMaintenance from './table-maintenance.svelte';

export let status;
</script>