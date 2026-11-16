<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1 class="fs-3">予定表</h1>
    <div class="d-flex align-items-center">
      <div class="btn-group btn-group-sm me-3">
        <button type="button" class="btn btn-outline-secondary"
          class:active={view === 'month'}
          on:click={() => { switchView('month'); }}>月</button>
        <button type="button" class="btn btn-outline-secondary"
          class:active={view === 'year'}
          on:click={() => { switchView('year'); }}>年</button>
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary"
        on:click={() => { move(-1); }}>&lt;</button>
      <span class="fs-5 fw-bold mx-2">{view === 'year' ? `${year}年` : `${year}年${month}月`}</span>
      <button type="button" class="btn btn-sm btn-outline-secondary"
        on:click={() => { move(1); }}>&gt;</button>
      <button type="button" class="btn btn-primary ms-4"
        on:click={() => { openEditor(); }}>新規&nbsp;<i class="bi bi-plus-lg"></i></button>
    </div>
  </div>

  {#if ( view === 'month' )}
  <div class="d-flex fs-5 mt-2 mb-2">
    <span class="me-4">入金計 <span class="text-success fw-bold">{formatMoney(totalIn)}</span>円</span>
    <span class="me-4">出金計 <span class="text-danger fw-bold">{formatMoney(totalOut)}</span>円</span>
    <span>差引 <span class="fw-bold" class:text-success={balance >= 0} class:text-danger={balance < 0}>{formatMoney(balance)}</span>円</span>
  </div>

  <table class="table table-bordered cal">
    <thead class="table-light">
      <tr>
        <th class="cal-dow text-center">日</th>
        <th class="cal-dow text-center">月</th>
        <th class="cal-dow text-center">火</th>
        <th class="cal-dow text-center">水</th>
        <th class="cal-dow text-center">木</th>
        <th class="cal-dow text-center">金</th>
        <th class="cal-dow text-center">土</th>
      </tr>
    </thead>
    <tbody>
      {#each weeks as week}
      <tr>
        {#each week as cell}
        <td class="cal-cell align-top" class:cal-today={cell && cell.isToday}
          role={cell ? 'button' : null}
          title={cell ? `${cell.date} の予定を登録` : null}
          on:click={cell ? () => { openEditorForDay(cell.date); } : undefined}>
          {#if ( cell )}
          <div class="cal-day small text-muted">{cell.day}</div>
          {#each cell.items as item (item.scheduleId)}
          <div class="cal-ev {item.kind === 'in' ? 'cal-in' : item.kind === 'out' ? 'cal-out' : 'cal-plan'}"
            role="button"
            title="{item.title}{item.kind !== 'plan' ? ' ' + formatMoney(item.amount) + '円' : ''}{item.overridden ? '（個別設定あり）' : ''}"
            on:click|stopPropagation={() => { editById(item.scheduleId, cell.date); }}>{item.title}</div>
          {/each}
          {/if}
        </td>
        {/each}
      </tr>
      {/each}
    </tbody>
  </table>
  {:else}
  <div class="fontsize-12pt mt-2" style="max-width: 800px;">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" class="text-center" style="width: 100px;">月</th>
          <th scope="col" class="text-end">入金計</th>
          <th scope="col" class="text-end">出金計</th>
          <th scope="col" class="text-end">差引</th>
          <th scope="col" class="text-center" style="width: 80px;">件数</th>
        </tr>
      </thead>
      <tbody>
        {#each yearMonths as m (m.month)}
        <tr class:table-active={m.month === month}>
          <td class="text-center">
            <button type="button" class="btn btn-link p-0"
              on:click={() => { switchMonth(m.month); }}>{m.month}月</button>
          </td>
          <td class="text-end text-success">{m.totalIn ? formatMoney(m.totalIn) : '-'}</td>
          <td class="text-end text-danger">{m.totalOut ? formatMoney(m.totalOut) : '-'}</td>
          <td class="text-end">{formatMoney(m.balance)}</td>
          <td class="text-center">{m.count || '-'}</td>
        </tr>
        {/each}
        <tr class="table-light fw-bold">
          <td class="text-center">年計</td>
          <td class="text-end text-success">{formatMoney(yearTotalIn)}</td>
          <td class="text-end text-danger">{formatMoney(yearTotalOut)}</td>
          <td class="text-end">{formatMoney(yearBalance)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
  {/if}

  <h2 class="fs-4 mt-4">予定の一覧</h2>
  <div class="d-flex align-items-center mb-1">
    <span class="small text-muted me-2">表示順</span>
    <select class="form-select form-select-sm w-auto" bind:value={listOrder}>
      <option value="date">発生日順</option>
      <option value="amount">金額順</option>
      <option value="kind">種別順</option>
      <option value="created">登録順</option>
    </select>
  </div>
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
        {#each sortedSchedules as schedule (schedule.id)}
        <tr class:opacity-50={!schedule.enabled}>
          <td>{schedule.title}{#if ( !schedule.enabled )}<span class="badge bg-secondary ms-1">停止中</span>{/if}
            {#if ( overrideCount(schedule.id) > 0 )}
            <span class="badge bg-info text-dark ms-1"
              title="特定の月だけ個別の金額等が設定されています">個別設定 ×{overrideCount(schedule.id)}</span>
            {/if}
          </td>
          <td>
            {#if ( schedule.kind === 'in' )}
            <span class="badge bg-success">入金</span>
            {:else if ( schedule.kind === 'out' )}
            <span class="badge bg-danger">出金</span>
            {:else}
            <span class="badge bg-secondary">予定</span>
            {/if}
          </td>
          <td>{recurrenceLabel(schedule)}</td>
          <td class="text-end">{schedule.kind !== 'plan' ? formatMoney(schedule.amount) + '円' : ''}</td>
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
        <h5 class="modal-title">
          {#if ( editScope === 'occurrence' )}
          予定の個別変更（{occurrenceDate}）
          {:else if ( editing.id )}
          予定の編集
          {:else}
          予定の新規登録
          {/if}
        </h5>
        <button type="button" class="btn-close" on:click={() => { closeModal(); }}></button>
      </div>
      <div class="modal-body">
        {#if ( isOccurrenceContext )}
        <div class="mb-2 p-2 border rounded bg-light">
          <div class="form-check">
            <input class="form-check-input" type="radio" id="schedule-scope-occurrence"
              value="occurrence" bind:group={editScope}>
            <label class="form-check-label" for="schedule-scope-occurrence">この月だけ変更する（{occurrenceDate}）</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" id="schedule-scope-recurrence"
              value="recurrence" bind:group={editScope}>
            <label class="form-check-label" for="schedule-scope-recurrence">毎月の予定を変更する</label>
          </div>
        </div>
        {/if}
        {#if ( editScope === 'occurrence' )}
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
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="schedule-kind-plan"
                  value="plan" bind:group={editing.kind}>
                <label class="form-check-label" for="schedule-kind-plan">予定</label>
              </div>
            </div>
          </div>
          {#if ( editing.kind !== 'plan' )}
          <div>
            <label class="form-label" for="schedule-amount">金額（円）</label>
            <input type="number" class="form-control" id="schedule-amount"
              style="width: 160px;" min="0" bind:value={editing.amount}>
          </div>
          {/if}
        </div>
        <div class="mb-2">
          <label class="form-label" for="schedule-note">備考</label>
          <textarea class="form-control" id="schedule-note" rows="2" bind:value={editing.note}></textarea>
        </div>
        <p class="small text-muted mb-0">
          この変更は {occurrenceDate} の予定にだけ反映され、他の月は変わりません。
        </p>
        {:else}
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
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="schedule-kind-plan"
                  value="plan" bind:group={editing.kind}>
                <label class="form-check-label" for="schedule-kind-plan">予定</label>
              </div>
            </div>
          </div>
          {#if ( editing.kind !== 'plan' )}
          <div>
            <label class="form-label" for="schedule-amount">金額（円）</label>
            <input type="number" class="form-control" id="schedule-amount"
              style="width: 160px;" min="0" bind:value={editing.amount}>
          </div>
          {/if}
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
        {/if}
      </div>
      <div class="modal-footer">
        {#if ( editScope === 'occurrence' && occurrenceOverride )}
        <button type="button" class="btn btn-outline-secondary me-auto"
          on:click={() => { resetOverride(); }}>毎月の予定に戻す</button>
        {/if}
        <button type="button" class="btn btn-secondary" on:click={() => { closeModal(); }}>キャンセル</button>
        <button type="button" class="btn btn-primary"
          disabled={!canSave}
          on:click={() => { save(); }}>{editScope === 'occurrence' ? 'この月だけ変更する' : '保存'}</button>
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

let view = 'month';
let year, month;
let items = [];
let totalIn = 0;
let totalOut = 0;
let balance = 0;
let schedules = [];
let overrides = [];
let feedUrl = '';
let modalOpen = false;
let editing = {};
let yearMonths = [];
let yearTotalIn = 0;
let yearTotalOut = 0;
let yearBalance = 0;
let listOrder = 'date';
// 編集スコープ。カレンダーから開いた場合は「この月だけ」か「毎月の予定」を
// 選べる（ざくっと入れた金額を、確定したらこの月だけ差し替える用途）
let editScope = 'recurrence';
let isOccurrenceContext = false;
let occurrenceDate = null;
let occurrenceOverride = null;

const formatMoney = (value) => ( Number(value) || 0 ).toLocaleString('ja-JP');

const recurrenceLabel = (schedule) => {
  if ( schedule.recurrence === 'once' ) {
    return `単発 (${schedule.date})`;
  }
  const day = parseInt(schedule.dayOfMonth);
  return `毎月 (${day <= 0 ? '月末' : day + '日'})`;
};

// ---- カレンダー（日曜始まり） ----
$: weeks = buildWeeks(year, month, items);
const buildWeeks = (y, m, monthItems) => {
  if ( !y || !m ) {
    return [];
  }
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const byDay = {};
  for ( const item of monthItems ) {
    const day = parseInt(String(item.date).split('-')[2]);
    ( byDay[day] = byDay[day] || [] ).push(item);
  }
  const today = new Date();
  const isToday = (y === today.getFullYear() && m === today.getMonth() + 1);
  const cells = [];
  for ( let i = 0; i < first.getDay(); i += 1 ) {
    cells.push(null);
  }
  for ( let day = 1; day <= days; day += 1 ) {
    cells.push({
      day: day,
      date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      items: byDay[day] || [],
      isToday: isToday && day === today.getDate()
    });
  }
  while ( cells.length % 7 !== 0 ) {
    cells.push(null);
  }
  const weeks = [];
  for ( let i = 0; i < cells.length; i += 7 ) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};

const editById = (scheduleId, date = null) => {
  const schedule = schedules.find((s) => s.id === scheduleId);
  if ( !schedule ) {
    return;
  }
  // 月次予定をカレンダーから開いたときは、この月だけの個別変更を初期選択にする
  const override = date ?
    ( overrides.find((o) => o.scheduleId === scheduleId && o.date === date) || null ) :
    null;
  if ( date && schedule.recurrence === 'monthly' ) {
    openEditor(schedule, date, override);
  } else {
    openEditor(schedule);
  }
};

// ---- 表示順 ----
$: sortedSchedules = sortSchedules(schedules, listOrder);
const sortSchedules = (defs, order) => {
  const list = [...defs];
  if ( order === 'amount' ) {
    return list.sort((a, b) => Number(b.amount) - Number(a.amount));
  }
  if ( order === 'kind' ) {
    const kindOrder = { in: 0, out: 1, plan: 2 };
    return list.sort((a, b) =>
      ( a.kind === b.kind ) ?
        ( Number(b.amount) - Number(a.amount) ) :
        ( kindOrder[a.kind] - kindOrder[b.kind] ));
  }
  if ( order === 'created' ) {
    return list.sort((a, b) => a.id - b.id);
  }
  // 発生日順: 毎月は発生日（月末は最後）、単発はその日付（月を含めて昇順）
  return list.sort((a, b) => {
    const ka = a.recurrence === 'once' ?
      100000 + String(a.date || '').replaceAll('-', '') : a.dayOfMonth || 32;
    const kb = b.recurrence === 'once' ?
      100000 + String(b.date || '').replaceAll('-', '') : b.dayOfMonth || 32;
    return ka - kb;
  });
};

const switchView = (mode) => {
  link(`/schedule?view=${mode}&ym=${year}-${String(month).padStart(2, '0')}`);
};

const switchMonth = (m) => {
  link(`/schedule?view=month&ym=${year}-${String(m).padStart(2, '0')}`);
};

const move = (delta) => {
  if ( view === 'year' ) {
    link(`/schedule?view=year&ym=${year + delta}-${String(month).padStart(2, '0')}`);
  } else {
    const date = new Date(year, month - 1 + delta, 1);
    link(`/schedule?view=month&ym=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
};

const loadMonth = async () => {
  const result = await axios.get(`/api/schedule/${year}/${month}`);
  items = result.data.items;
  totalIn = result.data.totalIn;
  totalOut = result.data.totalOut;
  balance = result.data.balance;
};

const loadYear = async () => {
  const result = await axios.get(`/api/schedule/year/${year}`);
  yearMonths = result.data.months;
  yearTotalIn = result.data.totalIn;
  yearTotalOut = result.data.totalOut;
  yearBalance = result.data.balance;
};

const loadDefs = async () => {
  const result = await axios.get('/api/schedule');
  schedules = result.data.schedules;
  overrides = result.data.overrides || [];
  feedUrl = result.data.feedUrl || '';
};

const overrideCount = (scheduleId) => {
  return overrides.filter((o) => o.scheduleId === scheduleId).length;
};

// カレンダーのセルをクリック → その日の予定の新規登録（単発・日付固定）
const openEditorForDay = (date) => {
  isOccurrenceContext = false;
  occurrenceDate = null;
  occurrenceOverride = null;
  editScope = 'recurrence';
  editing = {
    title: '',
    kind: 'out',
    amount: 0,
    recurrence: 'once',
    dayOfMonth: null,
    date: date,
    note: '',
    enabled: true
  };
  modalOpen = true;
};

const openEditor = (schedule, occurrence = null, override = null) => {  isOccurrenceContext = Boolean(occurrence);
  occurrenceDate = occurrence;
  occurrenceOverride = override;
  editScope = occurrence ? 'occurrence' : 'recurrence';
  // 編集の出発値。個別設定がある場合はそれを、無ければ元の予定を引き継ぐ。
  // （新規登録のときは schedule が undefined なので評価しない）
  const base = ( schedule ) ?
    ( ( override ) ? {
      title: override.title !== null ? override.title : schedule.title,
      kind: override.kind !== null ? override.kind : schedule.kind,
      amount: Number(override.amount !== null ? override.amount : schedule.amount),
      note: override.note !== null ? override.note : schedule.note
    } : {
      title: schedule.title,
      kind: schedule.kind,
      amount: Number(schedule.amount),
      note: schedule.note
    } ) : null;
  if ( schedule ) {
    editing = {
      id: schedule.id,
      title: base.title,
      kind: base.kind,
      amount: base.amount,
      recurrence: schedule.recurrence,
      dayOfMonth: parseInt(schedule.dayOfMonth) || 0,
      date: schedule.date,
      note: base.note,
      enabled: schedule.enabled
    };
  } else {
    // 単発予定の既定の発生日は、開いている月の1日（年ビューではその年の1月1日）。
    // 金額の既定値は0（「予定」種別では金額を入力しない）
    editing = {
      title: '',
      kind: 'out',
      amount: 0,
      recurrence: 'monthly',
      dayOfMonth: 25,
      date: view === 'year' ?
        `${year}-01-01` :
        `${year}-${String(month).padStart(2, '0')}-01`,
      note: '',
      enabled: true
    };
  }
  modalOpen = true;
};

const closeModal = () => {
  modalOpen = false;
};

// 金額0（未確定のざっくり予定など）も許可する。
// 「予定」種別はお金の関係しない予定なので金額欄は任意
$: canSave = editing.title && editing.title.trim() &&
  ( editing.kind === 'plan' ||
    ( editing.amount !== null && editing.amount !== undefined && editing.amount !== '' &&
      Number(editing.amount) >= 0 ) ) &&
  ( editScope === 'occurrence' ||
    ( editing.recurrence === 'monthly' ) || editing.date );

const save = async () => {
  if ( editScope === 'occurrence' ) {
    // この月だけの個別設定（上書き）
    await axios.put('/api/schedule/override', {
      scheduleId: editing.id,
      date: occurrenceDate,
      title: editing.title,
      kind: editing.kind,
      amount: Number(editing.amount) || 0,
      note: editing.note
    });
  } else {
    const values = {
      title: editing.title,
      kind: editing.kind,
      amount: Number(editing.amount) || 0,
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
  }
  closeModal();
  refreshAll();
};

// 個別設定を取り消して毎月の予定に戻す
const resetOverride = async () => {
  if ( !confirm(`${occurrenceDate} の個別設定を取り消し、毎月の予定に戻しますか？`) ) {
    return;
  }
  await axios.delete(`/api/schedule/override/${editing.id}/${occurrenceDate}`);
  closeModal();
  refreshAll();
};

const remove = (schedule) => {
  if ( !confirm(`予定「${schedule.title}」を削除しますか？`) ) {
    return;
  }
  axios.delete(`/api/schedule/${schedule.id}`).then(() => {
    refreshAll();
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

const refreshAll = () => {
  loadMonth();
  loadYear();
  loadDefs();
};

// URLクエリ ?view=month|year&ym=YYYY-MM で表示を指定（無ければ当月・月ビュー）。
// lastKey の初期値は 'init'（null 同士の比較で初回処理がスキップされないように）
let lastKey = 'init';
$: {
  const query = ($currentPage || '').split('?')[1];
  const params = new URLSearchParams(query || '');
  const ym = params.get('ym');
  const v = params.get('view') === 'year' ? 'year' : 'month';
  const key = `${v}:${ym}`;
  if ( key !== lastKey ) {
    lastKey = key;
    const now = new Date();
    if ( ym && /^\d{4}-\d{2}$/.test(ym) ) {
      year = parseInt(ym.split('-')[0]);
      month = parseInt(ym.split('-')[1]);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    view = v;
    refreshAll();
  }
}

onMount(() => {
});
</script>

<style>
.cal {
  table-layout: fixed;
  max-width: 1100px;
}
.cal-dow {
  font-size: 0.8rem;
}
.cal-cell {
  height: 90px;
  padding: 2px 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
.cal-cell:hover {
  background: #f8f9fa;
}
.cal-today {
  background: #e7f1ff;
}
.cal-day {
  line-height: 1.2;
}
.cal-ev {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1px 4px;
  border-radius: 3px;
  margin-bottom: 2px;
  cursor: pointer;
}
.cal-in {
  background: #d1e7dd;
  color: #0a3622;
}
.cal-out {
  background: #f8d7da;
  color: #58151c;
}
.cal-plan {
  background: #e2e3e5;
  color: #41464b;
}
.schedule-modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 1055;
}
</style>
