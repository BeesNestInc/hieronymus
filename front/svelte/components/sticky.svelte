<div class="sticky-wrap" bind:this={wrapEl}>
  <button type="button" class="btn btn-sm btn-outline-light position-relative"
    title="付箋・申し送り"
    on:click={() => { toggle(); }}>
    <i class="bi bi-bell"></i>
    {#if ( unreadCount > 0 )}
    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
    {/if}
  </button>
  {#if ( open )}
  <div class="sticky-panel" use:clickOutside>
    <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
      <span class="fw-bold">付箋</span>
      <span>
        <button type="button" class="btn btn-sm btn-primary"
          on:click={() => { openCompose(); }}>新規&nbsp;<i class="bi bi-plus-lg"></i></button>
      </span>
    </div>
    <div class="sticky-tabs d-flex border-bottom">
      {#each [['all', '全て'], ['handoff', '申し送り'], ['memo', 'メモ']] as [key, label]}
      <button type="button" class="sticky-tab" class:active={tab === key}
        on:click={() => { tab = key; }}>
        {label}
        {#if ( tabUnread[key] > 0 )}
        <span class="badge bg-danger ms-1">{tabUnread[key]}</span>
        {/if}
      </button>
      {/each}
    </div>
    <div class="sticky-list">
      {#if ( visible.length === 0 )}
      <div class="text-muted small p-3">付箋はありません</div>
      {:else}
      {#each visible as sticky}
      <div class="sticky-item" class:unread={!sticky.readAt}>
        <div class="d-flex justify-content-between align-items-start"
          role="button"
          on:click={() => { toggleSticky(sticky); }}>
          <div class="sticky-body flex-grow-1">
            <div class="small">
              {#if ( !sticky.readAt )}
              <span class="dot"></span>
              {/if}
              {#if ( tab === 'all' )}
              <span class="text-muted">{sticky.kind === 'memo' ? 'メモ' : '申し送り'}</span>
              {/if}
              {#if ( sticky.importance === 2 )}
              <span class="badge bg-danger">至急</span>
              {:else if ( sticky.importance === 1 )}
              <span class="badge bg-warning text-dark">重要</span>
              {/if}
              <span class="fw-bold">{sticky.authorName}</span>
              <span class="text-muted ms-1">{dateTime(sticky.createdAt)}</span>
            </div>
            {#if ( expanded === sticky.stickyId )}
            <div class="sticky-message">{sticky.message}</div>
            <div class="small text-muted">
              {#if ( sticky.receiverName )}
              宛先: {sticky.receiverName}
              {:else if ( sticky.receiverNames )}
              宛先: {sticky.receiverNames.join(', ')}
              {/if}
            </div>
            <div class="mt-1">
              {#if ( sticky.statusId )}
              <button type="button" class="btn btn-sm btn-outline-secondary"
                on:click|stopPropagation={() => { forward(sticky); }}>転送&nbsp;<i class="bi bi-arrow-right"></i></button>
              {/if}
              <button type="button" class="btn btn-sm btn-outline-danger"
                on:click|stopPropagation={() => { remove(sticky); }}>削除&nbsp;<i class="bi bi-trash"></i></button>
            </div>
            {:else}
            <div class="sticky-preview">{sticky.message}</div>
            {/if}
          </div>
        </div>
      </div>
      {/each}
      {/if}
    </div>
  </div>
  {/if}
</div>

{#if ( modalMode === 'compose' )}
<div class="modal d-block sticky-modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">新規付箋</h5>
        <button type="button" class="btn-close" on:click={() => { closeModal(); }}></button>
      </div>
      <div class="modal-body">
        <textarea class="form-control" rows="4" bind:value={draftMessage}
          placeholder="通知や申し送りを書いてください"></textarea>
        <div class="d-flex align-items-center mt-2">
          <div class="form-check">
            <input class="form-check-input" type="radio" id="sticky-kind-handoff"
              value="handoff" bind:group={draftKind}>
            <label class="form-check-label" for="sticky-kind-handoff">申し送り（人に伝える）</label>
          </div>
          <div class="form-check ms-3">
            <input class="form-check-input" type="radio" id="sticky-kind-memo"
              value="memo" bind:group={draftKind}>
            <label class="form-check-label" for="sticky-kind-memo">メモ（自分用）</label>
          </div>
        </div>
        <div class="d-flex align-items-center mt-2">
          <span class="small text-muted me-2">重要度</span>
          <select class="form-select form-select-sm w-auto" bind:value={draftImportance}>
            <option value={0}>通常</option>
            <option value={1}>重要</option>
            <option value={2}>至急</option>
          </select>
        </div>
        {#if ( draftKind === 'handoff' )}
        <div class="form-check mt-2">
          <input type="checkbox" class="form-check-input" id="sticky-send-all"
            bind:checked={sendToAll}>
          <label class="form-check-label" for="sticky-send-all">全員に通知する</label>
        </div>
        <div class="sticky-users">
          {#each users as user}
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="sticky-user-{user.id}"
              bind:checked={user.checked}>
            <label class="form-check-label" for="sticky-user-{user.id}">{user.name}</label>
          </div>
          {/each}
        </div>
        <div class="small text-muted mt-1">
          {#if ( sendToAll )}
          全員に申し送ります
          {:else if ( selectedCount === 0 )}
          申し送り先を選んでください
          {:else}
          {selectedCount}人に申し送ります
          {/if}
        </div>
        {:else}
        <div class="small text-muted mt-2">自分だけが見るメモとして保存します</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" on:click={() => { closeModal(); }}>キャンセル</button>
        <button type="button" class="btn btn-primary"
          disabled={!canSubmit}
          on:click={() => { send(); }}>{submitLabel}</button>
      </div>
    </div>
  </div>
</div>
{:else if ( modalMode === 'forward' )}
<div class="modal d-block sticky-modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">転送</h5>
        <button type="button" class="btn-close" on:click={() => { closeModal(); }}></button>
      </div>
      <div class="modal-body">
        <div class="sticky-users">
          {#each users as user}
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="sticky-fwd-{user.id}"
              bind:checked={user.checked}>
            <label class="form-check-label" for="sticky-fwd-{user.id}">{user.name}</label>
          </div>
          {/each}
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" on:click={() => { closeModal(); }}>キャンセル</button>
        <button type="button" class="btn btn-primary"
          on:click={() => { sendForward(); }}>転送</button>
      </div>
    </div>
  </div>
</div>
{/if}

<script>
import {onMount, onDestroy} from 'svelte';
import axios from 'axios';
import {formatDate} from '../../../libs/utils.js';
import {currentPage} from '../../javascripts/router.js';
import eventBus from '../../javascripts/event-bus.js';

let open = false;
let stickies = [];
let unreadCount = 0;
let expanded = null;
let users = [];
let modalMode = null;
let draftMessage = '';
let draftImportance = 0;
let sendToAll = false;
let forwardTarget = null;
let wrapEl;

let pollTimer;

// 宛先の有無で呼び方が変わる。誰かに宛てるときは「送信」、
// 自分のためだけなら「保存」（TODOメモの感覚）
let draftKind = 'handoff';
$: selectedCount = users.filter((user) => user.checked).length;
$: submitLabel = draftKind === 'memo' ? '保存' : '送信';
$: canSubmit = draftMessage.trim() &&
  ( ( draftKind === 'memo' ) || sendToAll || selectedCount > 0 );

// パネルのタブ。申し送り（他人に伝える）/ メモ（自分用）で絞り込む
let tab = 'all';
$: visible = ( tab === 'all' ) ? stickies : stickies.filter((s) => s.kind === tab);
$: tabUnread = {
  all: stickies.filter((s) => !s.readAt).length,
  handoff: stickies.filter((s) => ( !s.readAt ) && ( s.kind === 'handoff' )).length,
  memo: stickies.filter((s) => ( !s.readAt ) && ( s.kind === 'memo' )).length
};

const loadUsers = async () => {
  if ( users.length > 0 ) {
    return;
  }
  try {
    const res = await axios.get('/api/users');
    users = res.data.users
      .filter((user) => user.id)
      .map((user) => ({ id: user.id, name: user.name, checked: false }));
  } catch (e) {
    console.error('load users failed', e);
  }
};

const refresh = async () => {
  try {
    const res = await axios.get('/api/sticky');
    stickies = res.data.stickies;
    unreadCount = res.data.unreadCount;
  } catch (e) {
    // 未ログイン時などは黙って諦める（通知なので致命的ではない）
  }
};

const toggle = () => {
  open = !open;
  if ( open ) {
    expanded = null;
    refresh();
  }
};

const toggleSticky = (sticky) => {
  if ( expanded === sticky.stickyId ) {
    expanded = null;
    return;
  }
  expanded = sticky.stickyId;
  if ( !sticky.readAt && sticky.statusId ) {
    axios.post(`/api/sticky/${sticky.stickyId}/read`).then(() => {
      sticky.readAt = new Date();
      unreadCount = stickies.filter((s) => !s.readAt).length;
    });
  }
};

const remove = (sticky) => {
  if ( !confirm('この付箋を削除しますか？') ) {
    return;
  }
  const url = sticky.statusId ?
    `/api/sticky/status/${sticky.statusId}` :
    `/api/sticky/${sticky.stickyId}`;
  axios.delete(url).then(() => {
    if ( expanded === sticky.stickyId ) {
      expanded = null;
    }
    refresh();
  });
};

const openCompose = () => {
  draftMessage = '';
  draftImportance = 0;
  draftKind = 'handoff';
  sendToAll = false;
  users.forEach((user) => { user.checked = false; });
  loadUsers();
  modalMode = 'compose';
};

const closeModal = () => {
  modalMode = null;
};

const checkedIds = () => users.filter((user) => user.checked).map((user) => user.id);

const send = () => {
  axios.post('/api/sticky', {
    message: draftMessage,
    kind: draftKind,
    importance: parseInt(draftImportance) || 0,
    sendToAll: draftKind === 'handoff' && sendToAll,
    receiverIds: draftKind === 'handoff' ? checkedIds() : []
  }).then(() => {
    modalMode = null;
    refresh();
  });
};

const forward = (sticky) => {
  forwardTarget = sticky;
  users.forEach((user) => { user.checked = false; });
  loadUsers();
  modalMode = 'forward';
};

const sendForward = () => {
  axios.post(`/api/sticky/${forwardTarget.stickyId}/forward`, {
    receiverIds: checkedIds()
  }).then(() => {
    modalMode = null;
    refresh();
  });
};

const dateTime = (value) => {
  const date = new Date(value);
  return `${formatDate(date)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;
};

const clickOutside = (node) => {
  const handler = (event) => {
    if ( wrapEl && !wrapEl.contains(event.target) ) {
      open = false;
    }
  };
  document.addEventListener('mousedown', handler, true);
  return {
    destroy() {
      document.removeEventListener('mousedown', handler, true);
    }
  };
};

// ページ遷移のたびに未読を取り直す（遷移検知はパス部分だけを見る）
let lastPath = '';
$: {
  const path = ($currentPage || '').split('?')[0];
  if ( path !== lastPath ) {
    lastPath = path;
    if ( typeof refresh === 'function' ) {
      refresh();
    }
  }
}

onMount(() => {
  refresh();
  pollTimer = setInterval(refresh, 60000);
  // 付箋メモウィジェットなどからの追加・削除を即時反映する
  eventBus.on('stickyUpdated', refresh);
});

onDestroy(() => {
  if ( pollTimer ) {
    clearInterval(pollTimer);
  }
});
</script>

<style>
.sticky-wrap {
  position: relative;
  margin-right: 0.5rem;
}
.sticky-panel {
  position: absolute;
  top: calc(100% + 4px);
  /* ベルはナビバー左端にいる。right: 0 で開くとパネルが画面の外へ出るので
     ベルの左端から右方向へ開く */
  left: 0;
  width: 420px;
  max-width: 90vw;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.25rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  z-index: 1055;
  color: #212529;
}
.sticky-list {
  max-height: 60vh;
  overflow-y: auto;
}
.sticky-item {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
}
.sticky-item:last-child {
  border-bottom: none;
}
.sticky-item.unread {
  background: #fff8e1;
}
.sticky-preview {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sticky-message {
  font-size: 0.9rem;
  white-space: pre-wrap;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 50%;
  background: #dc3545;
}
.sticky-users {
  max-height: 240px;
  overflow-y: auto;
  margin-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 0.5rem;
}
.sticky-tab {
  border: none;
  background: none;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  color: #6c757d;
  border-bottom: 2px solid transparent;
}
.sticky-tab.active {
  color: #212529;
  font-weight: bold;
  border-bottom-color: #0d6efd;
}
.sticky-modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 1070;
}
</style>
