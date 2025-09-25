{#each pages as page}
<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title={title}
      left_item={sub_title}
    ></PageHeader>
    <div class="page-body">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 100px;">
              勘定科目
            </th>
            <th style="width: 120px;">
              繰越金額
            </th>
            <th style="width: 120px;">
              借方金額
            </th>
            <th style="width: 120px;">
              貸方金額
            </th>
            <th style="width: 120px;">
              残高
            </th>
          </tr>
        </thead>
        <tbody>
          {#each page as line}
          <tr class={line.total ? "total": ""}>
            <td>
              {@html line.name}
            </td>
            <td class="number">
              {line.pickup ? formatMoney(line.pickup) : ''}
            </td>
            <td class="number">
              {line.debit ? formatMoney(line.debit) : ''}
            </td>
            <td class="number">
              {line.credit ? formatMoney(line.credit) : ''}
            </td>
            <td class="number">
              {line.balance ? formatMoney(line.balance): ''}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
{/each}
<script>
import PageHeader from '../components/page-header.svelte';
import {formatMoney} from '../../../../libs/utils.js';

export let company;
export let fy;
export let pages;
export let title;
export let sub_title;
</script>