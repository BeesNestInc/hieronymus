<div class="page-title d-flex justify-content-between align-items-center">
  {#if isEditMode}
  <!-- タイトル幅は控えめに（ボタン群が1列に収まるように） -->
  <input type="text" class="form-control" style="width: 240px; flex-shrink: 0;"
  	bind:value={menu.title}>
  <div class="d-flex flex-wrap gap-1 justify-content-end">
    <div class="dropdown" style="display: inline;">
      <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        ウィジェットを追加
      </button>
      <ul class="dropdown-menu">
        {#each componentList as entry}
        {#if (entry.title)}
        <li>
          <button class="dropdown-item"
            draggable="true"
            data-type={entry.name}
            on:dragstart={startWidgetDrag}
            on:click={() => { addFromList(entry); }}
            >
            {entry.title}
        	</button>
        </li>
        {/if}
        {/each}
      </ul>
    </div>
    {#if ( status.user && status.user.administrable && menu.id )}
    <button class="btn btn-outline-info" style="display: inline;"
      title="このマイページを全ユーザーがテンプレートとして追加できるようにします"
      on:click={publish}>
      <i class="bi bi-box-arrow-up"></i>&nbsp;テンプレートとして公開
    </button>
    {/if}
    <button class="btn btn-success" title="保存して実行モードへ戻ります" on:click={save}>
      保存して終了
    </button>
    <button class="btn link" title="未保存の変更があれば確認します"
      on:click={finishEdit}><i class="bi bi-check"></i>編集を終える</button>  </div>
  {:else}
  <h1>{menu?.title}</h1>
  <button class="btn link" on:click={() => {
    isEditMode = !isEditMode;
  }}><i class="bi bi-pencil"></i>編集モードへ</button>
	{/if}
</div>
{#if ( isEditMode )}
<div class="alert alert-warning py-1 my-1 small">
  <i class="bi bi-pencil-square"></i>&nbsp;<b>編集中</b> —
  「ウィジェットを追加」から<b>クリックで追加</b>（グリッド末尾に置きます）。
  サイドバーの項目や一覧からの<b>ドラッグ＆ドロップ</b>なら位置を指定できます。
  ブラウザのURLをドロップするとブックマークになります。
  「配置を保存」で確定します。
  （左サイドバーのマイページ編集は「ページの追加・並べ替え」、
  ここは「このページの中身」の編集です）
</div>
{/if}
{#if ( widgets && widgets.length === 0 && !isEditMode )}
<div class="text-muted p-4 border rounded">
  何も置かれていません。右上部の「編集モードへ」からウィジェットを追加してください。
</div>
{/if}
<Menu
  bind:status={status}
  bind:toast={toast}
  bind:widgets={widgets}
  bind:isEditMode={isEditMode}
  reload={reload}
/>

<script>
import axios from 'axios';
import Menu from '../components/menu.svelte';
import { onMount, onDestroy, beforeUpdate, tick} from "svelte";
import {currentMenu, getStore} from '../../javascripts/current-record.js'
import {pageTitleDetail} from '../../javascripts/title.js';
import {numeric, formatDate} from '../../../libs/utils.js';
import {eventBus as tableBus} from '../../javascripts/table-maintenance.js';
import menuBus from '../../javascripts/event-bus.js';
import {componentList, activateWidgets, findComponent} from '../../javascripts/widget-list.js';
import { v4 as uuidv4 } from "uuid";

export let status;
export let toast;

let menu;
let widgets = [];
let arg2;
let reload = 0; // ★ これで変更を通知
let isEditMode = false;
// <TITLE>用に表示用の menu.title をそのまま流用する（タイトル用の新規fetchはしない）
$: pageTitleDetail.set(menu?.title || null);

const startWidgetDrag = (event) => {
  let name = event.target.dataset.type;
  console.log('dragData', name);
  event.dataTransfer.setData("application/json", JSON.stringify({
    component: name
  }));
  event.dataTransfer.effectAllowed = "copy";
}

const serializeMenu = () => {
  return	({
    id: menu.id,
    title: menu.title,
    displayOrder: menu.displayOrder,
    body: JSON.stringify(widgets)
  });
}

const deserializeMenu = (_menu) => {
  return	({
    id: _menu.id,
    title: _menu.title,
    displayOrder: _menu.displayOrder,
    widgets: JSON.parse(_menu.body)
  })
}

// 「ウィジェットを追加」からのクリック追加。グリッドの末尾に置く
// （ドラッグで持っていけば位置を指定できる。クリックでもドラッグでも
// 同じウィジェットが追加される）
const addFromList = async (entry) => {
  const component = findComponent(entry.name);
  if ( !component ) {
    return;
  }
  let options = {};
  if ( component.create ) {
    options = await component.create({}, status);
  } else {
    options = { title: component.title };
  }
  widgets = [...widgets, {
    id: uuidv4(),
    x: undefined,
    y: undefined,
    w: component.defaultW || 4,
    h: component.defaultH || 23,
    minimize: false,
    component: entry.name,
    _component: component.component,
    options
  }];
  reload += 1;
};

// 自分のマイページを全ユーザー用のテンプレートとして公開する（管理者のみ）。
// 公開は複製を作るだけなので、元のマイページはそのまま残る
const publish = () => {
  if ( !confirm(`マイページ「${menu.title}」をテンプレートとして公開しますか？\n公開すると全ユーザーが「＋」からこのページを追加できるようになります。`) ) {
    return;
  }
  axios.post(`/api/menu/publish/${menu.id}`).then((result) => {
    if ( result.data.code === 0 ) {
      toast.show('公開しました', `テンプレート「${result.data.template.title}」を公開しました。全ユーザーが「＋」から追加できます。`);
      menuBus.emit('menuUpdated');
    } else {
      toast.show('公開に失敗しました', '', 'danger');
    }
  });
};

// 編集を終える。未保存の変更があれば確認する
// （保存して終了 / 破棄して終了 のどちらでも抜けられる。
//  「配置を保存」忘れで変更が消える事故と、キャンセルしたい需要の両方に対応）
const finishEdit = () => {
  const current = JSON.stringify(serializeMenu());
  if ( current === savedSnapshot ) {
    isEditMode = false; // 変更なし。そのまま抜ける
    return;
  }
  if ( confirm('変更が保存されていません。保存して編集を終えますか？\n（キャンセル＝変更を破棄して終了）') ) {
    isEditMode = false;
    save();
  } else {
    // 破棄して終了: 最後に保存した状態に戻す
    if ( menu.id ) {
      axios.get(`/api/menu/${menu.id}`).then((result) => {
        menu = deserializeMenu(result.data.menu);
        widgets = menu.widgets;
        savedSnapshot = JSON.stringify(serializeMenu());
        reload += 1;
        isEditMode = false;
      });
    } else {
      // 未保存の新規ページ。そのまま抜ける（残っても保存はされない）
      isEditMode = false;
    }
  }
};

const save = (event) => {  console.log('save');
  console.log(JSON.stringify(menu.widgets));
  try {
    let pr;
    let create = false;
    let _menu = serializeMenu();
    if	( _menu.id )	{
      _menu.id = parseInt(_menu.id);
      pr = axios.put('/api/menu', _menu);
    } else {
      create = true;
      pr = axios.post('/api/menu', _menu);
    }
    pr.then((result) => {
      console.log(result);
      if	( !result.data.code )	{
        menu = deserializeMenu(result.data.menu)
        widgets = menu.widgets;
        activateWidgets(widgets, status);
        savedSnapshot = JSON.stringify(serializeMenu());
        reload += 1; // ★ これで通知
      }
      tableBus.emit('menuUpdated');
      menuBus.emit('menuUpdated');
      if	( create )	{
        window.history.replaceState(
          { page: `/menu/${menu.id}` }, "", `/menu/${menu.id}`);
      }
      // 保存＝確定。実行モードへ戻る
      isEditMode = false;
    })
  } catch(e) {
		console.log(e);
  }
}

// マイページの読み込み。$リアクティブブロックとbeforeUpdateの
// 両方から呼ばれていた二重fetchを整理（スナップショットはここで取る）
const loadMenu = (id) => {
  widgets = [];
  axios.get(`/api/menu/${id}`).then((result) => {
    menu = deserializeMenu(result.data.menu);
    widgets = menu.widgets;
    // activate による options への値設定（href等）が済んでから
    // スナップショットを取らないと、何も変更しなくても
    // 「未保存」と誤検知する
    activateWidgets(widgets, status);
    savedSnapshot = JSON.stringify(serializeMenu());
    reload += 1; // ★ これで通知
  }).catch((e) => {
    console.log('menu fetch failed:', e?.message, e?.response?.status);
  });
};

$: {
  let args = location.pathname.split('/');
	if	( args[2] === 'new')	{
		status.state = args[2];
    tick().then(() => {
    	let value = $currentMenu;
    	console.log({value});
    	currentMenu.set(null);
    	if  ( value ) {
      	menu = value;
      	widgets = value.widgets;
        isEditMode = true;
        savedSnapshot = ''; // 新規未保存
      	reload += 1; // ★ これで通知
    	}
    });
  } else {
    if	( numeric(args[2]) )	{
      if  ( arg2 !== args[2] ) {
        arg2 = args[2];
        loadMenu(args[2]);
      }
  	}
  }
}

beforeUpdate(() => {
  let args = location.pathname.split('/');
  if	( numeric(args[2]) )	{
    if  ( arg2 !== args[2] ) {
      arg2 = args[2];
      loadMenu(args[2]);
    }
  }
})

// 最後に保存した状態のスナップショット。編集を終えるときの
// 未保存変更の検出に使う
let savedSnapshot = '';

onMount(() => {
  console.log('menu onMount');
  menu = null;
  widgets = [];
})

onDestroy(() => {
  pageTitleDetail.set(null);
})
</script>