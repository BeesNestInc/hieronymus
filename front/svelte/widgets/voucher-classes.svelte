<TableMaintenance
  title={'証憑種別'}
  endpoint={'/api/voucher/classes'}
  columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'name', title: "種別名", align: "left"},
  { type: "checkbox", name: 'send', title: "差出", width: "50px"},
  { type: "dropdown", name: 'form', title: "プログラム名", width: "200px",
  source: [
    [ 'invoice', '請求書' ],
    [ 'receipt', '領収書' ],
    [ 'estimate', '見積書']
    ]
  }
  ]}></TableMaintenance>
<script>
import TableMaintenance from './table-maintenance.svelte';

export let status;

</script>