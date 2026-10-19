<div class="page-title d-flex justify-content-between">
  <h1>明細取込</h1>
  <div>
    {#if ( id )}
    <button type="button" class="btn btn-outline-secondary" on:click={goList}>一覧へ戻る</button>
    {:else}
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
      on:click={runBook}>一括起票（{bookTargets.length}行）</button>
    {/if}
  </div>
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
          <th style="width:200px;">起票用 支払先</th>
          <th style="width:60px;"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each statement.lines as line}
        <tr>
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
            {#if ( line.status === 'unmatched' && line.category !== 'interest' )}
            {#key payeeMappings.length}
            <select class="form-select form-select-sm" bind:value={line._payeeMappingId}>
              <option value={null}></option>
              {#each payeeMappings as mapping}
              <option value={mapping.id}>{mappingLabel(mapping)}</option>
              {/each}
            </select>
            {/key}
            {/if}
          </td>
          <td>
            {#if ( line.status === 'unmatched' || ( line.status === 'booked' && !line.crossSlipDetailId ) )}
            {#key payeeMappings.length}
            <select class="form-select form-select-sm" bind:value={line._payeeMappingId}
              disabled={line.status !== 'unmatched'}>
              <option value={null}></option>
              {#each payeeMappings as mapping}
              <option value={mapping.id}>{mappingLabel(mapping)}</option>
              {/each}
            </select>
            {/key}
            {/if}
          </td>
          <td>
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
          <td><a class="btn btn-link p-0" href={`/bank-statement/${statement.id}`}>{statement.fileName}{statement.cardName ? `（${statement.cardName}）` : ''}</a></td>
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

<style>
  .body {
    height: 100%;
    overflow-y: auto;
    padding: 8px;
  }
</style>

<script>
import axios from 'axios';
import {onMount, tick} from 'svelte';
import Modal from 'bootstrap/js/dist/modal';
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
let payeeMappings = [];
let warnings = [];
let cardSuggestions = [];
let preview = null;
let formError = '';
let busy = false;
let form = {};

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

const mappingLabel = (mapping) => {
  return ( mapping && mapping.description ) ? `${mapping.name}（${mapping.description}）` : ( mapping ? mapping.name : '' );
};

$: bankAccounts = ( accounts || [] ).filter((a) => ( /^101/.test(a.code) ));
$: bankSubAccounts = ( ( bankAccounts.find((a) => ( a.code === form.account )) || {} ).subAccounts || [] );
$: detailSubAccounts = ( statement && statement.kind === 'bank' ) ?
  ( ( bankAccounts.find((a) => ( a.code === statement.account )) || {} ).subAccounts || [] ) : [];

// 一括起票の対象行（未照合、または伝票消滅で迷子になった起票済み行）
$: bookTargets = ( statement && statement.lines ) ?
  statement.lines.filter((line) => {
    if ( line.status === 'booked' ) {
      return !line.crossSlipDetailId;
    }
    if ( line.status !== 'unmatched' ) return false;
    return line.category === 'interest' || line._payeeMappingId || cardSuggestion(line.id);
  }) : [];

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

const loadDetail = async (statementId) => {
  const result = await axios.get(`/api/bank_statement/${statementId}`);
  statement = ( result.data && result.data.statement ) || null;
  warnings = [];
  cardSuggestions = [];
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
  const mappings = await axios.get('/api/expense_mapping?kind=payee');
  payeeMappings = ( mappings.data && mappings.data.values ) || [];
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
    toast.show('明細取込', `${result.data.matched}行を突合しました`);
  } catch (e) {
    toast.show('明細取込', '突合に失敗しました', 'warning');
  }
  busy = false;
};

const runBook = async () => {
  busy = true;
  try {
    const bookings = [];
    for ( const line of statement.lines ) {
      const isStuck = ( line.status === 'booked' && !line.crossSlipDetailId );
      if ( line.status !== 'unmatched' && !isStuck ) continue;
      const suggestion = cardSuggestion(line.id);
      if ( line.category === 'interest' ) {
        bookings.push({ lineId: line.id });
      } else if ( line._payeeMappingId ) {
        bookings.push({ lineId: line.id, payeeMappingId: line._payeeMappingId });
      } else if ( suggestion ) {
        bookings.push({
          lineId: line.id,
          debitAccount: suggestion.debitAccount,
          debitSubAccount: suggestion.debitSubAccount
        });
      }
    }
    if ( bookings.some((b) => ( !b.payeeMappingId && !b.debitAccount )) ) {
      // カード引落候補も支払先も無い行は起票できない（利息以外）
      const broken = bookings.filter((b) => ( !b.payeeMappingId && !b.debitAccount ));
      const okLines = statement.lines.filter((l) => broken.some((b) => ( b.lineId === l.id )) &&
        l.category !== 'interest');
      if ( okLines.length > 0 ) {
        toast.show('明細取込', '支払先が未指定の行があります。', 'warning');
        busy = false;
        return;
      }
    }
    const result = await axios.post(`/api/bank_statement/${id}/book`, { bookings: bookings });
    if ( result.data && result.data.code === 0 ) {
      statement = result.data.statement;
      toast.show('明細取込', `${result.data.slips.length}枚の伝票を起票しました（承認待ち）`);
    } else {
      toast.show('明細取込', '起票に失敗しました', 'warning');
    }
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '起票に失敗しました';
    toast.show('明細取込', message, 'warning');
  }
  busy = false;
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
