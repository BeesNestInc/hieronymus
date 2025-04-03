<TableMaintenance
  endpoint={'/api/customer/kinds'}
  columns={[
    { type: "id", name: 'id'},
    { type: "order", name: 'displayOrder'},
    { type: "text", name: 'name', title: "種別名", align: "left"},
    { type: "checkbox", name: 'isClient', title: "顧客", width: "50px"}
]}>
</TableMaintenance>

<script>
import TableMaintenance from './table-maintenance.svelte';

export let status;
</script>