<svelte:head>
  <title>{title}::Hieronymus</title>
  <meta http-equiv="Content-Language" content="ja" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/style/paperA4.css">
</svelte:head>

<div class="page">
  <div class="title-page">
    <div class="title">
      {title}
    </div>
    <div class="company-name">
      {company.name}
    </div>
    <div class="term">
      {fy.year}年度
    </div>
    <div class="month">
      {formatDate(fy.startDate, 'ja')}〜
      {formatDate(fy.endDate, 'ja')}
    </div>
  </div>
</div>

<script>
import {formatDate} from '../../../../libs/utils.js';

export let title;
export let company;
export let fy;
</script>