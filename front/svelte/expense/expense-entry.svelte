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
                      <a href="/voucher/file/{file.id}" target="_blank">
                        {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                        <img src="/voucher/file/{file.id}" class="thumb"/>
                        {:else}
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
                        {/if}
                      </a>
                    </div>
                    {/each}
                    {:else}
                    <i class="bi bi-file-earmark-text"></i>
                    {/if}
                    {#if ( editable )}
                    <button type="button" class="btn btn-warning btn-sm p-0 px-1 me-1"
                      on:click={() => { unbindVoucher(line); }} title="証憑の紐付けを解除">
                      <i class="bi bi-link-slash"></i>
                    </button>
                    {/if}
                  </div>
                  {:else if ( line.pendingFiles && line.pendingFiles.length > 0 )}
                  <div class="pending-file">
                    {#each line.pendingFiles as pf, j}
                    <div class="d-flex align-items-start">
                      <div class="me-1">
                        {#if ( pf.url )}
                        <img src={pf.url} class="thumb"/>
                        {:else}
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
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
                    disabled={aiBusy}
                    on:click={() => aiRead(line)}>AI読み取り</button>
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
        <div class="container-fluid expense-vouchers">
          <div class="d-flex align-items-center mb-1">
            <h2 class="fs-5 me-3 mb-0">未整理の証憑</h2>
            <label class="btn btn-sm btn-outline-primary upload-label">
              まとめてアップロード
              <input type="file" hidden multiple accept="image/*,application/pdf"
                disabled={!editable}
                on:change={(e) => { uploadVouchers(e.target.files); e.target.value = ''; }}>
            </label>
          </div>
          {#if ( pileVouchers.length > 0 )}
          <div class="voucher-pane" style="overflow:auto;max-height:30vh;">
            <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-light">
                <tr>
                  <th>ファイル</th>
                  <th>説明</th>
                  <th class="number">金額</th>
                  <th style="width:30px;"></th>
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
                        <a href="/voucher/file/{file.id}" target="_blank">
                          {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                          <img src="/voucher/file/{file.id}" class="thumb"/>
                          {:else}
                          <img src="/public/icons/icon_pdf.png" class="thumb"/>
                          {/if}
                        </a>
                      </div>
                      {/each}
                    </div>
                  </td>
                  <td>{line.description || ( line.files[0] ? line.files[0].name : '' )}</td>
                  <td class="number">{line.amount != null ? numeric(line.amount).toLocaleString() : ''}</td>
                  <td>
                    {#if ( editable )}
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
            </div>
          </div>
          {:else}
          <p class="text-muted mb-0">領収書などの画像をまとめてアップロードできます。アップロードした証憑は、明細行へドラッグ&ドロップして紐付けてください。</p>
          {/if}
        </div>
        {/if}
        {#if ( vouchers )}
        <div class="container-fluid expense-vouchers">
          <h2 class="fs-5">証憑候補（未使用の証憑のみ）</h2>
          <div class="voucher-pane" style="overflow:auto;max-height:40vh;">
            <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-light">
                <tr>
                  <th>支払先</th>
                  <th>支払日</th>
                  <th class="number">金額</th>
                  <th>説明</th>
                </tr>
              </thead>
              <tbody>
                {#each vouchers as line}
                <tr
                  on:dragstart={onDragStart}
                  on:dragend={onDragEnd}
                  draggable="true"
                  data-id={line.id}>
                  <td>
                    {line.company ? line.company.name : ''}
                  </td>
                  <td>
                    {formatDate(line.paymentDate || line.issueDate)}
                  </td>
                  <td class="number">
                    {numeric(line.amount).toLocaleString()}
                  </td>
                  <td>
                    {line.description || ''}
                  </td>
                </tr>
                {/each}
              </tbody>
            </table>
            </div>
          </div>
        </div>
        {/if}
      </div>
  <div class="d-flex justify-content-end mt-3 mb-5">
    <div>
      {#if ( editable )}
      <button type="button" class="btn btn-secondary me-2"
        on:click={openVouchers} id="voucher-panel-button">証憑候補</button>
      {/if}
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

<style>
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
</style>

<script>
import axios from 'axios';
import {numeric, formatDate} from '../../../libs/utils';
import {onMount, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import CompanySelect from '../components/company-select.svelte';
import {link} from '../../javascripts/router.js';

export let report;
export let status;
export let toast;

let companies = [];
let tasks = [];
let mappings = [];
let accounts = [];
let aiAvailable = false;
let aiBusy = false;
let ok = true;
let errorMessages = [];
let submitterName = '';
let vouchers;
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
      if ( result.data.reuse ) {
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

// 証憑候補パネル（slip-pageと同じ操作: 証憑行を明細へドラッグ&ドロップする）。
// 月で絞らず会計年度内の未使用証憑をすべて出す（未整理のまるっとアップロードは
// どの月の精算にも使い得るため）。
const openVouchers = (event) => {
  if ( vouchers ) {
    vouchers = undefined;
    return;
  }
  fetchVouchers();
};

const fetchVouchers = () => {
  // どこにも紐付いていない証憑だけを候補にする
  // （expenseUnlinked=1: 精算書の明細・パイルに紐付いた証憑をサーバ側で除外。
  //   伝票に紐付いた証憑は details で判別できるのでクライアント側で除外）
  axios.get('/api/voucher', {
    params: { expenseUnlinked: 1 }
  }).then((result) => {
    vouchers = result.data.vouchers.filter((v) => !usedInReport(v.id) && !v.details.length);
  })
};

// この精算書の他の行で既に使われている証憑は候補から外す
const usedInReport = (voucherId) => {
  return (report.lines || []).some((l) => ( l.voucherId == voucherId ));
};

// 未整理の証憑（パイル）。明細から参照されたものは候補から外して表示する
// （テンプレートの依存追跡のため usedInReport を介さず直に参照する）
$: pileVouchers = (report.vouchers || [])
  .filter((v) => !(( report.lines || [] ).some((l) => ( l.voucherId == v.id ))));

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
      if ( vouchers ) {
        fetchVouchers();
      }
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 未整理証憑の削除（自分が登録した証憑は削除できる）
const deletePileVoucher = async (voucher) => {
  if ( !window.confirm('この証憑を削除します。よろしいですか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/voucher/${voucher.id}`);
    report.vouchers = ( report.vouchers || [] ).filter((v) => ( v.id !== voucher.id ));
    toast.show('経費精算', '証憑を削除しました');
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 証憑を明細に結合する。支払先・支払日・金額を証憑から補完する（伝票入力のbindVoucherと同じ）。
const bindVoucher = async (line, voucherId) => {
  if ( usedInReport(voucherId) ) {
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
    return;
  }
  if (( event.dataTransfer.files ) && ( event.dataTransfer.files.length > 0 )) {
    addPendingFiles(line, event.dataTransfer.files);
  } else {
    const voucherId = event.dataTransfer.getData('id');
    if ( voucherId ) {
      bindVoucher(line, voucherId);
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
  if ( !line.pendingFiles ) {
    line.pendingFiles = [];
  }
  for ( let i = 0; i < files.length; i ++ ) {
    line.pendingFiles.push({
      name: files[i].name,
      blob: files[i],
      url: ( files[i].type && files[i].type.match(/^image\//) ) ? URL.createObjectURL(files[i]) : null
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
  }
  delete line.pendingFiles;
};

// 証憑をAIで読み取り、明細に入力する。
// 結合済み証憑はvoucherIdで、ペンディングファイルはファイルを直接OCRにかける。
// 抽出結果は必ずユーザーが確認できる（承認フローで経理が確認する）。
const aiRead = async (line) => {
  if ( aiBusy ) return;
  aiBusy = true;
  try {
    let result;
    if ( line.voucherId ) {
      result = await axios.post('/api/expense_report/ocr', {voucherId: line.voucherId});
    } else {
      const fd = new FormData();
      fd.append('file', line.pendingFiles[0].blob, line.pendingFiles[0].name);
      result = await axios.post('/api/expense_report/ocr', fd,
        { 'content-type': 'multipart/form-data' });
    }
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
    if ( values.company ) {
      const matched = companies.find((c) => ( c.name === values.company )) ||
        companies.find((c) => ( c.name && ( c.name.includes(values.company) ||
          values.company.includes(c.name) ) ));
      if ( matched ) {
        // 取引先から支払先マッピングを逆引きする
        const payee = payeeMappings.find((m) => ( m.companyId == matched.id ));
        if ( payee ) {
          line.payeeMappingId = payee.id;
        } else {
          toast.show('経費精算', `取引先「${values.company}」の支払先マッピングが未登録です。経理担当者に連絡してください。`, 'warning');
        }
      } else {
        toast.show('経費精算', `支払先「${values.company}」が取引先に見つかりません。手動で選択してください。`, 'warning');
      }
    }
    report.lines = report.lines;
    toast.show('AI読み取り', '証憑を読み取りました。内容を確認してください。');
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  } finally {
    aiBusy = false;
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
})
</script>
