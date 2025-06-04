{#each accountPages as page}
<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title={title}
      left_item="科目一覧"
    ></PageHeader>
    <div class="page-body">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 70px;">
              科目コード
            </th>
            <th>
              勘定科目
            </th>
            <th style="width: 40px;">
              税区分
            </th>
            <th style="width: 120px;">
              借方
            </th>
            <th style="width: 120px;">
              貸方
            </th>
            <th style="width: 120px;">
              残高
            </th>
          </tr>
        </thead>
        <tbody>
          {#each page as line}
          <tr>
            <td class="number">
              {line.code}
            </td>
            <td>
              {line.name}
            </td>
            <td>
              {taxClass(line.taxClass)}
            </td>
            <td class="number">
              {formatMoney(line.debit)}
            </td>
            <td class="number">
              {formatMoney(line.credit)}
            </td>
            <td class="number">
              {formatMoney(line.balance)}
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
import {formatMoney, taxClass} from '../../../../libs/utils.js';

export let company;
export let fy;
export let title;
export let accountPages;
</script>