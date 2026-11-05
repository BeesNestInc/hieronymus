<div class="toast-container top-center" style="width: 320px">
  <ul>
    {#each $items as item (item.uid)}
    <li transition:fade={{ duration: 200 }}>
      <svelte:component this={item.component} data={item} />
    </li>
    {/each}
  </ul>
</div>
<script>
import { writable } from 'svelte/store';
import { fade } from 'svelte/transition';
import { BootstrapToast } from "svelte-toasts";

// 自前のトースト基盤。svelte-toasts のストアは uid に Date.now() を使うため
// 同一ミリ秒の連続表示で重複キー例外になり Svelte の更新全体が死ぬ。
// ここでは単調カウンタで採番する（時刻に依存しないため衝突は構造上ありえない）。
// 行の見た目は svelte-toasts の BootstrapToast を使い回す。
// 呼び側のAPI（show/remove）は従来通り。
const items = writable([]);
let nextUid = 0;
let lastShown = null;

const removeByUid = (uid) => {
  items.update((v) => v.filter((i) => ( i.uid !== uid )));
  if ( lastShown && lastShown.uid === uid ) {
    lastShown = null;
  }
};

export const show = (title, description, type='success') => {
  const uid = ++nextUid;
  const item = {
    uid: uid,
    title: title,
    description: description,
    // 表示時間は長め（10秒）。邪魔ならクリックで消せる
    duration: 10000,
    placement: 'top-center',
    type: type,
    theme: 'dark',
    onClick: () => {},
    onRemove: () => {},
    component: BootstrapToast,
    remove: () => removeByUid(uid)
  };
  lastShown = item;
  // クリックで消せる（pointer-events:none だと触れないので container側に auto がある想定）
  item.onClick = () => { item.remove(); };
  items.update((v) => [ ...v, item ]);
  setTimeout(() => {
    removeByUid(uid);
    item.onRemove();
  }, item.duration);
};

export const remove = () => {
  if ( lastShown ) {
    lastShown.remove();
  }
};
</script>
<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    /* 邪魔なときにクリックで消せるように */
    pointer-events: auto;
    cursor: pointer;
  }
  .toast-container {
    z-index: 9999;
    position: fixed;
    padding: 4px;
    box-sizing: border-box;
    color: #fff;
    width: max-content;
    max-width: 100%;
    /* li（トースト本体）だけポインターを拾う。全面が拾うと
       ページ操作を妨げる */
    pointer-events: none;
  }
  .toast-container.top-center {
    top: 1em;
    right: 50%;
    left: 50%;
    transform: translate(-50%, 0);
  }
</style>
