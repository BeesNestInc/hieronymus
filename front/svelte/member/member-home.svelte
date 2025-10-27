<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'役職員種別'}
      endpoint={'/api/member/classes'}
      columns={[
        { type: "id", name: 'id'},
        { type: "order", name: 'displayOrder'},
        { type: "text", name: 'title', title: "職員種別名", align: "left"},
        { type: "checkbox", name: 'executive', title: "役員", width: "50px"},
        { type: "checkbox", name: 'officer', title: "管理職", width: "50px"},
        { type: "checkbox", name: 'fullTime', title: "常勤", width: "50px"},
        { type: "checkbox", name: 'insurance', title: "給与支給", width: "50px"},
        { type: "checkbox", name: 'socialInsurance', title: "社会保険等加入", width: "100px"}
    ]}></TableMaintenance>
  </div>
</div>
<script>
import TableMaintenance from '../widgets/table-maintenance.svelte';

export let status;
</script>