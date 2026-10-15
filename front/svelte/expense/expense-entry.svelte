<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>経費精算書入力</h1>
  </div>
  <div class="">
    <div class="content">
      <div class="body full-height-2">
        {#if !ok }
        <div class="border rounded border-danger mb-3 ms-2 me-2 p-3">
          <h5 class="fs-5 text-danger"><i class="bi bi-exclamation-triangle-fill"></i>&nbsp;エラー</h5>
          <ul>
            {#each errorMessages as errorMessage}
              <li class="text-danger">{errorMessage}</li>
            {/each}
          </ul>
        </div>
        {/if}
        <div class="container-fluid">
          <div class="row mt-2">
            <label for="submittedAt" class="col-2 col-form-label">提出日</label>
            <div class="col-sm-3">
              <input type="date" class="form-control" id="submittedAt"
                bind:value={report.submittedAt} disabled={!editable}>
            </div>
            <label class="col-2 col-form-label">提出者</label>
            <div class="col-sm-3">
              <input type="text" class="form-control"
                value={submitterName} disabled>
            </div>
            {#if ( report.crossSlip )}
            <div class="col-sm-4">
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openSlip(report.crossSlip);
                }}>
                <i class="bi bi-journal-text"></i>&nbsp;伝票 {report.crossSlip.year}/{report.crossSlip.month}-{report.crossSlip.no}
              </button>
              {#if ( report.crossSlip.approvedAt )}
              <span class="badge bg-success">済</span>
              {:else}
              <span class="badge bg-warning text-dark">承認待ち</span>
              {#if ( editable )}
              <button type="button" class="btn btn-sm btn-outline-danger"
                on:click={deleteSlip} title="紐付伝票が未処理のまま残っています。削除できます。">
                <i class="bi bi-trash"></i>&nbsp;伝票削除
              </button>
              {/if}
              {/if}
            </div>
            {/if}
          </div>
          <div class="row mt-3">
            <label for="company" class="col-2 col-form-label">取引先</label>
            <div class="col-10">
              <CompanySelect
                bind:companyId={report.companyId}
                companyName={report.company ? report.company.name : ''}></CompanySelect>
            </div>
          </div>
          <div class="row mt-3">
            <label for="task" class="col-2 col-form-label">案件</label>
            <div class="col-sm-3">
              {#key tasks.length}
              <select class="form-select" id="task" bind:value={report.taskId} disabled={!editable}>
                <option value={null}>-- 未設定 --</option>
                {#each tasks as task}
                <option value={task.id}>{task.name}</option>
                {/each}
              </select>
              {/key}
            </div>
          </div>
          <div class="row mt-3">
            <label for="purpose" class="col-2 col-form-label">目的</label>
            <div class="col-10">
              <textarea class="form-control" id="purpose" rows="2"
                bind:value={report.purpose} disabled={!editable}></textarea>
            </div>
          </div>
          {#if ( report.approvedAt )}
          <div class="row mt-3">
            <label class="col-2 col-form-label">承認者</label>
            <div class="col-sm-3">
              <input type="text" class="form-control"
                value={report.approver ? report.approver.name : ''} disabled>
            </div>
            <label class="col-2 col-form-label">承認日</label>
            <div class="col-sm-3">
              <!-- 提出日と同じdate入力で表示形式を揃える -->
              <input type="date" class="form-control"
                value={approvedDateStr} disabled>
            </div>
          </div>
          {/if}
        </div>
        <div class="container-fluid mt-4">
          <div class="table-responsive">
          <table class="table table-striped table-bordered expense-table">
            <thead class="table-light">
              <tr>
                <th scope="col" style="width: 260px;">支払日 / 支払先</th>
                <th scope="col" style="width: 110px;">支払金額</th>
                <th scope="col">内容</th>
                <th scope="col" style="width: 150px;">出金元</th>
                <th scope="col" style="width: 170px;">証憑</th>
                <th scope="col" style="width: 74px;"></th>
              </tr>
            </thead>
            <tbody>
              {#each report.lines as line, i}
              <tr
                on:drop|preventDefault={onDrop}
                on:dragenter|preventDefault={onDragEnter}
                on:dragleave|preventDefault={onDragLeave}
                on:dragover|preventDefault
                data-index={i}>
                <td class="input">
                  <div>
                    <input type="date" class="form-control form-control-sm"
                      bind:value={line.paymentDate} disabled={!editable}>
                  </div>
                  <div class="mt-1">
                    <!-- 支払先は経理が登録した支払先マッピングから選ぶ（件数は知れているので単純なselect）。
                         optionsは非同期ロードなので揃ってからselectを作り直す（バインド値の再適用のため） -->
                    {#key payeeMappings.length}
                    <select class="form-select form-select-sm"
                      bind:value={line.payeeMappingId} disabled={!editable}>
                      <option value={null}></option>
                      {#each payeeMappings as mapping}
                      <option value={mapping.id}>{mapping.name}</option>
                      {/each}
                    </select>
                    {/key}
                  </div>
                  {#if ( line.payeeMappingId )}
                    {#if ( lineHints[i] )}
                    <div class="text-muted" style="font-size:0.75rem;">
                      → {lineHints[i]}
                    </div>
                    {:else}
                    <div class="text-danger" style="font-size:0.75rem;">
                      <i class="bi bi-exclamation-triangle-fill"></i>&nbsp;マッピング未登録
                    </div>
                    {/if}
                  {/if}
                </td>
                <td class="number input">
                  <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
                    style="width:100%;"
                    bind:value={line.amount} disabled={!editable}>
                </td>
                <td class="input">
                  <div>
                    <input type="text" class="form-control form-control-sm"
                      placeholder="内容"
                      bind:value={line.description} disabled={!editable}>
                  </div>
                  <div>
                    <input type="text" class="form-control form-control-sm"
                      placeholder="備考"
                      bind:value={line.note} disabled={!editable}>
                  </div>
                </td>
                <td class="input">
                  {#key paymentMappings.length}
                  <select class="form-select form-select-sm"
                    bind:value={line.paymentMappingId} disabled={!editable}>
                    <option value={null}></option>
                    {#each paymentMappings as mapping}
                    <option value={mapping.id}>{mapping.name}</option>
                    {/each}
                  </select>
                  {/key}
                </td>
                <td>
                  {#if ( line.voucherId )}
                  <div class="d-flex align-items-start">
                    {#if ( line.voucher && line.voucher.files && line.voucher.files.length > 0 )}
                    {#each line.voucher.files as file}
                    <div class="me-1">
                      {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                      <button type="button" class="thumb-button" title="クリックで拡大表示"
                        on:click={() => { openPreview(line.voucher, file); }}>
                        <img src="/voucher/file/{file.id}?v={imageVersion}" class="thumb"/>
                      </button>
                      {:else}
                      <a href="/voucher/file/{file.id}?v={imageVersion}" target="_blank">
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
                      </a>
                      {/if}
                    </div>
                    {/each}
                    {:else}
                    <i class="bi bi-file-earmark-text"></i>
                    {/if}
                    {#if ( editable )}
                    <button type="button" class="btn btn-warning btn-sm p-0 px-1 me-1"
                      on:click={() => { unbindVoucher(line); }} title="証憑の紐付けを解除">
                      <i class="bi bi-x-circle"></i>
                    </button>
                    {/if}
                  </div>
                  {:else if ( line.pendingFiles && line.pendingFiles.length > 0 )}
                  <div class="pending-file">
                    {#each line.pendingFiles as pf, j}
                    <div class="d-flex align-items-start">
                      <div class="me-1">
                        {#if ( pf.url )}
                        <button type="button" class="thumb-button" title="クリックで拡大表示"
                          on:click={() => { openPreviewRaw(pf.url, pf.name); }}>
                          <img src={pf.url} class="thumb"/>
                        </button>
                        {:else}
                        <button type="button" class="thumb-button" title="クリックで別タブ表示"
                          on:click={() => { window.open(pf.blobUrl, '_blank'); }}>
                          <img src="/public/icons/icon_pdf.png" class="thumb"/>
                        </button>
                        {/if}
                      </div>
                      <div class="pending-name">
                        {pf.name}
                        {#if ( editable )}
                        <button type="button" class="btn btn-sm btn-outline-danger p-0 px-1"
                          on:click={() => { removePendingFile(line, j); }}>
                          <i class="bi bi-x"></i>
                        </button>
                        {/if}
                      </div>
                    </div>
                    {/each}
                  </div>
                  {:else}
                  <label class="btn btn-sm btn-outline-primary upload-label">
                    アップロード
                    <input type="file" hidden multiple accept="image/*,application/pdf"
                      disabled={!editable}
                      on:change={(e) => addPendingFiles(line, e.target.files)}>
                  </label>
                  {/if}
                  {#if ( ( line.voucherId || ( line.pendingFiles && line.pendingFiles.length > 0 ) ) &&
                        aiAvailable && editable )}
                  <button type="button" class="btn btn-sm btn-outline-info"
                    disabled={line._aiBusy}
                    on:click={() => aiRead(line)}>
                    {#if ( line._aiBusy )}
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    読み取り中…{line._aiSecs || 0}秒
                    {:else}
                    AI読み取り
                    {/if}
                  </button>
                  {/if}
                </td>
                <td style="text-align:center;">
                  {#if ( editable )}
                  <button type="button" class="btn btn-primary btn-sm"
                    on:click={() => { report.lines.splice(i + 1, 0, {}); report.lines = report.lines; }}>
                    <i class="bi bi-plus"></i>
                  </button>
                  {#if ( report.lines.length > 1 )}
                  <button type="button" class="btn btn-danger btn-sm"
                    on:click={() => { report.lines.splice(i, 1); report.lines = report.lines; }}>
                    <i class="bi bi-dash"></i>
                  </button>
                  {/if}
                  {/if}
                </td>
              </tr>
              {/each}
              <tr>
                <td>
                  合計
                </td>
                <td class="number">
                  {totalAmount.toLocaleString()}
                </td>
                <td colspan="4">
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        {#if ( editable || ( report.vouchers && report.vouchers.length > 0 ) )}
        <div class="container-fluid pile-dropzone"
          class:over={pileDragCount > 0}
          on:dragenter={onPileDragEnter}
          on:dragleave={onPileDragLeave}
          on:dragover={(e) => { if ( editable && e.dataTransfer.types.includes('Files') ) { e.preventDefault(); } }}
          on:drop={onPileDrop}>
          <div class="d-flex align-items-center mb-1">
            <h2 class="fs-5 me-3 mb-0">未整理の証憑</h2>
            <span class="badge bg-secondary me-2" title="明細にまだ紐付けていない証憑">残り {pileVouchers.length}件</span>
            {#if ( linkedVouchers.length > 0 )}
            <span class="badge bg-success" title="明細行に紐付け済み">処理済み {linkedVouchers.length}行（{linkedSum.toLocaleString()}円）</span>
            {/if}
            <label class="btn btn-sm btn-outline-primary upload-label ms-2">
              まとめてアップロード
              <input type="file" hidden multiple accept="image/*,application/pdf"
                disabled={!editable}
                on:change={(e) => { uploadVouchers(e.target.files); e.target.value = ''; }}>
            </label>
          </div>
          <div class="drop-hint">
            {#if ( pileVouchers.length > 0 )}
            <div class="table-responsive pile-table">
            <table class="table table-striped table-bordered">
              <thead class="table-light">
                <tr>
                  <th>ファイル</th>
                  <th>説明</th>
                  <th class="number">金額</th>
                  <th style="width:110px;"></th>
                </tr>
              </thead>
              <tbody>
                {#each pileVouchers as line}
                <tr draggable="true" on:dragstart={onDragStart} on:dragend={onDragEnd}
                  data-id={line.id} title="明細行へドラッグ&ドロップで紐付けできます">
                  <td>
                    <div class="d-flex align-items-start">
                    {#each line.files as file}
                      <div class="me-1">
                        {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                        <button type="button" class="thumb-button" title="クリックで拡大表示"
                          on:click={() => { openPreview(line, file); }}>
                          <img src="/voucher/file/{file.id}?v={imageVersion}" class="thumb"/>
                        </button>
                        {:else}
                        <a href="/voucher/file/{file.id}?v={imageVersion}" target="_blank">
                          <img src="/public/icons/icon_pdf.png" class="thumb"/>
                        </a>
                        {/if}
                      </div>
                      {/each}
                    </div>
                  </td>
                  <td class="pile-desc">
                    <input type="text" class="form-control form-control-sm"
                      placeholder={ line.files[0] ? line.files[0].name : '説明' }
                      title="説明を入力できます（省略時はファイル名で表示）"
                      bind:value={line.description}
                      disabled={!editable}
                      on:change={() => { savePileDescription(line); }}>
                  </td>
                  <td class="number">{line.amount != null ? numeric(line.amount).toLocaleString() : ''}</td>
                  <td style="white-space:nowrap;">
                    {#if ( editable )}
                    <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                      title="左90°回転" on:click={() => { rotatePileVoucher(line, 270); }}>
                      <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                      title="右90°回転" on:click={() => { rotatePileVoucher(line, 90); }}>
                      <i class="bi bi-arrow-clockwise"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-info p-0 px-1 me-1"
                      title="複数の証憑が写っている場合は分離、1枚の場合は背景を除いて切り出します"
                      on:click={() => { splitPileVoucher(line); }}>
                      <i class="bi bi-scissors"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger p-0 px-1"
                      on:click={() => { deletePileVoucher(line); }}>
                      <i class="bi bi-x"></i>
                    </button>
                    {/if}
                  </td>
                </tr>
                {/each}
              </tbody>
            </table>
            <p class="text-muted mb-1 px-1">ファイルをこの枠へドラッグ&ドロップしても追加できます。登録済みの証憑は、明細行へドラッグ&ドロップして紐付けてください<span class="d-inline-flex align-items-center ms-1"><i class="bi bi-link-45deg fs-4"></i></span></p>
            </div>
            {:else}
            <div class="text-center text-muted py-4">
              <i class="bi bi-cloud-arrow-up fs-2 d-block"></i>
              ここに領収書などの画像・PDFをドラッグ&ドロップするか、
              「まとめてアップロード」で一括登録してください
            </div>
            {/if}
          </div>
        </div>
        {/if}
      </div>
  <div class="d-flex justify-content-end mt-3 mb-5">
    <div>
      <button type="button" class="btn btn-secondary me-2"
        on:click={close_}>もどる</button>
      {#if ( editable && report.id )}
        <button type="button" class="btn btn-danger me-2"
          on:click={delete_}
          id="delete-button">削除</button>
      {/if}
      {#if ( status.user.approvable && report.id )}
        {#if ( !report.approvedAt )}
        <button type="button" class="btn btn-success me-2"
          on:click={approve} id="approve-button">承認</button>
        {:else}
        <button type="button" class="btn btn-warning me-2"
          on:click={disapprove} id="disapprove-button">不承認</button>
        {/if}
      {/if}
      {#if ( editable )}
        <button type="button" class="btn btn-primary"
          on:click={save} id="save-button">保存</button>
      {/if}
    </div>
  </div>
    </div>
  </div>
</div>

{#if ( preview )}
<div class="preview-overlay" on:click|self={() => { preview = null; }}>
  <div class="preview-box">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>{preview.title}</strong>
      <div>
        <a href={preview.src} target="_blank" class="btn btn-sm btn-outline-secondary me-2">別タブで開く</a>
        <button type="button" class="btn btn-sm btn-secondary" on:click={() => { preview = null; }}>閉じる</button>
      </div>
    </div>
    <img src={preview.src} class="preview-img" alt={preview.title}/>
  </div>
</div>
{/if}

<style>
.thumb-button {
  padding: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
}
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-box {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  max-width: 92vw;
}
.preview-img {
  max-width: 88vw;
  max-height: 80vh;
  object-fit: contain;
}
.thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
.pending-file {
  font-size: 0.75rem;
}
.pending-name {
  font-size: 0.75rem;
}
tr.over {
  background-color: #e8f4e8;
}
.upload-label {
  white-space: nowrap;
}
.pile-dropzone.over {
  background-color: #eef6ff;
  outline: 2px dashed #4d8fd1;
  outline-offset: -6px;
}
.drop-hint {
  border: 2px dashed #a9c6e8;
  border-radius: 6px;
  padding: 6px;
  min-height: 100px;
}
.pile-dropzone.over .drop-hint {
  border-color: #4d8fd1;
}
.pile-table {
  max-height: 30vh;
  overflow: auto;
}
.pile-desc {
  width: 40%;
  min-width: 160px;
}
</style>

<script>
import axios from 'axios';
import {numeric} from '../../../libs/utils';
import {onMount, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import CompanySelect from '../components/company-select.svelte';
import {link} from '../../javascripts/router.js';
import eventBus from '../../javascripts/event-bus.js';

export let report;
export let status;
export let toast;

let companies = [];
let tasks = [];
let mappings = [];
let accounts = [];
let aiAvailable = false;
let ok = true;
let errorMessages = [];
let submitterName = '';
// 未整理の証憑。精算書のパイル(report.vouchers)と、精算書に紐付いていない
// 浮遊証憑(floatings: 設定ページや未保存精算書からアップロードされたもの)
let floatings = [];
// 証憑画像の差し替え後の再表示用（ブラウザキャッシュを無効化するバージョン）
let imageVersion = 0;
let dragCounter = [];

$: submitterName = report.submitter ? report.submitter.name : (status.user.name || '');

// GET/保存応答の submittedAt はISO日時文字列で返るため、date入力に
// 再バインドできるよう YYYY-MM-DD に正規化する
$: if ( report && report.submittedAt && ( String(report.submittedAt).length > 10 ) ) {
  report.submittedAt = String(report.submittedAt).slice(0, 10);
}

// 承認日もdate入力（提出日と同じ表示形式）に出すための正規化
$: approvedDateStr = report && report.approvedAt ? String(report.approvedAt).slice(0, 10) : '';

// 空テーブルでも行の「+」が操作できるように、明細バッファには常に空行を1行積んでおく
$: if ( report && ( !report.lines || report.lines.length === 0 ) ) {
  report.lines = [{}];
}

$: paymentMappings = mappings.filter((m) => ( m.kind === 'payment' ));

$: payeeMappings = mappings.filter((m) => ( m.kind === 'payee' ));

$: editable = !report.approvedAt &&
  (( status.user.accounting ) || ( status.user.approvable ) ||
   ( report.createdBy === status.user.id ) || ( !report.id ));

$: totalAmount = (report.lines || []).reduce((sum, line) => sum + numeric(line.amount), 0);

const payeeMappingFor = (line) => {
  return mappings.find((m) => ( m.id == line.payeeMappingId ));
};

// 明細の支払先マッピングが解決する科目ラベル（「旅費交通費/補助」等）。
// マッピング未ロード/未登録のときは null（テンプレートで「マッピング未登録」表示）。
// テンプレートの依存追跡は式内の識別子だけを対象とするため、
// 関数内部の参照は更新をトリガしない点に注意。ここではreactive変数にして参照させる。
$: lineHints = (report.lines || []).map((line) => {
  const mapping = mappings.find((m) => ( m.id == line.payeeMappingId ));
  if ( !mapping || !mapping.account ) {
    return null;
  }
  const account = accounts.find((a) => ( a.code == mapping.account ));
  const name = account ? account.name : mapping.account;
  let sub = null;
  if ( mapping.subAccount && account && account.subAccounts ) {
    const found = account.subAccounts.find((s) => ( String(s.code) === String(mapping.subAccount) ));
    sub = found ? found.name : String(mapping.subAccount);
  }
  return sub ? `${name}/${sub}` : name;
});

const close_ = (event) => {
  const query = status.params ? `?${status.params.toString()}` : '';
  dispatch('close');
  link(`/expense${query}`);
}

const errMsg = (e) => {
  if ( e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  return e.message || 'エラーが発生しました。';
};

const buildBody = () => {
  return {
    id: report.id,
    submittedAt: report.submittedAt || null,
    companyId: report.companyId || null,
    taskId: report.taskId || null,
    purpose: report.purpose || null,
    lines: report.lines.map((line, i) => ({
      lineNo: i,
      paymentDate: line.paymentDate || null,
      payeeMappingId: line.payeeMappingId || null,
      description: line.description || null,
      amount: numeric(line.amount),
      paymentMappingId: line.paymentMappingId || null,
      note: line.note || null,
      voucherId: line.voucherId || null,
      taxRuleId: line.taxRuleId || null
    }))
  };
};

// ペンディングファイルがあれば保存時にVoucherを作成してファイルを添付する。
// Voucherには支払先(companyId)が必要なため、支払先マッピングに取引先の
// 紐付けがない行はエラーにする。
const savePendingFiles = async () => {
  for ( let i = 0; i < report.lines.length; i ++ ) {
    const line = report.lines[i];
    if (( line.pendingFiles ) && ( line.pendingFiles.length > 0 ) && ( !line.voucherId )) {
      const payee = payeeMappingFor(line);
      if (( !payee ) || ( !payee.companyId )) {
        ok = false;
        errorMessages.push(`${i + 1}行目 : 証憑の登録には、支払先に取引先が紐付いている必要があります。経理担当者に連絡してください。`);
        continue;
      }
      const res = await axios.post('/api/voucher', {
        issueDate: line.paymentDate || report.submittedAt || new Date().toISOString().slice(0, 10),
        companyId: payee.companyId,
        amount: numeric(line.amount)
      });
      const vid = res.data.voucher.id;
      for ( const pf of line.pendingFiles ) {
        const fd = new FormData();
        fd.append('file', pf.blob, pf.name);
        await axios.post(`/api/voucher/upload/${vid}`, fd,
          { 'content-type': 'multipart/form-data' });
      }
      line.voucherId = vid;
      line.voucher = { id: vid, files: [] };
      clearPending(line);
    }
  }
};

const save = async (event) => {
  errorMessages = [];
  ok = true;
  try {
    await savePendingFiles();
    if ( !ok ) {
      errorMessages = errorMessages;
      return;
    }
    const body = buildBody();
    let result;
    if ( report.id ) {
      result = await axios.put('/api/expense_report', body);
    } else {
      result = await axios.post('/api/expense_report', body);
    }
    // エラーは 200 のJSON({code,message})で返ることがあり、そのままreportへ
    // 代入するとフォームが空になるため、精算書の応答かどうかを確認する
    if ( result.data && result.data.id ) {
      report = result.data;
      toast.show('経費精算', '保存しました');
      if ( !body.id ) {
        // 新規保存後はentry画面へ切替（URLはreplaceState相当）
        link(`/expense/entry/${report.id}`, {replace: true});
      }
    } else {
      ok = false;
      errorMessages = [ result.data.message || '保存に失敗しました。' ];
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const delete_ = async (event) => {
  try {
    await axios.delete('/api/expense_report', {data: {id: report.id}});
    toast.show('経費精算', '削除しました');
    close_();
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const approve = async (event) => {
  try {
    const result = await axios.put('/api/expense_report/approve', {
      id: report.id,
      approvedAt: new Date()
    });
    if ( result.data.code === 0 ) {
      if ( result.data.slipApproved ) {
        toast.show('経費精算', '承認しました。伝票も確定しました。');
      } else if ( result.data.reuse ) {
        toast.show('経費精算', '承認しました。既存の伝票を更新しました。');
      } else {
        toast.show('経費精算', '承認しました。仕訳伝票を起票しました。');
      }
      const reloaded = await axios.get(`/api/expense_report/${report.id}`);
      report = reloaded.data;
    } else {
      ok = false;
      errorMessages = [result.data.message || '承認に失敗しました。'];
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const disapprove = async (event) => {
  try {
    const result = await axios.put('/api/expense_report/approve', {
      id: report.id,
      approvedAt: null
    });
    if ( result.data.code === 0 ) {
      if ( result.data.slipApproved ) {
        toast.show('経費精算', '不承認にしました。ただし紐付伝票は既に確定済みです。伝票の画面で処理してください。', 'warning');
      } else {
        toast.show('経費精算', '不承認にしました。紐付伝票も承認待ちに戻しました。');
      }
      const reloaded = await axios.get(`/api/expense_report/${report.id}`);
      report = reloaded.data;
    } else {
      ok = false;
      errorMessages = [result.data.message || '不承認に失敗しました。'];
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 紐付伝票の削除（未処理伝票の掃除用）
const deleteSlip = async (event) => {
  try {
    const result = await axios.delete('/api/expense_report/slip', {data: {id: report.id}});
    if ( result.data.code === 0 ) {
      toast.show('経費精算', '紐付伝票を削除しました。');
      const reloaded = await axios.get(`/api/expense_report/${report.id}`);
      report = reloaded.data;
    } else {
      ok = false;
      errorMessages = [result.data.message || '伝票の削除に失敗しました。'];
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const openSlip = (slip) => {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  link(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${returnTo}`);
};

// どこにも紐付いていない浮遊証憑を読み込む（expenseUnlinked=1: 精算書の
// 明細・パイルに紐付いた証憑と、伝票に紐付いた証憑を除外する）。
// セッションのtermが未選択でも取得できるよう ?term= を渡す
const fetchFloatings = () => {
  axios.get('/api/voucher', {
    params: { expenseUnlinked: 1, term: status.fy ? status.fy.term : undefined }
  }).then((result) => {
    floatings = (result.data.vouchers || []).filter((v) => !v.details.length);
  });
};

// 未整理の証憑（パイル+浮遊）。明細から参照されたものは候補から外して表示する
// （テンプレートの依存追跡のため usedInReport を介さず直に参照する）
$: pileVouchers = [ ...( report.vouchers || [] ), ...floatings ]
  .filter((v) => !(( report.lines || [] ).some((l) => ( l.voucherId == v.id ))));

// 進捗（どこまでやったか）: 明細に紐付け済みの証憑行と合計金額
$: linkedVouchers = ( report.lines || [] ).filter((l) => ( l.voucherId ));
$: linkedSum = linkedVouchers.reduce((s, l) => ( s + ( Number(l.amount) || 0 )), 0);

// 画像プレビュー（モーダル）。PDFは別タブ表示のまま
let preview = null;
const fileTitle = (voucher, file) => {
  return voucher.description || ( file ? file.name : '' ) || '証憑';
};
const openPreview = (voucher, file) => {
  preview = {
    src: `/voucher/file/${file.id}?v=${imageVersion}`,
    title: fileTitle(voucher, file)
  };
};
// 未保存のペンディングファイル用（object URLを直接表示）
const openPreviewRaw = (src, title) => {
  preview = { src: src, title: title || '証憑' };
};

// 未整理証憑のまるっとアップロード（複数ファイル可）。
// 精算書が未保存の場合はどこにも紐付かない浮遊証憑として登録する。
const uploadVouchers = async (files) => {
  if ( !files || files.length === 0 ) {
    return;
  }
  try {
    const fd = new FormData();
    for ( const f of files ) {
      fd.append('file', f, f.name);
    }
    const url = report.id ?
      `/api/expense_report/vouchers/${report.id}` : '/api/expense_report/vouchers';
    await axios.post(url, fd, { 'content-type': 'multipart/form-data' });
    if ( report.id ) {
      const reloaded = await axios.get(`/api/expense_report/${report.id}`);
      report = reloaded.data;
      toast.show('経費精算', `${files.length}件の証憑をアップロードしました。明細行へドラッグ&ドロップで紐付けてください。`);
    } else {
      toast.show('経費精算', `${files.length}件の証憑をアップロードしました。保存後に紐付けられます。`);
      fetchFloatings();
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 未整理証憑の説明をインライン保存する（bind:valueでローカルは更新済み）
const savePileDescription = async (voucher) => {
  const prev = voucher.description;
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      description: voucher.description || null
    });
  } catch (e) {
    voucher.description = prev;
    floatings = floatings;
    if ( report.vouchers ) { report.vouchers = report.vouchers; }
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 確認ダイアログ。window.confirm はブラウザのダイアログ抑制で
// 無効化されることがあるため、アプリ内のモーダル（okModal）を使う
const confirmModal = (title, description, reply) => {
  return new Promise((resolve) => {
    eventBus.once(reply, (ok) => {
      resolve(ok);
    });
    eventBus.emit('okModal', { title, description, reply });
  });
};

// 未整理証憑の分離: 1枚のスキャンに写った複数の証憑を個別の証憑に切り出す
// （AI不使用の幾何検出。元の証憑は残り、不採用の切り出しは後から削除できる）
const splitPileVoucher = async (voucher) => {
  const allowed = await confirmModal('経費精算',
    'この証憑を分離・切り出しますか？<br/>複数の証憑が写っている場合は個別の証憑に分け、1枚の場合は背景を除いて切り出します。',
    'expense-split-voucher');
  if ( !allowed ) {
    return;
  }
  try {
    const result = await axios.post('/api/expense_report/voucher_split', {
      voucherId: voucher.id
    });
    const count = ( result.data.vouchers || [] ).length;
    if ( result.data.trimmed ) {
      imageVersion += 1;
      toast.show('経費精算', '背景を除いて証憑だけに切り出しました。');
    } else if ( result.data.straightened ) {
      imageVersion += 1;
      toast.show('経費精算', '1枚の証憑のため分離はしませんでした。傾きを補正しました。');
    } else {
      toast.show('経費精算', `${count}枚に分離しました。不採用のものは削除してください。`);
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
  if ( report.id ) {
    const reloaded = await axios.get(`/api/expense_report/${report.id}`);
    report = reloaded.data;
  }
  fetchFloatings();
};

// 証憑画像の90°回転（天地逆などの手動補正）
const rotatePileVoucher = async (voucher, deg) => {
  try {
    await axios.post('/api/expense_report/voucher_rotate', {
      voucherId: voucher.id, deg: deg
    });
    imageVersion += 1;
    toast.show('経費精算', '回転しました');
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const deletePileVoucher = async (voucher) => {
  const allowed = await confirmModal('経費精算', 'この証憑を削除します。<br/>よろしいですか？', 'expense-delete-voucher');
  if ( !allowed ) {
    return;
  }
  try {
    await axios.delete(`/api/voucher/${voucher.id}`);
    if ( report.vouchers ) {
      report.vouchers = report.vouchers.filter((v) => ( v.id !== voucher.id ));
    }
    floatings = floatings.filter((v) => ( v.id !== voucher.id ));
    toast.show('経費精算', '証憑を削除しました');
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 未整理証憑パイルへのファイルドロップでアップロードする
// （ネストした要素へのenter/leaveを正しく数えるためカウンタ方式。明細行ドロップと同じ）
let pileDragCount = 0;

const onPileDragEnter = (event) => {
  if ( editable && event.dataTransfer.types.includes('Files') ) {
    pileDragCount += 1;
  }
};

const onPileDragLeave = (event) => {
  if ( event.dataTransfer.types.includes('Files') ) {
    pileDragCount = Math.max(0, pileDragCount - 1);
  }
};

const onPileDrop = (event) => {
  pileDragCount = 0;
  if ( !editable ) {
    toast.show('経費精算', '承認済みのため編集できません。不承認にしてから追加してください。', 'warning');
    return;
  }
  const files = event.dataTransfer.files;
  if ( files.length > 0 ) {
    event.preventDefault();
    uploadVouchers(files);
  }
};

// 証憑を明細に結合する。支払先・支払日・金額を証憑から補完する（伝票入力のbindVoucherと同じ）。
const bindVoucher = async (line, voucherId) => {
  const usedIndex = ( report.lines || [] ).findIndex((l) => ( l.voucherId == voucherId ));
  if ( usedIndex >= 0 ) {
    toast.show('経費精算', `この証憑は既に${usedIndex + 1}行目で使われています。`, 'warning');
    return;
  }
  try {
    const result = await axios.get(`/api/voucher/${voucherId}`);
    const voucher = result.data.voucher;
    line.voucherId = voucher.id;
    line.voucher = voucher;
    if ( voucher.companyId ) {
      // 証憑の取引先から支払先マッピングを逆引きする
      const payee = payeeMappings.find((m) => ( m.companyId == voucher.companyId ));
      if ( payee ) {
        line.payeeMappingId = payee.id;
      } else {
        toast.show('経費精算', '証憑の取引先に対応する支払先マッピングが未登録です。手動で支払先を選択するか、経理担当者に連絡してください。', 'warning');
      }
    }
    if ( voucher.paymentDate || voucher.issueDate ) {
      line.paymentDate = voucher.paymentDate || voucher.issueDate;
    }
    if (( voucher.amount != null ) && ( numeric(voucher.amount) !== 0 )) {
      line.amount = numeric(voucher.amount).toLocaleString();
    }
    if ( voucher.taxRuleId ) {
      line.taxRuleId = voucher.taxRuleId;
    }
    report.lines = report.lines;
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const unbindVoucher = (line) => {
  line.voucherId = null;
  line.voucher = undefined;
  report.lines = report.lines;
}

const onDragStart = (event) => {
  event.dataTransfer.dropEffect = 'link';
  event.dataTransfer.setData('id', event.currentTarget.dataset.id);
};
const onDragEnd = (event) => {
};

// 明細行へのドロップ: ファイルならペンディング（保存時にVoucher作成）、
// 証憑パネルからのドラッグならその場で結合する。
const onDrop = (event) => {
  const index = event.currentTarget.dataset.index;
  const line = report.lines[index];
  if ( !editable ) {
    toast.show('経費精算', '承認済みのため編集できません。不承認にしてから紐付けてください。', 'warning');
    return;
  }
  if (( event.dataTransfer.files ) && ( event.dataTransfer.files.length > 0 )) {
    addPendingFiles(line, event.dataTransfer.files);
  } else {
    const voucherId = event.dataTransfer.getData('id');
    if ( voucherId ) {
      bindVoucher(line, voucherId);
    } else {
      // ファイルでも証憑DnDでもないドロップ（フォルダ等）は受け付けられない
      console.log('expense-entry onDrop: no files nor voucher id', event.dataTransfer.types);
      toast.show('経費精算', 'ドロップを受け付けられませんでした。画像・PDFファイルか、未整理の証憑をドロップしてください。', 'warning');
    }
  }
  dragCounter[index] = 0;
  event.currentTarget.classList.remove('over');
  event.stopPropagation();
};

const onDragEnter = (event) => {
  const index = event.currentTarget.dataset.index;
  dragCounter[index] ||= 0;
  dragCounter[index] += 1;
  if ( dragCounter[index] === 1 ) {
    event.currentTarget.classList.add('over');
  }
  event.stopPropagation();
};

const onDragLeave = (event) => {
  const index = event.currentTarget.dataset.index;
  dragCounter[index] ||= 0;
  dragCounter[index] -= 1;
  if ( dragCounter[index] === 0 ) {
    event.currentTarget.classList.remove('over');
  }
  event.stopPropagation();
};

const addPendingFiles = (line, files) => {
  if ( line.voucherId ) {
    // 1行1証憑のため、紐付け済みの行への追加は拒否する
    // （黙って受け取ると保存時に捨てられて「消えた」に見える）
    toast.show('経費精算', 'この行には既に証憑が紐付いています。別の行にドロップするか、紐付けを解除してください。', 'warning');
    return;
  }
  if ( !line.pendingFiles ) {
    line.pendingFiles = [];
  }
  for ( let i = 0; i < files.length; i ++ ) {
    const blobUrl = URL.createObjectURL(files[i]);
    line.pendingFiles.push({
      name: files[i].name,
      blob: files[i],
      url: ( files[i].type && files[i].type.match(/^image\//) ) ? blobUrl : null,
      blobUrl: blobUrl
    });
  }
  report.lines = report.lines;
};

const removePendingFile = (line, index) => {
  const removed = line.pendingFiles.splice(index, 1);
  for ( const pf of removed ) {
    if ( pf.url ) {
      URL.revokeObjectURL(pf.url);
    }
    if ( pf.blobUrl && pf.blobUrl !== pf.url ) {
      URL.revokeObjectURL(pf.blobUrl);
    }
  }
  report.lines = report.lines;
};

// 保存完了後にペンディングのサムネイルURLを解放する
const clearPending = (line) => {
  if ( !line.pendingFiles ) return;
  for ( const pf of line.pendingFiles ) {
    if ( pf.url ) {
      URL.revokeObjectURL(pf.url);
    }
    if ( pf.blobUrl && pf.blobUrl !== pf.url ) {
      URL.revokeObjectURL(pf.blobUrl);
    }
  }
  delete line.pendingFiles;
};

// 証憑をAIで読み取り、明細に入力する。
// 結合済み証憑はvoucherIdで、ペンディングファイルはファイルを直接OCRにかける。
// 抽出結果は必ずユーザーが確認できる（承認フローで経理が確認する）。
// LLM応答は十数秒かかるため行単位のbusy表示にし、axiosにtimeoutを付ける
// （応答なしの固着でボタンが押せなくなるのを防ぐ）。
const aiRead = async (line) => {
  if ( line._aiBusy ) return;
  line._aiBusy = true;
  line._aiSecs = 0;
  report.lines = [...report.lines];
  // 経過秒数を表示する（進んでいるか固まっているかの切り分け用）
  const startedAt = Date.now();
  const timer = setInterval(() => {
    line._aiSecs = Math.floor(( Date.now() - startedAt ) / 1000);
    report.lines = [...report.lines];
  }, 1000);
  // 番犬: 応答が全く返らない場合の強制復旧（通常はaxiosの180秒が先に発火する）。
  // responded=true（応答受信済み）の場合は誤爆しない。
  let responded = false;
  const watchdog = setTimeout(() => {
    if (( line._aiBusy ) && ( !responded )) {
      console.error('aiRead watchdog: no response, force reset');
      clearInterval(timer);
      line._aiBusy = false;
      line._aiSecs = 0;
      report.lines = [...report.lines];
      ok = false;
      errorMessages = ['AI読み取りがタイムアウトしました（200秒）。再実行するか、時間をおいて試してください。'];
    }
  }, 200000);
  try {
    let result;
    if ( line.voucherId ) {
      result = await axios.post('/api/expense_report/ocr', {voucherId: line.voucherId},
        { timeout: 180000 });
    } else {
      const fd = new FormData();
      fd.append('file', line.pendingFiles[0].blob, line.pendingFiles[0].name);
      result = await axios.post('/api/expense_report/ocr', fd,
        { 'content-type': 'multipart/form-data', timeout: 180000 });
    }
    responded = true;
    const values = result.data.values;
    if ( values.issueDate || values.paymentDate ) {
      line.paymentDate = values.paymentDate || values.issueDate;
    }
    if ( values.amount ) {
      line.amount = values.amount;
    }
    if ( values.description ) {
      line.description = values.description;
    }
    // 支払先の解決順: サーバ解決のcompanyId→取引先の完全一致→部分一致→
    // マッピングの検索キー（OCR別名）。サーバはLLM判定まで行う。
    let payee = null;
    let matched = null;
    if ( values.companyId ) {
      payee = payeeMappings.find((m) => ( m.companyId == values.companyId )) || null;
    }
    if ( !payee && values.company ) {
      const norm = (s) => ( ( s || '' ).trim() );
      payee = payeeMappings.find((m) => ( norm(m.key) === norm(values.company) )) ||
        payeeMappings.find((m) => ( norm(m.key) &&
          ( norm(m.key).includes(norm(values.company)) ||
            norm(values.company).includes(norm(m.key)) ) )) || null;
      if ( !payee ) {
        matched = companies.find((c) => ( c.name === values.company )) ||
          companies.find((c) => ( c.name && ( c.name.includes(values.company) ||
            values.company.includes(c.name) ) )) || null;
        if ( matched ) {
          // 取引先から支払先マッピングを逆引きする
          payee = payeeMappings.find((m) => ( m.companyId == matched.id )) || null;
        }
      }
    }
    if ( values.company ) {
      if ( payee ) {
        line.payeeMappingId = payee.id;
      } else if ( matched ) {
        toast.show('経費精算', `取引先「${values.company}」の支払先マッピングが未登録です。経理担当者に連絡してください。`, 'warning');
      } else {
        toast.show('経費精算', `支払先「${values.company}」が取引先に見つかりません。手動で選択してください。`, 'warning');
      }
    }
    report.lines = [...report.lines];
    toast.show('AI読み取り', '証憑を読み取りました。内容を確認してください。');
  } catch (e) {
    console.error(e);
    ok = false;
    errorMessages = [errMsg(e)];
  } finally {
    clearTimeout(watchdog);
    clearInterval(timer);
    line._aiBusy = false;
    line._aiSecs = 0;
    report.lines = [...report.lines];
    console.log('aiRead done');
  }
};

onMount(async () => {
  axios.get('/api/company').then((result) => {
    companies = result.data.companies || [];
  });
  axios.get('/api/expense_report/tasks').then((result) => {
    tasks = result.data.values || [];
  });
  axios.get('/api/expense_mapping').then((result) => {
    mappings = result.data.values || [];
  });
  axios.get('/api/accounts').then((result) => {
    accounts = result.data || [];
  });
  axios.get('/api/expense_report/ai_available').then((result) => {
    aiAvailable = result.data.available;
  });
  fetchFloatings();
})
</script>
