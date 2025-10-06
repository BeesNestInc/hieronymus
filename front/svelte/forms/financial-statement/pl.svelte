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
              {@html line.left_title ? line.left_title.replace(' ', '&nbsp;') : ''}
            </td>
            <td class="no-border">
              {@html line.right_title ? line.right_title.replace(' ', '&nbsp;') : ''}
            </td>
            <td class="number {line.left_line ? 'pl-line' : 'left-border'}">
              <span class="{line.left_line ? 'pl-underline' : ''}">
                {line.left_value ? formatMoney(line.left_value) : ''}
              </span>
            </td>
            <td class="number {line.double_line || line.right_line ? 'pl-line' : 'left-border'}">
              <span class="{line.double_line ? 'pl-double-line' : (line.right_line ? 'pl-underline' : '')}">
                {line.right_value ? formatMoney(line.right_value) : ''}
              </span>
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