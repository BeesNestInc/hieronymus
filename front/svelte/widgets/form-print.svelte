<div class="menu">
  <div class="body">
  	<ul class="list-group">
    	<li class="list-group-item">
      <a href="/forms/explanatory_journal/{status.term}" download="仕訳日記帳-{today}.xlsx">
        仕訳日記帳ダウンロード
      </a>
    </li>
    <li class="list-group-item">
      <a href="/forms/general_ledger/{status.term}" download="総勘定元帳-{today}.xlsx">
        総勘定元帳ダウンロード
      </a>
    </li>
    <li class="list-group-item">
      <a href="/forms/subsidiary_ledger/{status.term}" download="補助元帳-{today}.xlsx">
        補助元帳ダウンロード
      </a>
    </li>
    <li class="list-group-item">
      <a href="/forms/trial_balance/{status.term}" download="残高試算表-{today}.xlsx">
        残高試算表ダウンロード
      </a>
    </li>
    <li class="list-group-item">
      <a href="/forms/financial_statement/{status.term}" download="決算報告書-{today}.xlsx">
        決算報告書ダウンロード
      </a>
    </li>
  </ul>
  </div>
</div>

<script>
import {onMount} from 'svelte';

export	let	status;
let today;

onMount(() => {
  let now = new Date();
  today = `${now.getUTCFullYear()}${("00"+(now.getMonth()+1).toString()).slice(-2)}${("00"+now.getDate().toString()).slice(-2)}`;
})
</script>
