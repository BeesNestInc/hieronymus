<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'証憑種別'}
      endpoint={'/api/voucher/classes'}
      bind:minimize={voucherMinimize}
      columns={[
        { type: "id", name: 'id'},
        { type: "order", name: 'displayOrder'},
        { type: "text", name: 'name', title: "種別名", align: "left"},
        { type: "checkbox", name: 'send', title: "差出", width: "50px"},
        { type: "dropdown", name: 'form', title: "プログラム名", width: "150px",
          source: [
            [ '', 'なし' ],
            [ 'invoice', '請求書' ],
            [ 'receipt', '領収書' ],
            [ 'estimate', '見積書']
          ]
        }
    ]}></TableMaintenance>
  </div>
</div>
<script>
import TableMaintenance from '../components/table-maintenance.svelte';

export let status;

let voucherMinimize = false;
</script>
