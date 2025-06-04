<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title="損益計算書"
      ></PageHeader>
    <div class="page-body">
      <table class="table-report">
        <thead>
          <tr>
            <th colspan="2">
              科目
            </th>
            <th colspan="2">
              金額
            </th>
          </tr>
        </thead>
        <tbody>
        {#each plOut as line}
          <tr>
            <td class="no-border">
              {line.left_title || ''}
            </td>
            <td class="no-border">
              {line.right_title || ''}
            </td>
            <td class="number{line.left_line ? ' pl-line' : ' left-border'}">
              {formatMoney(line.left_value)}
            </td>
            <td class="number{line.right_line ? ' pl-line' : ' left-border'}">
              {formatMoney(line.right_value)}
            </td>
          </tr>
        {/each}
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
export let plOut;

</script>