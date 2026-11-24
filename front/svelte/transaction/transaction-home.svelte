<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  <div class="col-8" style="padding:10px;">
    <TableMaintenance
      title={'取引文書種別'}
      endpoint={'/api/transaction/kinds'}
      bind:minimize={transactionMinimize}
      columns={[
        { type: "id", name: 'id'},
        { type: "order", name: 'displayOrder'},
        { type: "text", name: 'label', title: "文書種別名", align: "left"},
        { type: "checkbox", name: 'hasDetails', title: "明細有無", width: "100px"},
        { type: "dropdown", name: 'hasDocument', title: "書類有無", width: "100px",
          source:[
            [0, 'なし'],
            [1, '任意'],
            [2, '必須'],
          ]
        },
        { type: "checkbox", name: 'forCustomer', title: "顧客用", width: "70px"},
        { type: "dropdown", name: 'bookId', title: '作成証憑', width: '200px',
          func: getClasses
        }
    ]}></TableMaintenance>
  </div>
</div>
<script>
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';

export let status;

let transactionMinimize = false;

const getClasses = async () => {
  let result = await axios.get('/api/voucher/classes');
  let source = [];
  for ( let value of result.data.values )  {
    source.push([value.id, value.name]);
  }
  return (source);
}
</script>
