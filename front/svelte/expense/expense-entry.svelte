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
                value={report.submitter ? report.submitter.name : submitterName} disabled>
            </div>
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
          <table class="table table-bordered">
            <thead class="table-light">
              <tr>
                <th scope="col" style="width: 140px;">支払日</th>
                <th scope="col" style="width: 220px;">支払先</th>
                <th scope="col">内容</th>
                <th scope="col" style="width: 120px;">支払金額</th>
                <th scope="col" style="width: 160px;">出金元</th>
                <th scope="col">備考</th>
                <th scope="col" style="width: 220px;">証憑</th>
                <th scope="col" style="width: 74px;"></th>
              </tr>
            </thead>
            <tbody>
              {#each report.lines as line, i}
              <tr>
                <td>
                  <input type="date" class="form-control form-control-sm"
                    bind:value={line.paymentDate} disabled={!editable}>
                </td>
                <td>
                  <select class="form-select form-select-sm"
                    bind:value={line.companyId}
                    disabled={!editable}>
                    <option value={null}></option>
                    {#each companies as company}
                    <option value={company.id}>{company.name}</option>
                    {/each}
                  </select>
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
                <td>
                  <input type="text" class="form-control form-control-sm"
                    bind:value={line.description} disabled={!editable}>
                </td>
                <td>
                  <input type="text" class="form-control form-control-sm number"
                    bind:value={line.amount} disabled={!editable}>
                </td>
                <td>
                  <select class="form-select form-select-sm"
                    bind:value={line.paymentMappingId} disabled={!editable}>
                    <option value={null}></option>
                    {#each paymentMappings as mapping}
                    <option value={mapping.id}>{mapping.name}</option>
                    {/each}
                  </select>
                </td>
                <td>
                  <input type="text" class="form-control form-control-sm"
                    bind:value={line.note} disabled={!editable}>
                </td>
                <td>
                  {#if ( line.voucher && line.voucher.files && line.voucher.files.length > 0 )}
                  <div class="d-flex align-items-start">
                    {#each line.voucher.files as file}
                    <div class="me-1">
                      <a href="/voucher/file/{file.id}" target="_blank">
                        {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                        <img src="/voucher/file/{file.id}" class="thumb"/>
                        {:else}
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
                        {/if}
                      </a>
                      {#if ( editable )}
                      <button type="button" class="btn btn-sm btn-outline-danger p-0 px-1"
                        on:click={() => deleteFile(line, file)} title="ファイル削除">
                        <i class="bi bi-x"></i>
                      </button>
                      {/if}
                    </div>
                    {/each}
                  </div>
                  {:else}
                  <label class="btn btn-sm btn-outline-primary">
                    アップロード
                    <input type="file" hidden accept="image/*,application/pdf"
                      disabled={!editable}
                      on:change={(e) => uploadFile(line, e)}>
                  </label>
                  {/if}
                  {#if ( line.voucherId && aiAvailable && editable )}
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
            </tbody>
          </table>
        </div>
        <div class="container-fluid mt-3">
          <div class="row mt-2">
            <label for="settlementDate" class="col-2 col-form-label">精算日</label>
            <div class="col-sm-3">
              <input type="date" class="form-control" id="settlementDate"
                bind:value={report.settlementDate} disabled={!editable}>
            </div>
            <label class="col-2 col-form-label">出金元</label>
            <div class="col-sm-3">
              <select class="form-select" bind:value={report.settlementMappingId} disabled={!editable}>
                <option value={null}>-- 未設定 --</option>
                {#each paymentMappings as mapping}
                <option value={mapping.id}>{mapping.name}</option>
                {/each}
              </select>
            </div>
          </div>
          {#if ( report.crossSlip )}
          <div class="row mt-2">
            <label class="col-2 col-form-label">会計処理</label>
            <div class="col-sm-3">
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openSlip(report.crossSlip);
                }}>
                伝票 {report.crossSlip.year}/{report.crossSlip.month}-{report.crossSlip.no}
              </button>
            </div>
          </div>
          {/if}
        </div>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary"
          on:click={close_}>もどる</button>
        {#if ( editable && report.id )}
          <button type="button" class="btn btn-danger"
            on:click={delete_}
            id="delete-button">削除</button>
        {/if}
        {#if ( status.user.approvable && !report.approvedAt )}
          <button type="button" class="btn btn-success"
            on:click={approve} id="approve-button">承認</button>
          <button type="button" class="btn btn-warning"
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

<style>
.thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
</style>

<script>
import axios from 'axios';
import {numeric} from '../../../libs/utils';
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

$: paymentMappings = mappings.filter((m) => ( m.kind === 'payment' ));

$: editable = !report.approvedAt &&
  (( status.user.accounting ) || ( status.user.approvable ) ||
   ( report.createdBy === status.user.id ) || ( !report.id ));

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

const validateForm = () => {
  ok = true;
  errorMessages = [];
  return ok;
}

const buildBody = () => {
  return {
    submittedAt: report.submittedAt || null,
    companyId: report.companyId || null,
    taskId: report.taskId || null,
    purpose: report.purpose || null,
    settlementDate: report.settlementDate || null,
    settlementMappingId: report.settlementMappingId || null,
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

const save = async (event) => {
  if ( !validateForm() ) {
    return;
  }
  try {
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

// 証憑ファイルのアップロード。
// Voucherは支払先(companyId)が必須のため、未選択の場合は先に支払先を選んでもらう。
const uploadFile = async (line, event) => {
  const file = event.target.files[0];
  if ( !file ) return;
  if ( !line.companyId ) {
    ok = false;
    errorMessages = ['先に支払先を選択してください。'];
    return;
  }
  try {
    let vid = line.voucherId;
    if ( !vid ) {
      const res = await axios.post('/api/voucher', {
        issueDate: line.paymentDate || report.submittedAt || new Date().toISOString().slice(0, 10),
        companyId: line.companyId,
        amount: numeric(line.amount)
      });
      vid = res.data.voucher.id;
      line.voucherId = vid;
    }
    const body = new FormData();
    body.append('file', file);
    const up = await axios.post(`/api/voucher/upload/${vid}`, body,
      { 'content-type': 'multipart/form-data' });
    if ( up.data.code == 0 ) {
      line.voucher = { id: vid, files: [up.data.file] };
      report.lines = report.lines;
      toast.show('経費精算', '証憑をアップロードしました');
    } else {
      ok = false;
      errorMessages = ['証憑のアップロードに失敗しました。'];
    }
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const deleteFile = async (line, file) => {
  try {
    await axios.delete('/api/voucher/file', {data: {id: file.id}});
    const res = await axios.get(`/api/voucher/files/${line.voucherId}`);
    line.voucher = { id: line.voucherId, files: res.data };
    report.lines = report.lines;
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

// 証憑をAIで読み取り、明細に入力する。
// 抽出結果は必ずユーザーが確認できる（承認フローで経理が確認する）。
const aiRead = async (line) => {
  if ( aiBusy ) return;
  aiBusy = true;
  try {
    const result = await axios.post('/api/expense_report/ocr', {voucherId: line.voucherId});
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

const errMsg = (e) => {
  if ( e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  return e.message || 'エラーが発生しました。';
};

onMount(async () => {
  axios.get('/api/company').then((result) => {
    companies = result.data.companies;
  });
  axios.get('/api/expense_report/tasks').then((result) => {
    tasks = result.data.values;
  });
  axios.get('/api/expense_mapping').then((result) => {
    mappings = result.data.values;
  });
  axios.get('/api/accounts').then((result) => {
    accounts = result.data;
  });
  axios.get('/api/expense_report/ai_available').then((result) => {
    aiAvailable = result.data.available;
  });
  if ( !report.id ) {
    submitterName = status.user.name || '';
  }
})
</script>
