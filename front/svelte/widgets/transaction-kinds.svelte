<TableMaintenance
  endpoint={'/api/transaction/kinds'}
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

<script>
import TableMaintenance from './table-maintenance.svelte';
import axios from 'axios';

export let status;

const getClasses = async () => {
  let result = await axios.get('/api/voucher/classes');
  let source = [];
  for ( let value of result.data.values )  {
    source.push([value.id, value.name]);
  }
  console.log('getClasses', source);
  return  (source);
}
</script>