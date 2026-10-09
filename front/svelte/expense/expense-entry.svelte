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
              <select class="form-select" id="task" bind:value={report.taskId} disabled={!editable}>
                <option value={null}>-- 未設定 --</option>
                {#each tasks as task}
                <option value={task.id}>{task.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="row mt-3">
            <label for="purpose" class="col-2 col-form-label">目的</label>
            <div class="col-10">
              <textarea class="form-control" id="purpose" rows="2"
                bind:value={report.purpose} disabled={!editable}></textarea>
            </div>
          </div>
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
                    <CompanySelect
                      bind:companyId={line.companyId}></CompanySelect>
                  </div>
                  {#if ( line.companyId )}
                    {#if ( payeeMappingFor(line) )}
                    <div class="text-muted" style="font-size:0.75rem;">
                      → {payeeLabelFor(line)}
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
                  <select class="form-select form-select-sm"
                    bind:value={line.paymentMappingId} disabled={!editable}>
                    <option value={null}></option>
                    {#each paymentMappings as mapping}
                    <option value={mapping.id}>{mapping.name}</option>
                    {/each}
                  </select>
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
        {#if ( vouchers )}
        <div class="container-fluid expense-vouchers">
          <h2 class="fs-5">証憑候補（{panelYear}年{panelMonth}月）</h2>
          <ul class="page-subtitle nav me-auto">
            {#each months as month}
            <li class="nav-item">
              {#if (( panelYear == month.year ) && ( panelMonth == month.month ))}
              <button type="button" class="btn btn-primary disabled me-2"
                on:click={() => { changePanelMonth(month); }}>
                {month.month}&nbsp;月
              </button>
              {:else}
              <button type="button" class="btn btn-outline-primary me-2"
                on:click={() => { changePanelMonth(month); }}>
                {month.month}&nbsp;月
              </button>
              {/if}
            </li>
            {/each}
          </ul>
          <div class="voucher-pane" style="overflow:auto;max-height:40vh;">
            <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-light">
                <tr>
                  <th style="width:20px;"></th>
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
                  draggable={ ( line.details.length > 0 ) || usedInReport(line.id) ? "false" : "true" }
                  data-id={line.id}>
                  <td>
                    {#if ( line.details.length > 0 )}
                    <i class="fas fa-link"></i>
                    {/if}
                  </td>
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
      {#if ( status.user.approvable && !report.approvedAt )}
        <button type="button" class="btn btn-success me-2"
          on:click={approve} id="approve-button">承認</button>
        <button type="button" class="btn btn-warning me-2"
          on:click={disapprove} id="disapprove-button">不承認</button>
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
let months = [];
let panelYear;
let panelMonth;
let dragCounter = [];

$: submitterName = report.submitter ? report.submitter.name : (status.user.name || '');

// GET/保存応答の submittedAt はISO日時文字列で返るため、date入力に
// 再バインドできるよう YYYY-MM-DD に正規化する
$: if ( report && report.submittedAt && ( String(report.submittedAt).length > 10 ) ) {
  report.submittedAt = String(report.submittedAt).slice(0, 10);
}

// 空テーブルでも行の「+」が操作できるように、明細バッファには常に空行を1行積んでおく
$: if ( report && ( !report.lines || report.lines.length === 0 ) ) {
  report.lines = [{}];
}

$: paymentMappings = mappings.filter((m) => ( m.kind === 'payment' ));

$: editable = !report.approvedAt &&
  (( status.user.accounting ) || ( status.user.approvable ) ||
   ( report.createdBy === status.user.id ) || ( !report.id ));

$: totalAmount = (report.lines || []).reduce((sum, line) => sum + numeric(line.amount), 0);

const payeeMappingFor = (line) => {
  return mappings.find((m) => ( m.kind === 'payee' ) &&
    ( line.companyId && ( m.companyId == line.companyId ) ));
};

const accountNameFor = (code) => {
  const account = accounts.find((a) => ( a.code == code ));
  return account ? account.name : code;
};

const subNameFor = (code, sub) => {
  const account = accounts.find((a) => ( a.code == code ));
  if ( !account || !account.subAccounts ) return null;
  const found = account.subAccounts.find((s) => ( String(s.code) === String(sub) ));
  return found ? found.name : sub;
};

const payeeLabelFor = (line) => {
  const mapping = payeeMappingFor(line);
  if ( !mapping ) return '';
  const name = accountNameFor(mapping.account);
  const sub = mapping.subAccount ? subNameFor(mapping.account, mapping.subAccount) : null;
  return sub ? `${name}/${sub}` : name;
};

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
    submittedAt: report.submittedAt || null,
    companyId: report.companyId || null,
    taskId: report.taskId || null,
    purpose: report.purpose || null,
    lines: report.lines.map((line, i) => ({
      lineNo: i,
      paymentDate: line.paymentDate || null,
      companyId: line.companyId || null,
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
// Voucherには支払先(companyId)が必要なため、支払先の未選択行はエラーにする。
const savePendingFiles = async () => {
  for ( let i = 0; i < report.lines.length; i ++ ) {
    const line = report.lines[i];
    if (( line.pendingFiles ) && ( line.pendingFiles.length > 0 ) && ( !line.voucherId )) {
      if ( !line.companyId ) {
        ok = false;
        errorMessages.push(`${i + 1}行目 : 証憑の登録には支払先の選択が必要です。`);
        continue;
      }
      const res = await axios.post('/api/voucher', {
        issueDate: line.paymentDate || report.submittedAt || new Date().toISOString().slice(0, 10),
        companyId: line.companyId,
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
    if ( report.id ) {
      const result = await axios.put('/api/expense_report', body);
      report = result.data;
      toast.show('経費精算', '保存しました');
    } else {
      const result = await axios.post('/api/expense_report', body);
      report = result.data;
      toast.show('経費精算', '保存しました');
      // 新規保存後はentry画面へ切替（URLはreplaceState相当）
      link(`/expense/entry/${report.id}`, {replace: true});
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
      toast.show('経費精算', '承認しました。仕訳伝票を起票しました。');
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
      toast.show('経費精算', '不承認にしました。');
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

const openSlip = (slip) => {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  link(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${returnTo}`);
};

// 証憑候補パネル（slip-pageと同じ操作: 証憑行を明細へドラッグ&ドロップする）
const openVouchers = (event) => {
  if ( vouchers ) {
    vouchers = undefined;
    return;
  }
  const base = report.lines.find((l) => l.paymentDate);
  const baseDate = base ? new Date(base.paymentDate) :
    ( report.submittedAt ? new Date(report.submittedAt) : new Date() );
  panelYear = baseDate.getFullYear();
  panelMonth = baseDate.getMonth() + 1;
  fetchVouchers();
};

const changePanelMonth = (month) => {
  panelYear = month.year;
  panelMonth = month.month;
  fetchVouchers();
};

const fetchVouchers = () => {
  axios.get('/api/voucher', {
    params: { month: `${panelYear}-${panelMonth}` }
  }).then((result) => {
    vouchers = result.data.vouchers.filter((v) => !usedInReport(v.id));
  })
};

// この精算書の他の行で既に使われている証憑は候補から外す
const usedInReport = (voucherId) => {
  return (report.lines || []).some((l) => ( l.voucherId == voucherId ));
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
      line.companyId = voucher.companyId;
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
        line.companyId = matched.id;
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
  axios.get(`/api/term/${status.fy.term}`).then((result) => {
    const fy = result.data;
    const list = [];
    for ( let mon = new Date(fy.startDate); mon < new Date(fy.endDate); ) {
      list.push({
        year: mon.getFullYear(),
        month: mon.getMonth()+1
      });
      mon.setMonth(mon.getMonth() + 1);
    }
    months = list;
  });
})
</script>
