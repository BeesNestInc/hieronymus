<div class="menu">
  <div class="body">
    <ul class="list-group">
      <li class="list-group-item">
        仕訳日記帳ダウンロード
        <a href="/forms/explanatory_journal/{status.fy.term}?format=html" target="_blank">
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/explanatory_journal/{status.fy.term}?format=pdf" download="仕訳日記帳-{today}.pdf">
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
      </li>
      <li class="list-group-item">
        総勘定元帳ダウンロード
        <a href="/forms/general_ledger/{status.fy.term}?format=html" target="_blank">
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/general_ledger/{status.fy.term}?format=pdf" download="総勘定元帳-{today}.pdf">
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
      </li>
      <li class="list-group-item">
        補助元帳ダウンロード
        <a href="/forms/subsidiary_ledger/{status.fy.term}?format=html" target="_blank">
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/subsidiary_ledger/{status.fy.term}?format=pdf" download="補助元帳-{today}.pdf">
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
      </li>
      <li class="list-group-item">
        残高試算表ダウンロード
        <a href="/forms/trial_balance/{status.fy.term}?format=html" target="_blank">
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/trial_balance/{status.fy.term}?format=pdf" download="残高試算表-{today}.pdf">
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
      </li>
      <li class="list-group-item">
        決算報告書ダウンロード
        <a href="/forms/financial_statement/{status.fy.term}?format=html" target="_blank">
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/financial_statement/{status.fy.term}?format=pdf" download="決算報告書-{today}.pdf">
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
      </li>
    </ul>
  </div>
</div>

<script>
import {onMount} from 'svelte';
import Icon from '@iconify/svelte';

export	let	status;
let today;

onMount(() => {
  let now = new Date();
  today = `${now.getUTCFullYear()}${("00"+(now.getMonth()+1).toString()).slice(-2)}${("00"+now.getDate().toString()).slice(-2)}`;
})
</script>
