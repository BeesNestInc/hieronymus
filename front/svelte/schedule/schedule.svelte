<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1 class="fs-3">予定表</h1>
    <div class="d-flex align-items-center">
      <button type="button" class="btn btn-sm btn-outline-secondary me-2"
        on:click={() => { moveMonth(-1); }}>&lt;</button>
      <span class="fs-5 fw-bold">{year}年{month}月</span>
      <button type="button" class="btn btn-sm btn-outline-secondary ms-2"
        on:click={() => { moveMonth(1); }}>&gt;</button>
      <button type="button" class="btn btn-primary ms-4"
        on:click={() => { openEditor(); }}>新規&nbsp;<i class="bi bi-plus-lg"></i></button>
    </div>
  </div>

  <div class="d-flex fs-5 mt-2 mb-2">
    <span class="me-4">入金計 <span class="text-success fw-bold">{formatMoney(totalIn)}</span>円</span>
    <span class="me-4">出金計 <span class="text-danger fw-bold">{formatMoney(totalOut)}</span>円</span>
    <span>差引 <span class="fw-bold" class:text-success={balance >= 0} class:text-danger={balance < 0}>{formatMoney(balance)}</span>円</span>
  </div>

  <div class="fontsize-12pt">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 120px;">日付</th>
          <th scope="col" style="width: 100px;">種別</th>
          <th scope="col" style="width: 300px;">タイトル</th>
          <th scope="col" style="width: 150px;">金額</th>
          <th scope="col">備考</th>
        </tr>
      </thead>
      <tbody>
        {#if ( items.length === 0 )}
        <tr><td colspan="5" class="text-muted">この月の予定はありません</td></tr>
        {/if}
        {#each items as item (item.scheduleId + item.date)}
        <tr>
          <td>{item.day}日</td>
          <td>
            {#if ( item.kind === 'in' )}
            <span class="badge bg-success">入金</span>
            {:else}
            <span class="badge bg-danger">出金</span>
            {/if}
          </td>
          <td>{item.title}</td>
          <td class="text-end">{formatMoney(item.amount)}円</td>
          <td class="small">{item.note || ''}</td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 class="fs-4 mt-4">予定の定義</h2>
  <div class="fontsize-12pt">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 300px;">タイトル</th>
          <th scope="col" style="width: 100px;">種別</th>
          <th scope="col" style="width: 200px;">繰り返し</th>
          <th scope="col" style="width: 150px;">金額</th>
          <th scope="col">備考</th>
          <th scope="col" style="width: 160px;">操作</th>
        </tr>
      </thead>
      <tbody>
        {#if ( schedules.length === 0 )}
        <tr><td colspan="6" class="text-muted">予定が登録されていません</td></tr>
        {/if}
        {#each schedules as schedule (schedule.id)}
        <tr class:opacity-50={!schedule.enabled}>
          <td>{schedule.title}{#if ( !schedule.enabled )}<span class="badge bg-secondary ms-1">停止中</span>{/if}</td>
          <td>
            {#if ( schedule.kind === 'in' )}
            <span class="badge bg-success">入金</span>
            {:else}
            <span class="badge bg-danger">出金</span>
            {/if}
          </td>
          <td>{recurrenceLabel(schedule)}</td>
          <td class="text-end">{formatMoney(schedule.amount)}円</td>
          <td class="small">{schedule.note || ''}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-secondary"
              on:click={() => { openEditor(schedule); }}>編集</button>
            <button type="button" class="btn btn-sm btn-outline-danger"
              on:click={() => { remove(schedule); }}>削除</button>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 class="fs-4 mt-4">カレンダー購読（ICSフィード）</h2>
  <p class="small">
    下のURLをGoogleカレンダーやグループウェアの「URLで追加」に登録すると、
    予定がカレンダーに表示されます。トークン付きのURLですので、取り扱いに注意してください。
  </p>
  <div class="d-flex" style="max-width: 800px;">
    <input type="text" class="form-control form-control-sm" readonly
      value={typeof window !== 'undefined' ? window.location.origin + feedUrl : feedUrl}>
    <button type="button" class="btn btn-sm btn-outline-secondary ms-1" style="white-space: nowrap;"
      on:click={() => { copyFeedUrl(); }}>コピー</button>
    <button type="button" class="btn btn-sm btn-outline-warning ms-1" style="white-space: nowrap;"
      title="現在のトークンを無効にして新しいものを発行します"
      on:click={() => { regenerateToken(); }}>再生成</button>
  </div>
</div>

{#if ( modalOpen )}
<div class="modal d-block schedule-modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">{editing.id ? '予定の編集' : '予定の新規登録'}</h5>
        <button type="button" class="btn-close" on:click={() => { closeModal(); }}></button>
      </div>
      <div class="modal-body">
        <div class="mb-2">
          <label class="form-label" for="schedule-title">タイトル</label>
          <input type="text" class="form-control" id="schedule-title" bind:value={editing.title}>
        </div>
        <div class="mb-2 d-flex">
          <div class="me-4">
            <label class="form-label">種別</label>
            <div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="schedule-kind-out"
                  value="out" bind:group={editing.kind}>
                <label class="form-check-label" for="schedule-kind-out">出金</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="schedule-kind-in"
                  value="in" bind:group={editing.kind}>
                <label class="form-check-label" for="schedule-kind-in">入金</label>
              </div>
            </div>
          </div>
          <div>
            <label class="form-label" for="schedule-amount">金額（円）</label>
            <input type="number" class="form-control" id="schedule-amount"
              style="width: 160px;" min="0" bind:value={editing.amount}>
          </div>
        </div>
        <div class="mb-2">
          <label class="form-label">繰り返し</label>
          <div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="schedule-rec-monthly"
                value="monthly" bind:group={editing.recurrence}>
              <label class="form-check-label" for="schedule-rec-monthly">毎月</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="schedule-rec-once"
                value="once" bind:group={editing.recurrence}>
              <label class="form-check-label" for="schedule-rec-once">単発</label>
            </div>
          </div>
        </div>
        {#if ( editing.recurrence === 'monthly' )}
        <div class="mb-2">
          <label class="form-label" for="schedule-day">発生日（毎月）</label>
          <select class="form-select" id="schedule-day" style="width: 200px;"
            bind:value={editing.dayOfMonth}>
            <option value={0}>月末</option>
            {#each Array.from({length: 31}, (_, i) => i + 1) as day}
            <option value={day}>{day}日</option>
            {/each}
          </select>
        </div>
        {:else}
        <div class="mb-2">
          <label class="form-label" for="schedule-date">発生日</label>
          <input type="date" class="form-control" id="schedule-date"
            style="width: 200px;" bind:value={editing.date}>
        </div>
        {/if}
        <div class="mb-2">
          <label class="form-label" for="schedule-note">備考</label>
          <textarea class="form-control" id="schedule-note" rows="2" bind:value={editing.note}></textarea>
        </div>
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="schedule-enabled"
            bind:checked={editing.enabled}>
          <label class="form-check-label" for="schedule-enabled">有効</label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" on:click={() => { closeModal(); }}>キャンセル</button>
        <button type="button" class="btn btn-primary"
          disabled={!canSave}
          on:click={() => { save(); }}>保存</button>
      </div>
    </div>
  </div>
</div>
{/if}

<script>
import {onMount} from 'svelte';
import axios from 'axios';
import {link, currentPage} from '../../javascripts/router.js';

export let status;

let year, month;
let items = [];
let totalIn = 0;
let totalOut = 0;
let balance = 0;
let schedules = [];
let feedUrl = '';
let modalOpen = false;
let editing = {};

const formatMoney = (value) => ( Number(value) || 0 ).toLocaleString('ja-JP');

const recurrenceLabel = (schedule) => {
  if ( schedule.recurrence === 'once' ) {
    return `単発 (${schedule.date})`;
  }
  const day = parseInt(schedule.dayOfMonth);
  return `毎月 (${day <= 0 ? '月末' : day + '日'})`;
};

const moveMonth = (delta) => {
  const date = new Date(year, month - 1 + delta, 1);
  link(`/schedule?ym=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
};

const loadMonth = async () => {
  const result = await axios.get(`/api/schedule/${year}/${month}`);
  items = result.data.items;
  totalIn = result.data.totalIn;
  totalOut = result.data.totalOut;
  balance = result.data.balance;
};

const loadDefs = async () => {
  const result = await axios.get('/api/schedule');
  schedules = result.data.schedules;
  feedUrl = result.data.feedUrl || '';
};

const openEditor = (schedule) => {
  if ( schedule ) {
    editing = {
      id: schedule.id,
      title: schedule.title,
      kind: schedule.kind,
      amount: Number(schedule.amount),
      recurrence: schedule.recurrence,
      dayOfMonth: parseInt(schedule.dayOfMonth) || 0,
      date: schedule.date,
      note: schedule.note,
      enabled: schedule.enabled
    };
  } else {
    editing = {
      title: '',
      kind: 'out',
      amount: null,
      recurrence: 'monthly',
      dayOfMonth: 25,
      date: null,
      note: '',
      enabled: true
    };
  }
  modalOpen = true;
};

const closeModal = () => {
  modalOpen = false;
};

$: canSave = editing.title && editing.title.trim() &&
  Number(editing.amount) > 0 &&
  ( ( editing.recurrence === 'monthly' ) || editing.date );

const save = async () => {
  const values = {
    title: editing.title,
    kind: editing.kind,
    amount: Number(editing.amount),
    recurrence: editing.recurrence,
    dayOfMonth: editing.recurrence === 'monthly' ? parseInt(editing.dayOfMonth) || 0 : null,
    date: editing.recurrence === 'once' ? editing.date : null,
    note: editing.note,
    enabled: editing.enabled
  };
  if ( editing.id ) {
    await axios.put(`/api/schedule/${editing.id}`, values);
  } else {
    await axios.post('/api/schedule', values);
  }
  closeModal();
  loadMonth();
  loadDefs();
};

const remove = (schedule) => {
  if ( !confirm(`予定「${schedule.title}」を削除しますか？`) ) {
    return;
  }
  axios.delete(`/api/schedule/${schedule.id}`).then(() => {
    loadMonth();
    loadDefs();
  });
};

const copyFeedUrl = async () => {
  const url = ( typeof window !== 'undefined' ) ? window.location.origin + feedUrl : feedUrl;
  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    console.error('copy failed', e);
  }
};

const regenerateToken = () => {
  if ( !confirm('現在のフィードURLを無効にして新しいトークンを発行します。\n購読しているカレンダーは設定し直す必要があります。よろしいですか？') ) {
    return;
  }
  axios.post('/api/schedule/token').then((result) => {
    feedUrl = result.data.feedUrl;
  });
};

// URLクエリ ?ym=YYYY-MM で表示月を指定（無ければ当月）。
// lastYm の初期値は 'init'（null のままでは「クエリなし」の初回が
// 未処理のままになるため）
let lastYm = 'init';
$: {
  const query = ($currentPage || '').split('?')[1];
  const ym = new URLSearchParams(query || '').get('ym');
  if ( ym !== lastYm ) {
    lastYm = ym;
    const now = new Date();
    if ( ym && /^\d{4}-\d{2}$/.test(ym) ) {
      year = parseInt(ym.split('-')[0]);
      month = parseInt(ym.split('-')[1]);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    if ( typeof loadMonth === 'function' ) {
      loadMonth();
    }
    if ( typeof loadDefs === 'function' ) {
      loadDefs();
    }
  }
}

onMount(() => {
});
</script>

<style>
.schedule-modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 1055;
}
</style>
