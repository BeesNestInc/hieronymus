<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  <div class="col-8" style="padding:10px;">
    <TableMaintenance
      title={'経費精算マッピング'}
      endpoint={'/api/expense_mapping'}
      bind:minimize={mappingMinimize}
      columns={[
        { type: "id", name: 'id'},
        { type: "order", name: 'displayOrder'},
        { type: "text", name: 'key', title: "検索キー", align: "left"},
        { type: "text", name: 'name', title: "名前", align: "left"},
        { type: "dropdown", name: 'kind', title: "種別", width: "100px", source: [['payee', '支払先'], ['payment', '出金元']]},
        { type: "dropdown", name: 'companyId', title: "取引先", width: "180px", func: fetchCompanies},
        { type: "dropdown", name: 'account', title: "勘定科目", width: "180px", func: fetchAccounts},
        { type: "numeric", name: 'subAccount', title: "補助コード", width: "90px"},
        { type: "checkbox", name: 'advance', title: "立替", width: "50px"}
    ]}></TableMaintenance>
  </div>
</div>
<script>
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';

export let status;

let mappingMinimize = false;

const fetchCompanies = async () => {
  const result = await axios.get('/api/company');
  return (result.data.companies || []).map((company) => [company.id, company.name]);
};

const fetchAccounts = async () => {
  const result = await axios.get('/api/accounts');
  return (result.data || []).map((account) => [account.code, account.name]);
};
</script>
