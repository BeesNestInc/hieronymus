<div class="page-header">
  <div class="ledger-title">
    {title}
  </div>
  <div class="company-name">
    {company.name}
  </div>
  <div class="term">
    {fy.year}年度
  </div>
  <div class="date">
    {formatDate(null, 'ja')}
  </div>
  <div class="left-item">
    {left_item || ''}
  </div>
  <div class="right-item">
    {right_item || ''}
  </div>
</div>

<script>
import {formatDate} from '../../../../libs/utils.js';

export let company;
export let fy;
export let title;
export let right_item;
export let left_item;
</script>