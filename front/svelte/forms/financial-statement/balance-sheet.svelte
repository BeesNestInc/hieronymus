<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title="貸借対照表"
      ></PageHeader>
    <div class="page-body">
      <table class="table-report">
        <thead>
          <tr>
            <th colspan="2">
              資産の部
            </th>
            <th colspan="2">
              負債の部
            </th>
          </tr>
          <tr>
            <th>科目</th>
            <th>金額</th>
            <th>科目</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {#each bsLines as line}
          <tr>
            {@html line}
          </tr>
          {/each}
          <tr class="total">
            <td>資産合計</td>
            <td class="number">{formatMoney(asset)}</td>
            <td>負債・純資産合計</td>
            <td class="number">{formatMoney(liabilities + networth)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
<script>
import {formatMoney} from '../../../../libs/utils.js';
import PageHeader from '../components/page-header.svelte';

export let fy;
export let company;
export let bsLines;
export let asset;
export let liabilities;
export let networth;

</script>