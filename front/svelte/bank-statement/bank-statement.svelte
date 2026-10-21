<div class="page-title d-flex justify-content-between">
  <h1>明細取込</h1>
  <div>
    {#if ( id )}
    <button type="button" class="btn btn-outline-secondary" on:click={goList}>一覧へ戻る</button>
    {:else}
    <button type="button" class="btn btn-outline-secondary me-2" title="学習ルール（摘要→相手方仕訳）の閲覧・編集"
      on:click={() => { openRulesModal(); }}>
      学習ルール&nbsp;<i class="bi bi-mortar-board"></i>
    </button>
    <button type="button" class="btn btn-primary" on:click={openModal}>
      取り込む&nbsp;<i class="bi bi-upload"></i>
    </button>
    {/if}
  </div>
</div>

{#if ( id )}
<div class="body full-height-2" bind:this={bodyEl}>
  {#if ( statement )}
  <div class="mb-1 text-muted">
    {kindLabel(statement.kind)} / {statement.fileName} /
    {statement.periodFrom || '?'}〜{statement.periodTo || '?'} / {statement.lines.length}行
    {#if ( statement.kind === 'corporate_card' && statement.cardName )}
    　カード: {statement.cardName}
    {/if}
  </div>
  {#if ( warnings && warnings.length > 0 )}
  <div class="alert alert-warning py-1 px-2">
    {#each warnings as w}<div>{w}</div>{/each}
  </div>
  {/if}
  {#if ( statement.kind === 'bank' )}
  <div class="d-flex align-items-center mb-2">
    <label class="me-2">口座</label>
    <select class="form-select form-select-sm me-1" style="width:auto;"
      bind:value={statement.account}>
      <option value="">科目</option>
      {#each bankAccounts as account}
      <option value={account.code}>{account.name}</option>
      {/each}
    </select>
    <select class="form-select form-select-sm me-1" style="width:auto;"
      bind:value={statement.subAccount}>
      <option value="">補助</option>
      {#each detailSubAccounts as sub}
      <option value={sub.code}>{sub.name}</option>
      {/each}
    </select>
    <button type="button" class="btn btn-sm btn-outline-primary" on:click={saveAccount}>
      口座を設定
    </button>
  </div>
  {/if}
  <div class="d-flex align-items-center mb-1">
    {#if ( statement.kind === 'bank' )}
    <button type="button" class="btn btn-sm btn-outline-primary me-2" disabled={busy}
      on:click={runMatch}>既存仕訳と突合</button>
    <button type="button" class="btn btn-sm btn-primary me-2" disabled={busy || bookTargets.length === 0}
      on:click={() => { runBook(); }}>一括起票（対象{bookTargets.length}行 / 未照合{unmatchedCount}行）</button>
    <button type="button" class="btn btn-sm btn-outline-secondary me-2" disabled={busy}
      title="学習ルールを更新したあとに、未承認の起票伝票を解放して作り直します（確定済み伝票には触りません）"
      on:click={runRebook}><i class="bi bi-arrow-repeat me-1"></i>再実行</button>
    {/if}
  </div>
  {#if ( statement.kind === 'bank' )}
  <div class="mb-1" style="font-size:0.85rem;">
    全{statement.lines.length}行:
    <span class="badge bg-success">照合済 {statusCounts.matched}</span>
    <span class="badge bg-primary">起票済 {statusCounts.booked}</span>
    <span class="badge bg-dark">対象外 {statusCounts.ignored}</span>
    <span class="badge bg-secondary">未照合 {statusCounts.unmatched}</span>
  </div>
  {/if}
  <div class="table-responsive">
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
          <th style="width:110px;">日付</th>
          <th>摘要</th>
          <th class="number" style="width:110px;">出金</th>
          <th class="number" style="width:110px;">入金</th>
          <th class="number" style="width:110px;">残高</th>
          <th style="width:90px;">区分</th>
          <th style="width:110px;">状態</th>
          <th style="width:110px;">伝票</th>
          {#if ( statement.kind === 'bank' )}
          <th style="width:180px;">相手方</th>
          <th style="width:90px;"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each statement.lines as line}
        <tr class:matched-row={line.status === 'matched'}>
          <td>{line.date || ''}</td>
          <td>
            {line.description || line.rawDescription || ''}
            {#if ( cardSuggestion(line.id) )}
            <div class="text-muted" style="font-size:0.75rem;">
              カード引落候補: {cardSuggestion(line.id).total.toLocaleString()}円（{cardSuggestion(line.id).payDate || '日付不明'}）
            </div>
            {/if}
          </td>
          <td class="number">{line.amountOut != null ? Number(line.amountOut).toLocaleString() : ''}</td>
          <td class="number">{line.amountIn != null ? Number(line.amountIn).toLocaleString() : ''}</td>
          <td class="number">{line.balance != null ? Number(line.balance).toLocaleString() : ( line.amount != null ? Number(line.amount).toLocaleString() : '' )}</td>
          <td>{categoryLabel(line.category)}</td>
          <td>
            {#if ( line.status === 'booked' && !line.crossSlipDetailId )}
            <span class="badge bg-warning" title="紐付伝票が削除されています">伝票消滅</span>
            {:else if ( line.status === 'booked' && line.crossSlipDetailId )}
            {#if ( isTentative(line) )}
            <span class="badge bg-warning" title="仮入科目で起票されています。実科目の伝票（請求書等）を入力すると自動で差し替わります">仮起票</span>
            {:else}
            <span class="badge {statusColor(line.status)}">{statusLabel(line.status)}</span>
            {/if}
            {:else}
            <span class="badge {statusColor(line.status)}">{statusLabel(line.status)}</span>
            {/if}
          </td>
          <td>
            {#if ( line.slip )}
            <button type="button" class="btn btn-link btn-sm p-0"
              on:click={() => { openSlip(line.slip); }}>
              {line.slip.month}/{line.slip.day}-{line.slip.no}
            </button>
            {/if}
          </td>
          {#if ( statement.kind === 'bank' )}
          <td>
            {#if ( line.status === 'booked' && line.crossSlipDetailId )}
            <span class={ isTentative(line) ? 'text-warning' : 'text-muted' }>{bookedOppositeLabel(line)}</span>
            {:else if ( line._oppositeLabel )}
            <span class="text-info"><i class="bi bi-mortar-board-fill me-1" title="学習済みのルールから起票します"></i>{line._oppositeLabel}</span>
            {/if}
          </td>
          <td style="white-space:nowrap;">
            {#if ( canBookLine(line) )}
            <button type="button" class="btn btn-sm btn-outline-primary" title="この明細だけ起票"
              on:click={() => { bookLine(line); }}><i class="bi bi-pencil-square"></i></button>
            <button type="button" class="btn btn-sm btn-outline-secondary" title="この摘要の学習ルールを追加・編集"
              on:click={() => { openRulesModal(line); }}><i class="bi bi-mortar-board"></i></button>
            {/if}
            {#if ( line.status === 'unmatched' )}
            <button type="button" class="btn btn-sm btn-outline-secondary" title="対象外にする"
              on:click={() => { setIgnored(line, true); }}><i class="bi bi-slash-circle"></i></button>
            {:else if ( line.status === 'ignored' || ( line.status === 'booked' && !line.crossSlipDetailId ) )}
            <button type="button" class="btn btn-sm btn-outline-secondary" title="未照合に戻す"
              on:click={() => { restoreLine(line); }}><i class="bi bi-arrow-counterclockwise"></i></button>
            {/if}
          </td>
          {/if}
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</div>
{:else}
<div class="body full-height-2">
  <div class="table-responsive">
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
          <th style="width:110px;">種別</th>
          <th>ファイル / 対象</th>
          <th style="width:220px;">期間</th>
          <th class="number" style="width:90px;">行数</th>
          <th style="width:60px;"></th>
        </tr>
      </thead>
      <tbody>
        {#each statements as statement}
        <tr>
          <td>{kindLabel(statement.kind)}</td>
          <td><a class="btn btn-link p-0" href={`/bank-statement/${statement.id}`}
            on:click|preventDefault={() => { routerLink(`/bank-statement/${statement.id}`); }}>{statement.fileName}{statement.cardName ? `（${statement.cardName}）` : ''}</a></td>
          <td>{statement.periodFrom || '?'}〜{statement.periodTo || '?'}</td>
          <td class="number">{statement.lineCount}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-danger" title="削除"
              on:click={() => { deleteStatement(statement); }}><i class="bi bi-trash"></i></button>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
{/if}

<div class="modal" bind:this={modalEl} tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">明細の取り込み</h5>
        <button type="button" class="btn-close" onclick={closeModal}></button>
      </div>
      <div class="modal-body">
        <div class="row mb-2">
          <label class="col-4 col-form-label">種別</label>
          <div class="col-8">
            <select class="form-select" bind:value={form.kind}>
              <option value="bank">銀行通帳（Excel/CSV/画像）</option>
              <option value="corporate_card">カード明細（PDF）</option>
              <option value="personal_card">個人カード明細（立替用）</option>
            </select>
          </div>
        </div>
        {#if ( form.kind === 'bank' )}
        <div class="row mb-2">
          <label class="col-4 col-form-label">口座</label>
          <div class="col-4">
            <select class="form-select" bind:value={form.account}>
              <option value="">科目</option>
              {#each bankAccounts as account}
              <option value={account.code}>{account.name}</option>
              {/each}
            </select>
          </div>
          <div class="col-4">
            <select class="form-select" bind:value={form.subAccount}>
              <option value="">補助</option>
              {#each bankSubAccounts as sub}
              <option value={sub.code}>{sub.name}</option>
              {/each}
            </select>
          </div>
        </div>
        {/if}
        {#if ( form.kind !== 'bank' )}
        <div class="row mb-2">
          <label class="col-4 col-form-label">カード名</label>
          <div class="col-8">
            <input type="text" class="form-control" bind:value={form.cardName}
              placeholder="銀行側の引落摘要に含まれる名称（例: ミツイスミトモカード）">
          </div>
        </div>
        {/if}
        <div class="row mb-2">
          <label class="col-4 col-form-label">ファイル</label>
          <div class="col-8">
            <input type="file" class="form-control" accept=
              ".xlsx,.csv,image/*,application/pdf"
              on:change={(e) => { form.file = e.target.files[0]; }}>
          </div>
        </div>
        {#if ( preview )}
        <div class="border rounded p-2 mb-2" style="max-height:220px;overflow-y:auto;">
          <div class="text-muted mb-1">
            {preview.lineCount}行 / {preview.periodFrom}〜{preview.periodTo}
          </div>
          {#each preview.warnings as w}
          <div class="text-danger">{w}</div>
          {/each}
          {#each preview.lines.slice(0, 10) as line}
          <div class="d-flex justify-content-between" style="font-size:0.8rem;">
            <span>{line.date || '?'} {line.rawDescription || line.merchant || ''}</span>
            <span>{( line.amountOut || line.amountIn || line.amount ) != null ? ( line.amountOut || line.amountIn || line.amount ).toLocaleString() : ''}</span>
          </div>
          {/each}
          {#if ( preview.lines.length > 10 )}
          <div class="text-muted">…ほか {preview.lines.length - 10}行</div>
          {/if}
        </div>
        {/if}
        {#if ( formError )}
        <div class="alert alert-danger py-1 px-2">{formError}</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" onclick={closeModal}>キャンセル</button>
        {#if ( !preview )}
        <button type="button" class="btn btn-primary" disabled={!form.file || busy} on:click={doPreview}>
          {#if ( busy )}読み取り中…{:else}内容確認{/if}
        </button>
        {:else}
        <button type="button" class="btn btn-success" disabled={busy} on:click={doUpload}>
          取り込む
        </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<div class="modal" bind:this={rulesModalEl} tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">学習ルール（摘要 → 相手方仕訳）</h5>
        <button type="button" class="btn-close" onclick={closeRulesModal}></button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        <div class="text-muted mb-2" style="font-size:0.8rem;">
          摘要の完全一致で照合する。実科目が決わっている仕訳から「隙あらば学習」して蓄積されます。
          この画面から手登録・修正・削除もできます。ルールを変えた後は「再実行」で未承認の起票を作り直せます。
        </div>
        {#if ( !showAllRulesForm ) }
        <button type="button" class="btn btn-sm btn-outline-primary mb-2"
          on:click={() => { showAllRulesForm = true; }}>
          ＋新規ルール
        </button>
        {/if}
        <table class="table table-sm table-striped table-bordered" style="font-size:0.85rem;">
          <thead class="table-light">
            <tr>
              <th style="width:190px;">口座</th>
              <th>摘要（完全一致）</th>
              <th style="width:190px;">相手方</th>
              <th class="number" style="width:60px;">使用</th>
              <th style="width:70px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color:rgba(13,110,253,0.05);">
              <td>
                <select class="form-select form-select-sm" bind:value={newRule.account}>
                  <option value="">科目</option>
                  {#each accounts as account}
                  <option value={account.code}>{account.code} {account.name}</option>
                  {/each}
                </select>
                <select class="form-select form-select-sm" bind:value={newRule.subAccount}>
                  <option value="">補助</option>
                  {#each ( ( accounts.find((a) => ( a.code === newRule.account )) || {} ).subAccounts || [] ) as sub}
                  <option value={sub.code}>{sub.name}</option>
                  {/each}
                </select>
              </td>
              <td><input type="text" class="form-control form-control-sm" bind:value={newRule.pattern}
                placeholder="正規化後の摘要（NFKC・空白潰し・完全一致）"></td>
              <td>
                <select class="form-select form-select-sm" bind:value={newRule.oppositeAccount}>
                  <option value="">科目</option>
                  {#each oppositeAccounts as account}
                  <option value={account.code}>{account.code} {account.name}</option>
                  {/each}
                </select>
                <select class="form-select form-select-sm" bind:value={newRule.oppositeSubAccount}>
                  <option value="">補助</option>
                  {#each ( ( oppositeAccounts.find((a) => ( a.code === newRule.oppositeAccount )) || {} ).subAccounts || [] ) as sub}
                  <option value={sub.code}>{sub.name}</option>
                  {/each}
                </select>
              </td>
              <td class="text-center">-</td>
              <td class="text-center">
                <button type="button" class="btn btn-sm btn-primary" on:click={createRule}>登録</button>
              </td>
            </tr>
            {#each rules as rule (rule.id)}
            <tr class:rule-edit-row={ editingRule && editingRule.id === rule.id }>
              <td>
                {#if ( editingRule === rule )}
                <select class="form-select form-select-sm" bind:value={editingRule.account}>
                  {#each accounts as account}
                  <option value={account.code}>{account.code} {account.name}</option>
                  {/each}
                </select>
                <select class="form-select form-select-sm" bind:value={editingRule.subAccount}>
                  <option value="">補助なし</option>
                  {#each ( ( accounts.find((a) => ( a.code === editingRule.account )) || {} ).subAccounts || [] ) as sub}
                  <option value={sub.code}>{sub.name}</option>
                  {/each}
                </select>
                {:else}
                {ruleAccountLabel(rule)}
                {/if}
              </td>
              <td>
                {#if ( editingRule === rule )}
                <input type="text" class="form-control form-control-sm" bind:value={editingRule.pattern}>
                {:else}
                {rule.pattern}
                {/if}
              </td>
              <td>
                {#if ( editingRule === rule )}
                <select class="form-select form-select-sm" bind:value={editingRule.oppositeAccount}>
                  <option value="">科目</option>
                  {#each oppositeAccounts as account}
                  <option value={account.code}>{account.code} {account.name}</option>
                  {/each}
                </select>
                <select class="form-select form-select-sm" bind:value={editingRule.oppositeSubAccount}>
                  <option value="">補助なし</option>
                  {#each ( ( oppositeAccounts.find((a) => ( a.code === editingRule.oppositeAccount )) || {} ).subAccounts || [] ) as sub}
                  <option value={sub.code}>{sub.name}</option>
                  {/each}
                </select>
                {:else}
                {ruleOppositeLabel(rule)}
                {/if}
              </td>
              <td class="text-center">{rule.usageCount || 0}</td>
              <td class="text-center" style="white-space:nowrap;">
                {#if ( editingRule === rule )}
                <button type="button" class="btn btn-sm btn-primary" on:click={() => { saveRule(rule); }}>保存</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" on:click={() => { editingRule = null; }}>取消</button>
                {:else}
                <button type="button" class="btn btn-sm btn-outline-secondary" title="編集"
                  on:click={() => { editingRule = JSON.parse(JSON.stringify(rule)); }}><i class="bi bi-pencil"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger" title="削除"
                  on:click={() => { deleteRule(rule); }}><i class="bi bi-trash"></i></button>
                {/if}
              </td>
            </tr>
            {/each}
          </tbody>
        </table>
        {#if ( rules.length === 0 )}
        <div class="text-muted">学習ルールはありません。実科目で起票した伝票から自動で学習します。</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" onclick={closeRulesModal}>閉じる</button>
      </div>
    </div>
  </div>
</div>

<style>
  .body {
    height: 100%;
    overflow-y: auto;
    padding: 8px;
  }
  .matched-row td {
    background-color: rgba(25, 135, 84, 0.08);
  }
  .rule-edit-row td {
    background-color: rgba(13, 110, 253, 0.08);
  }
  .modal-header h5 {
    font-size: 1rem;
  }
</style>

<script>
import axios from 'axios';
import {onMount, tick} from 'svelte';
import Modal from 'bootstrap/js/dist/modal';
import {setAccounts} from '../../javascripts/cross-slip';
import {currentPage, link as routerLink} from '../../javascripts/router.js';

export let status;
export let toast;

let id = null;
let modalEl;
let modal;
let bodyEl;
let statements = [];
let statement = null;
let accounts = [];
let warnings = [];
let cardSuggestions = [];
let preview = null;
let formError = '';
let busy = false;
let form = {};
// 学習ルール
let rulesModalEl;
let rulesModal;
let rules = [];
let editingRule = null;
let showAllRulesForm = false;
let newRule = {};

// 仮入科目（x9xxxxx）
const TEMP_ACCOUNT_CODES = [ '1900000', '3900000' ];

const KIND_LABELS = {
  bank: '通帳',
  corporate_card: 'カード',
  personal_card: '個人カード'
};
const CATEGORY_LABELS = {
  normal: '', interest: '利息', fee: '手数料', card_payment: 'デビット',
  transfer: '振替', tax: '税', other: 'その他'
};
const STATUS_LABELS = {
  unmatched: '未照合', matched: '照合済', booked: '起票済',
  ignored: '対象外', selected: '精算書へ'
};
const STATUS_COLORS = {
  unmatched: 'bg-secondary', matched: 'bg-success', booked: 'bg-primary',
  ignored: 'bg-dark', selected: 'bg-info'
};

const kindLabel = (kind) => ( KIND_LABELS[ kind ] || kind );
const categoryLabel = (category) => ( CATEGORY_LABELS[ category ] || category );
const statusLabel = (status) => ( STATUS_LABELS[ status ] || status );
const statusColor = (status) => ( STATUS_COLORS[ status ] || 'bg-secondary' );

$: bankAccounts = ( accounts || [] ).filter((a) => ( /^101/.test(a.code) ));
$: bankSubAccounts = ( ( bankAccounts.find((a) => ( a.code === form.account )) || {} ).subAccounts || [] );
$: detailSubAccounts = ( statement && statement.kind === 'bank' ) ?
  ( ( bankAccounts.find((a) => ( a.code === statement.account )) || {} ).subAccounts || [] ) : [];

// 相手方仕訳の選択肢（銀行口座自身と仮入科目は相手にしない）
$: oppositeAccounts = ( accounts || [] ).filter((a) => ( !/^101/.test(a.code) && a.code !== '1900000' && a.code !== '3900000' ));

// 未照合行数（起票対象の内訳表示用）
$: unmatchedCount = ( statement && statement.lines ) ?
  statement.lines.filter((line) => ( line.status === 'unmatched' )).length : 0;

// 状態の内訳（ヘッダ表示用）
$: statusCounts = ( statement && statement.lines ) ? {
  matched: statement.lines.filter((l) => ( l.status === 'matched' )).length,
  booked: statement.lines.filter((l) => ( l.status === 'booked' && l.crossSlipDetailId )).length,
  ignored: statement.lines.filter((l) => ( l.status === 'ignored' )).length,
  unmatched: statement.lines.filter((l) => ( l.status === 'unmatched' )).length
} : { matched: 0, booked: 0, ignored: 0, unmatched: 0 };

// 一括起票の対象行（未照合、または伝票消滅で迷子になった起票済み行。
// 相手方の決定はルール→仮入科目に落ちるので全行が対象になる）
$: bookTargets = ( statement && statement.lines ) ?
  statement.lines.filter((line) => {
    if ( line.status === 'booked' ) {
      return !line.crossSlipDetailId;
    }
    return line.status === 'unmatched';
  }) : [];

// 起票済み行が仮入科目（出金仮/入金仮）か
const isTentative = (line) => {
  const d = line.crossSlipDetail;
  if ( !d ) {
    return false;
  }
  return ( d.debitAccount === '1900000' ) || ( d.creditAccount === '3900000' );
};

const cardSuggestion = (lineId) => {
  return cardSuggestions.find((s) => ( s.lineId === lineId )) || null;
};

const goList = () => {
  routerLink('/bank-statement');
};

const loadList = async () => {
  const result = await axios.get('/api/bank_statement');
  statements = ( result.data && result.data.values ) || [];
};

// 詳細画面のスクロール位置。伝票を開いて戻ってきたときに復元する
// （sessionStorageに入れるのでフルリロードしても生きる）
const SCROLL_KEY = 'bank-statement-scroll';
const saveScroll = () => {
  if ( bodyEl && id ) {
    sessionStorage.setItem(SCROLL_KEY, String(bodyEl.scrollTop));
  }
};
const restoreScroll = async () => {
  const pos = sessionStorage.getItem(SCROLL_KEY);
  if ( pos === null ) {
    return;
  }
  sessionStorage.removeItem(SCROLL_KEY);
  await tick();
  if ( bodyEl ) {
    bodyEl.scrollTop = parseInt(pos);
  }
};

// 科目コード→「名前/補助名」のラベル
const accountLabel = (code, subCode) => {
  if ( !code ) {
    return '';
  }
  const account = ( accounts || [] ).find((a) => ( a.code === code ));
  const sub = subCode ? ( ( ( account || {} ).subAccounts || [] ).find((s) => ( s.code === subCode )) || {} ) : {};
  return ( account ? account.name : code ) + ( sub.name ? `/${sub.name}` : '' );
};

// 学習ルールの提案（表示用）。相手方は起票時にサーバ側で決まる（ルール→仮）
const applyOppositeSuggestions = (suggestions) => {
  for ( const line of ( statement && statement.lines ) || [] ) {
    line._oppositeLabel = '';
    if ( line.status !== 'unmatched' ) continue;
    const s = ( suggestions || [] ).find((sug) => ( sug.lineId === line.id ));
    if ( s && s.learned ) {
      line._oppositeLabel = accountLabel(s.oppositeAccount, s.oppositeSubAccount);
    }
  }
};

const loadDetail = async (statementId) => {
  const result = await axios.get(`/api/bank_statement/${statementId}`);
  statement = ( result.data && result.data.statement ) || null;
  warnings = [];
  cardSuggestions = [];
  applyOppositeSuggestions(result.data.oppositeSuggestions);
  await restoreScroll();
};

// 伝票を開く（戻り先はこの画面。スクロール位置を保存してから遷移する）
const openSlip = (slip) => {
  saveScroll();
  routerLink(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${encodeURIComponent('/bank-statement/' + id)}`);
};

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  id = args[2] ? parseInt(args[2]) : null;
  if ( id ) {
    loadDetail(id);
  } else {
    statement = null;
    loadList();
  }
};

onMount(async () => {
  modal = new Modal(modalEl);
  const accs = await axios.get('/api/accounts');
  accounts = Array.isArray(accs.data) ? accs.data : ( accs.data.values || [] );
  // 伝票と同じ科目検索（account.svelte）はこの共通リストを使う
  setAccounts(accounts);
  checkPage();
});

$: checkPage($currentPage);

// モーダルはBootstrapのModalで制御する（開閉時に状態を戻す）
const openModal = () => {
  preview = null;
  formError = '';
  form = { kind: 'bank' };
  modal?.show();
};
const closeModal = () => {
  preview = null;
  formError = '';
  form = {};
  modal?.hide();
};

const doPreview = async () => {
  if ( form.kind === 'bank' && !form.account ) {
    formError = '科目を選択してください。';
    return;
  }
  busy = true;
  formError = '';
  try {
    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('kind', form.kind);
    const result = await axios.post('/api/bank_statement/preview', fd,
      { 'content-type': 'multipart/form-data' });
    if ( result.data && result.data.code === 0 ) {
      preview = result.data;
    } else {
      formError = result.data.message || '読み取りに失敗しました。';
    }
  } catch (e) {
    formError = ( e.response && e.response.data && e.response.data.message ) || '読み取りに失敗しました。';
  }
  busy = false;
};

const doUpload = async () => {
  if ( form.kind === 'bank' && !form.account ) {
    formError = '科目を選択してください。';
    return;
  }
  busy = true;
  formError = '';
  try {
    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('kind', form.kind);
    if ( form.account ) fd.append('account', form.account);
    if ( form.subAccount ) fd.append('subAccount', form.subAccount);
    if ( form.cardName ) fd.append('cardName', form.cardName);
    const result = await axios.post('/api/bank_statement/upload', fd,
      { 'content-type': 'multipart/form-data' });
    if ( result.data && result.data.code === 0 ) {
      modal?.hide();
      preview = null;
      form = {};
      if ( result.data.warnings.length > 0 ) {
        toast.show('明細取込', `取り込みました（警告 ${result.data.warnings.length}件）`, 'warning');
      } else {
        toast.show('明細取込', '取り込みました');
      }
      routerLink(`/bank-statement/${result.data.id}`);
    } else {
      formError = result.data.message || '取り込みに失敗しました。';
    }
  } catch (e) {
    formError = ( e.response && e.response.data && e.response.data.message ) || '取り込みに失敗しました。';
  }
  busy = false;
};

const runMatch = async () => {
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/match`);
    statement = result.data.statement;
    cardSuggestions = result.data.suggestions || [];
    applyOppositeSuggestions(result.data.oppositeSuggestions);
    toast.show('明細取込', `${result.data.matched}行を突合しました`);
  } catch (e) {
    toast.show('明細取込', '突合に失敗しました', 'warning');
  }
  busy = false;
};

// 行に単独起票できるか（相手方の決定はサーバ側でルール→仮に落ちる）
const canBookLine = (line) => {
  return ( line.status === 'unmatched' || ( line.status === 'booked' && !line.crossSlipDetailId ) );
};

// 起票済み行の相手方仕訳の表示ラベル（伝票明細から復元する）
const bookedOppositeLabel = (line) => {
  const d = line.crossSlipDetail;
  if ( !d ) return '';
  const code = ( line.amountIn != null ) ? d.creditAccount : d.debitAccount;
  const subCode = ( line.amountIn != null ) ? d.creditSubAccount : d.debitSubAccount;
  return accountLabel(code, subCode);
};

// 指定した明細行だけ起票する（未指定なら未照合行をまとめて）。
// ボタンの on:click からイベントオブジェクトが渡っても配列以外は捨てる
const runBook = async (givenBookings = null) => {
  if ( givenBookings && !Array.isArray(givenBookings) ) {
    givenBookings = null;
  }
  busy = true;
  try {
    // 相手方の決定はサーバ側（学習ルール→仮入科目）。フロントは行IDだけ渡す
    const bookings = givenBookings || [];
    const result = await axios.post(`/api/bank_statement/${id}/book`, { bookings: bookings });
    if ( result.data && result.data.code === 0 ) {
      statement = Object.assign({}, statement, { lines: result.data.lines });
      // 起票済みの行はカード引落候補の表示対象から外す
      const bookedLineIds = ( statement.lines || [] )
        .filter((l) => ( l.status === 'booked' ))
        .map((l) => l.id);
      cardSuggestions = cardSuggestions.filter((s) => !bookedLineIds.includes(s.lineId));
      // 仮起票の伝票を確認できた分だけ「後の処理」で差し替わる（次回の突合時）
      toast.show('明細取込', `${result.data.slips.length}枚の伝票を起票しました（承認待ち。ルール未命中は仮入科目になります）`);
    } else {
      // code≠0はサイレントに来る（権限等）。原因がわかるように表示する
      const detail = result.data ? `（code=${result.data.code}）` : '';
      toast.show('明細取込', `起票に失敗しました${detail}`, 'warning');
    }
  } catch (e) {
    console.error('book failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `起票に失敗しました${status}`;
    toast.show('明細取込', message, 'warning');
  }
  busy = false;
};

// この明細だけ単独で起票する
const bookLine = (line) => {
  return runBook([{ lineId: line.id }]);
};

// 「再実行」。未承認の起票伝票を解放して現行ルールで作り直す
const runRebook = async () => {
  if ( !window.confirm('確定（承認済み）以外の起票伝票を解放して、現行ルールで起票し直します。よろしいですか？') ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/rebook`);
    if ( result.data && result.data.code === 0 ) {
      statement = Object.assign({}, statement, { lines: result.data.lines });
      toast.show('明細取込', `起票済み${result.data.rebooked}行を再起票しました（スキップ${result.data.skipped}行）`);
    } else {
      const detail = result.data ? `（code=${result.data.code}）` : '';
      toast.show('明細取込', `再実行に失敗しました${detail}`, 'warning');
    }
  } catch (e) {
    console.error('rebook failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `再実行に失敗しました${status}`;
    toast.show('明細取込', message, 'warning');
  }
  busy = false;
};

// 学習ルールのモーダル
const openRulesModal = async (line = null) => {
  editingRule = null;
  showAllRulesForm = false;
  const pattern = line ?
    String(line.rawDescription || '').normalize('NFKC').replace(/[\s\u3000]+/g, '') : '';
  newRule = {
    account: ( statement && statement.account ) || '',
    subAccount: '',
    pattern: pattern,
    // 仮で起票済みの行から登録する場合は既に起票済み伝票からは引き出せないので空
    oppositeAccount: '',
    oppositeSubAccount: ''
  };
  if ( !rulesModal ) {
    rulesModal = new Modal(rulesModalEl);
  }
  try {
    const result = await axios.get('/api/bank_statement_rule');
    rules = ( result.data && result.data.values ) || [];
  } catch (e) {
    console.error('load rules failed', e);
    rules = [];
  }
  rulesModal.show();
};
const closeRulesModal = () => {
  rulesModal?.hide();
};
const ruleAccountLabel = (rule) => {
  return accountLabel(rule.account, rule.subAccount);
};
const ruleOppositeLabel = (rule) => {
  return accountLabel(rule.oppositeAccount, rule.oppositeSubAccount);
};
const createRule = async () => {
  try {
    await axios.post('/api/bank_statement_rule', {
      account: newRule.account,
      subAccount: newRule.subAccount || null,
      pattern: newRule.pattern,
      oppositeAccount: newRule.oppositeAccount,
      oppositeSubAccount: newRule.oppositeSubAccount || null
    });
    newRule = {};
    showAllRulesForm = false;
    const result = await axios.get('/api/bank_statement_rule');
    rules = ( result.data && result.data.values ) || [];
    toast.show('学習ルール', 'ルールを登録しました');
  } catch (e) {
    console.error('create rule failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '登録に失敗しました';
    toast.show('学習ルール', message, 'warning');
  }
};
const saveRule = async (rule) => {
  try {
    await axios.put(`/api/bank_statement_rule/${rule.id}`, {
      account: rule.account,
      subAccount: rule.subAccount || null,
      pattern: rule.pattern,
      oppositeAccount: rule.oppositeAccount,
      oppositeSubAccount: rule.oppositeSubAccount || null
    });
    editingRule = null;
    const result = await axios.get('/api/bank_statement_rule');
    rules = ( result.data && result.data.values ) || [];
    toast.show('学習ルール', 'ルールを更新しました');
  } catch (e) {
    console.error('save rule failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '更新に失敗しました';
    toast.show('学習ルール', message, 'warning');
  }
};
const deleteRule = async (rule) => {
  if ( !window.confirm('このルールを削除しますか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/bank_statement_rule/${rule.id}`);
    rules = rules.filter((r) => ( r.id !== rule.id ));
    toast.show('学習ルール', 'ルールを削除しました');
  } catch (e) {
    console.error('delete rule failed', e);
    toast.show('学習ルール', '削除に失敗しました', 'warning');
  }
};

const setIgnored = async (line, ignored) => {
  await axios.put(`/api/bank_statement/line/${line.id}`, {
    status: ignored ? 'ignored' : 'unmatched'
  });
  loadDetail(id);
};

// 伝票消滅で迷子になった起票済み行を未照合に戻す
const restoreLine = async (line) => {
  await axios.put(`/api/bank_statement/line/${line.id}`, { status: 'unmatched' });
  loadDetail(id);
};

// 口座の設定（取り込み時に口座を指定しなかった分の後付け）
const saveAccount = async () => {
  if ( !statement.account ) {
    toast.show('明細取込', '科目を選択してください', 'warning');
    return;
  }
  try {
    await axios.put(`/api/bank_statement/${id}`, {
      account: statement.account,
      subAccount: statement.subAccount
    });
    toast.show('明細取込', '口座を設定しました');
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '口座の設定に失敗しました';
    toast.show('明細取込', message, 'warning');
  }
};

const deleteStatement = async (statement) => {
  if ( !window.confirm('この取込を削除しますか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/bank_statement/${statement.id}`);
    loadList();
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '削除に失敗しました';
    toast.show('明細取込', message, 'warning');
  }
};
</script>
