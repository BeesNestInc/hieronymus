<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title="販売費及び一般管理費内訳書"
      ></PageHeader>
    <div class="page-body">
      <table class="table-narrow">
        <thead>
          <tr>
            <th>
              科目
            </th>
            <th>
              金額
            </th>
          </tr>
        </thead>
        <tbody>
          {#each sgaPage as line}
          <tr>
            <td class="no-border">
              {line.name}
            </td>
            <td class="number left-border">
              {formatMoney(line.amount)}
            </td>
          </tr>
          {/each}
          <tr class="total">
            <td>合計</td>
            <td class="number">
              {formatMoney(sgaSum)}
            </td>
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
export let sgaPage;
export let sgaSum;

</script>