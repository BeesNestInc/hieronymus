<div class="brand-container">
  <a href="#" class="brand-link"
    on:click|preventDefault={() => {
      link('/home');
    }}>
      <img src="/public/logo.png" alt="Logo" class="brand-image">
      <span class="brand-text">Hieronymus</span>
  </a>
</div>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="sidebar" bind:this={sidebarEl}
  on:scroll={() => {
    // フライアウトは画面座標で固定表示するので、スクロールしたら閉じる
    if ( closeTimer ) { clearTimeout(closeTimer); closeTimer = null; }
    if ( switchTimer ) { clearTimeout(switchTimer); switchTimer = null; }
    hoveredSection = null;
  }}>
	<nav class="mt-2">
    <ul class="nav nav-pills nav-sidebar flex-column">
      <li class="nav-item">
        <div class="d-flex align-items-center justify-content-between" style="width:240px;">
          <!-- svelte-ignore a11y-missing-attribute -->
          <a class="nav-link">
					  <i class="bi bi-menu-button-wide me-1"></i>
            マイページ
          </a>
          {#if ( isMenuEditMode)}
          <div>
          <button class="btn btn-narrow dropdown-toggle" title="テンプレートからマイページを追加します"
          	type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <Icon icon="bi:plus" class="text-warning"></Icon>
          </button>
          <ul class="dropdown-menu">
            {#each menuTemplates as template}
            <button class="dropdown-item"
            	on:click|preventDefault={() => {
                newMenu(template);
              }}
              >
              {template.title}
            </button>
            {/each}
          </ul>

          <button type="button" class="btn btn-narrow" title="並べ替えを保存して編集を終わります" on:click={menuEditDone}>
            <Icon icon="bi:check" class="text-warning"></Icon></button>
          </div>
          {:else}
          <button type="button" class="btn btn-narrow" title="マイページを追加・並べ替え・削除します"
            on:click={() => {
            isMenuEditMode = true;
          }}><Icon icon="bi:pencil" class="text-warning"></Icon></button>
          {/if}
        </div>
        {#if ( isMenuEditMode )}
        <div class="mypage-hint">
          マイページの一覧を編集中（＋追加・ドラッグで並べ替え・×削除）。
          各ページの中身は、ページを開いて「編集モードへ」から。
        </div>
        {/if}
        <ul class="nav nav-pills nav-sidebar flex-column"
        	style="margin-left:20px;list-style: none;"
        	bind:this={menuItems}>
          {#each menuEntries as entry, i (entry)}
          <li class="nav-item" data-id={i}>
            <div class="d-flex align-items-center justify-content-between" style="width:230px;">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-missing-attribute -->
            <a class={ ( args[1] === 'menu' && args[2] == entry.id ) ? 'nav-link active': 'nav-link'}
            	style="cursor:pointer;"
              on:click|preventDefault={() => {
                link(`/menu/${entry.id}`);
              }}>
              <Icon class="nav-icon{ isMenuEditMode ? ' drag-handle' : ''}" 
                icon="bi:circle"></Icon>
							{entry.title}
            </a>
            {#if isMenuEditMode}
            <button type="button" class="btn btn-narrow"
            	on:click={() => {
                deleteMenu(entry);
              }}>
              <Icon icon="bi:x" class="text-warning"></Icon>
            </button>
            {/if}
            </div>
          </li>
          {/each}
        </ul>
      </li>
		</ul>
  </nav>
  <nav class="mt-2">
    <ul class="nav nav-pills nav-sidebar flex-column">
      {#each visibleGroups as group (group.section)}
      <li class="nav-group" class:collapsed={!inFlowSections.has(group.section)}
        on:mouseenter={(e) => { openSection(group.section, e.currentTarget); }}
        on:mouseleave={() => { closeSection(group.section); }}>
        <div class="nav-caption" role="button" tabindex="0"
          title={ pinnedSet.has(group.section) ? 'クリックで固定を解除' : 'クリックで常に開く' }
          on:click={() => { togglePinned(group.section); }}
          on:keydown={(e) => { if ( e.key === 'Enter' || e.key === ' ' ) togglePinned(group.section); }}>
          {sectionLabel(group.section)}
          <Icon class="nav-caption-chevron" icon="bi:{ expandedSections.has(group.section) ? 'chevron-down' : 'chevron-right' }"></Icon>
        </div>
        {#if ( expandedSections.has(group.section) )}
        <!-- hover展開（flyout）はtransitionを付けない。見出しの右横に
             ポップアップするので、下の見出しは覆わない（大項目間を
             マウスで滑っても何も邪魔されず、子項目もクリックできる）。
             pin/現在地のグループはその場（フロー内）で開く -->
        <ul class:flyout={flyoutSections.has(group.section)}
          style={ flyoutSections.has(group.section) && flyoutPos.section === group.section ?
            `top:${flyoutPos.top}px;left:${flyoutPos.left}px;max-height:calc(100vh - ${flyoutPos.top}px - 12px)` : '' }>
          {#each group.entries as entry}
          {#if ( entry.title )}
 			<li class="nav-item">
 			  <a class={ $currentPage && $currentPage.match(entry.match) ? 'nav-link active': 'nav-link'}
          draggable="true"
          data-type={entry.name}
          on:dragstart={startDrag}
          on:click|preventDefault={() => {
            // 下位階層のある親はここでは遷移しない（クリックで開閉。
            //遷移は下位の項目から。下位のない親は従来どおり遷移）
            if ( entry.submenu ) {
              toggleSubmenu(entry.name);
              return;
            }
            link(entry.href(status));
          }}
          href="#">
          {#if ( entry.icon )}
          {#if ( entry.icon.name)}
          <Icon class="nav-icon me-1" icon={entry.icon.name}></Icon>
          {:else}
          <img src={entry.icon.src} class="icon-img">
          {/if}
          {:else}
          <Icon class="nav-icon" icon="bi:circle"></Icon>
          {/if}
          {entry.title}{#if ( entry.submenu )}<Icon class="nav-icon float-end" icon="bi:{ menuOpenState.get(entry.name) ? 'chevron-down' : 'chevron-right' }"></Icon>{/if}
        </a>
        {#if ( entry.submenu && menuOpenState.get(entry.name) )}
        <ul>
          {#each entry.submenu as subentry}
          {#if ( !subentry.authority || subentry.authority(status.user, status.company) )}
          <li class="nav-item">
            <a class={ $currentPage && $currentPage.match(subentry.match) ? 'nav-link active': 'nav-link'}
              draggable="true"
              data-type={entry.name}
              on:dragstart={startDrag}
              on:click|preventDefault={() => {
                link(subentry.href(status));
              }}
              href="#">
              {#if subentry.icon}
              {#if ( subentry.icon.name)}
              <Icon class="nav-icon me-1" icon={subentry.icon.name}></Icon>
              {:else}
              <img src={subentry.icon.src} class="icon-img">
              {/if}
              {:else}
              <Icon class="nav-icon" icon="fa6-solid:circle"></Icon>
              {/if}
              {subentry.title}
            </a>
          </li>
          {/if}
          {/each}
        </ul>
        {/if}
 			</li>
      {/if}
      {/each}
        </ul>
        {/if}
      </li>
      {/each}
    </ul>
  </nav>
</div>


<style>
.icon {
  margin-right: 0.5rem;
}
.nav-caption {
  /* 子項目（nav-link）と同じサイズ。大項目は見出しでありながら主要な
     クリック対象（pin・hoverの起点）なので、字を小さくしない */
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.55);
  padding: 0.75rem 1rem 0.2rem;
  letter-spacing: 0.08em;
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}
.mypage-hint {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.45);
  padding: 0.25rem 1rem 0.2rem 1rem;
  margin-left: 1rem;
}
.nav-caption:hover {
  color: rgba(255, 255, 255, 0.85);
}
.nav-caption-chevron {
  font-size: 0.7rem;
}
/* 閉じているグループの見出しは上paddingを詰めてコンパクトに。
   ※負マージンで隣接LIを重ねる手法は使わない（後続のLIが前のグループの
   見出し下部とflyout上端に覆い被さり、見出しからflyoutへのマウス移動で
   誤って次のグループのhoverが発火してflyoutが差し替わる） */
.nav-group.collapsed .nav-caption {
  padding-top: 0.4rem;
}
.nav-group.collapsed .nav-caption-chevron {
  opacity: 0.6;
}
/* hover一時展開は見出しの右横にポップアップする（画面座標で固定表示。
   下の見出しを覆わないので、大項目間をマウスで滑っても邪魔されない） */
.nav-group {
  position: relative;
}
ul.flyout {
  position: fixed;
  z-index: 1060;
  width: max-content;
  min-width: 220px;
  background-color: var(--sidebar-bg);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  border-radius: 0 0 0.4rem 0.4rem;
  padding: 0.25rem 0 0.5rem;
  margin: 0;
  list-style: none;
  overflow-y: auto;
}
</style>
<script>
import axios from 'axios';
import {onMount, afterUpdate, onDestroy, createEventDispatcher, tick} from 'svelte';
import menu from '../../../config/module-list.js';
import Sortable from 'sortablejs';
import Icon from '@iconify/svelte';
import eventBus from '../../javascripts/event-bus.js';
import {currentMenu, getStore} from '../../javascripts/current-record.js'
import { currentPage, link } from '../../javascripts/router.js';

export	let status;
export let mainCount;

let menuItems;
let isMenuEditMode = false;
let menuTemplates = [];

// 下位階層ある親メニューはクリックで開閉する（遷移しない）。
// 手動トグルの状態+「今いるページが下位に当たるなら自動で開く」。
// **テンプレートからはこの$:式を通して参照する**（Svelte4はテンプレート
// から関数呼び出しの中身を追跡しないので、関数で包むと開閉の再描画が
// 起きない）
let openSubmenus = new Set();
const toggleSubmenu = (name) => {
  if ( openSubmenus.has(name) ) {
    openSubmenus.delete(name);
  } else {
    openSubmenus.add(name);
  }
  // Setの中身の変更を検知させるため参照を差し替える
  openSubmenus = new Set(openSubmenus);
};
$: menuOpenState = new Map(menu.map((entry) => [
  entry.name,
  openSubmenus.has(entry.name) ||
    Boolean( $currentPage && $currentPage.match(entry.match) )
]));

// ---- セクション見出し ----
// module-list.js の section でグループ化し、見出し付きで描画する。
// 権限でグループ内の全項目が非表示になるセクションは、見出し自体も出さない
const SECTION_LABELS = {
  daily: '日々の作業',
  expense: '経費精算',
  reports: '確認・帳票',
  crm: '顧客・案件',
  master: 'マスタ',
  admin: '管理'
};
const sectionLabel = (section) => SECTION_LABELS[section] || section;

const isEntryVisible = (entry, status) => {
  return Boolean( entry.title && entry.section &&
    ( !entry.authority || entry.authority(status.user, status.company) ) );
};

// グループ化は「並び順の連続性」で決める（section順＝configの記載順）
$: visibleGroups = buildGroups(menu, status);
const buildGroups = (entries, status) => {
  if ( !status || !status.user ) {
    return [];
  }
  const groups = [];
  let current = null;
  for ( const entry of entries ) {
    if ( !isEntryVisible(entry, status) ) {
      continue;
    }
    if ( !current || current.section !== entry.section ) {
      current = { section: entry.section, entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }
  return groups;
};

// ---- グループの開閉 ----
// 現在地（アクティブページ）を含むグループは常に開く。他は閉じておき、
// 見出しhoverで中身を一時表示、クリックで常時開閉（ピン留め）する
let pinnedSections = [];
let hoveredSection = null;
let sidebarEl;

// hover一時展開はすぐ閉じず少し待つ（マウスを項目へ動かす途中で
// グループの外に一瞬出ても閉じないようにする。チラつき防止）
let closeTimer = null;
// hover展開（flyout）は見出しの右横にポップアップする（画面座標で固定）。
// 下の見出しを覆わないので、大項目間をマウスで滑れるし子項目もクリックできる
let flyoutPos = { section: null, top: 0, left: 0 };
// 別グループへの切替は少し待つ（popupへ移動する途中で次の見出しを
// 掠めても切り替わらないようにする。見出しの上で止まれば切替わる）
let switchTimer = null;
const openSection = (section, li) => {
  if ( closeTimer ) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if ( hoveredSection === section ) {
    // 自グループ内（見出し↔popup間の移動）は即応する
    if ( switchTimer ) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
    return;
  }
  if ( switchTimer ) {
    clearTimeout(switchTimer);
  }
  switchTimer = setTimeout(() => {
    switchTimer = null;
    hoveredSection = section;
    if ( li ) {
      const liRect = li.getBoundingClientRect();
      const cap = li.querySelector('.nav-caption');
      const capRect = cap ? cap.getBoundingClientRect() : liRect;
      flyoutPos = { section: section, top: capRect.top, left: liRect.right };
    }
  }, 200);
};
const closeSection = (section) => {
  if ( closeTimer ) {
    clearTimeout(closeTimer);
  }
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if ( hoveredSection === section ) {
      hoveredSection = null;
    }
  }, 500);
};
onDestroy(() => {
  if ( closeTimer ) {
    clearTimeout(closeTimer);
  }
  if ( switchTimer ) {
    clearTimeout(switchTimer);
  }
});

const findActiveSection = (groups, page) => {
  if ( !page ) {
    return null;
  }
  for ( const group of groups ) {
    for ( const entry of group.entries ) {
      if ( page.match(entry.match) ) {
        return group.section;
      }
      if ( entry.submenu ) {
        for ( const sub of entry.submenu ) {
          if ( page.match(sub.match) ) {
            return group.section;
          }
        }
      }
    }
  }
  return null;
};

$: activeSection = findActiveSection(visibleGroups, $currentPage);

// テンプレートから関数（isExpanded等）を呼ぶとSvelte4は関数内の依存を
// 追跡しない（Docs/logs/20261115.md のAI設定パネルバグと同型）。
// 展開状態はリアクティブなSetに集約してテンプレートから参照する
$: expandedSections = new Set([
  activeSection,
  ...pinnedSections,
  ...( hoveredSection ? [hoveredSection] : [] )
].filter((s) => Boolean(s)));
$: pinnedSet = new Set(pinnedSections);
// pin/現在地による展開はフロー内（ここだけ高さが変わり、意図的な操作）。
// hoverだけによる展開は、下の項目を覆うフライアウトで表示する
// （フローの高さを変えない。別の見出しに移動しても何も動かない）
$: inFlowSections = new Set([activeSection, ...pinnedSections].filter((s) => Boolean(s)));
$: flyoutSections = new Set(
  ( hoveredSection && !inFlowSections.has(hoveredSection) ) ? [ hoveredSection ] : []
);

const togglePinned = (section) => {
  if ( pinnedSections.includes(section) ) {
    pinnedSections = pinnedSections.filter((s) => s !== section);
  } else {
    pinnedSections = [...pinnedSections, section];
  }
};

const newMenu = (template) => {
  currentMenu.set({
    title: template.title,
    displayOrder: 99,
    widgets: JSON.parse(template.body)
  });
	link('/menu/new');
}

let deleteEntry;
const deleteMenu = (entry) => {
  deleteEntry = entry;
  eventBus.emit('okModal', {
    title:'メニューの削除',
    description: `メニュー「${entry.title}」を削除します<br/>よろしいですか？`,
    reply: 'deleteMenu'
  });
}
const menuEditDone = (event) => {
  for ( let i = 0; i < menuEntries.length ; i += 1 )  {
    menuEntries[i].displayOrder = i + 1;
  }
  axios.put('/api/menu', {
    menus: menuEntries
  }).then((result) => {
    isMenuEditMode = false;
    console.log('done');
  });
}
onMount(async () => {
  let result = await axios.get('/api/menu');
  menuEntries = result.data.menus;
  axios.get('/api/menu/templates').then((result) => {
    menuTemplates = result.data.templates;
  })
  eventBus.on('menuUpdated', () => {
    console.log('sidebar menuUpdated');
    axios.get('/api/menu').then((result) => {
    	menuEntries = result.data.menus;
  	})
  });
  eventBus.once('deleteMenu', (ok) => {
    if  ( ok )  {
      axios.delete(`/api/menu/${deleteEntry.id}`).then(() => {
    	  axios.get('/api/menu').then((result) => {
    		  menuEntries = result.data.menus;
  		  })
  	  });
    }
  })
  const sortable = new Sortable(menuItems, {
    animation: 150,
    handle: ".drag-handle",
    fallbackOnBody: true,
    removeCloneOnHide: true,
    onEnd: (evt) => {
      let { oldIndex, newIndex } = evt;

      if (oldIndex !== newIndex) {
        const moved = menuEntries[oldIndex];
        menuEntries.splice(oldIndex, 1);
        menuEntries.splice(newIndex, 0, moved);
        menuEntries = [...menuEntries];
      }
    }
  });
  console.log({sortable})
});

let menuEntries = [];

let args = [];
$: if ($currentPage) {
  args = $currentPage.split('/');
}

const startDrag = (event) => {
  let name = event.target.dataset.type;
  //console.log('dragData', name);
  event.dataTransfer.setData("application/json", JSON.stringify({
    name: name,
    component: 'MenuLink'
  }));
  event.dataTransfer.effectAllowed = "copy";
};

</script>
