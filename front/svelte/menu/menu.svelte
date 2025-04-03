<div class="page-title d-flex justify-content-between align-items-center">
  {#if isEditMode}
  <input type="text" class="col-8"
  	bind:value={menu.title}>
  <div>
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
            >
            {entry.title}
        	</button>
        </li>
        {/if}
        {/each}
      </ul>
    </div>
    <button class="btn btn-success" on:click={save}>
      配置を保存
    </button>
    <button class="btn link" on:click={() => {
      isEditMode = !isEditMode;
    }}><i class="bi bi-check"></i>実行モードへ</button>
  </div>
  {:else}
  <h1>{menu?.title}</h1>
  <button class="btn link" on:click={() => {
    isEditMode = !isEditMode;
  }}><i class="bi bi-pencil"></i>編集モードへ</button>
	{/if}
</div>
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
import { onMount, beforeUpdate, tick} from "svelte";
import {currentMenu, getStore} from '../../javascripts/current-record.js'
import {numeric, formatDate} from '../../../libs/utils.js';
import {eventBus as tableBus} from '../../javascripts/table-maintenance.js';
import menuBus from '../../javascripts/event-bus.js';
import {componentList} from '../../javascripts/widget-list.js';

export let status;
export let toast;

let menu;
let widgets = [];
let arg2;
let reload = 0; // ★ これで変更を通知
let isEditMode = false;

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

const save = (event) => {
  console.log('save');
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
        reload += 1; // ★ これで通知
      }
      tableBus.emit('menuUpdated');
      menuBus.emit('menuUpdated');
      if	( create )	{
        window.history.replaceState(
          status, "", `/menu/${menu.id}`);
      }
    })
  } catch(e) {
		console.log(e);
  }
}

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
      	reload += 1; // ★ これで通知
    	}
    });
  } else {
    if	( numeric(args[2]) )	{
      if  ( arg2 !== args[2] ) {
        arg2 = args[2];
        console.log('get');
        widgets = [];
    		axios.get(`/api/menu/${args[2]}`).then((result) => {
          console.log(result.data.menu);
      		menu = deserializeMenu(result.data.menu);
          widgets = menu.widgets;
          reload += 1; // ★ これで通知
      	});
      }
  	}
  }
}

beforeUpdate(() => {
  let args = location.pathname.split('/');
  if	( numeric(args[2]) )	{
    if  ( arg2 !== args[2] ) {
      arg2 = args[2];
      console.log('get');
      widgets = [];
    	axios.get(`/api/menu/${args[2]}`).then((result) => {
        console.log(result.data.menu);
      	menu = deserializeMenu(result.data.menu);
        widgets = menu.widgets;
        reload += 1; // ★ これで通知
      });
    }
  }
})

onMount(() => {
  console.log('menu onMount');
  menu = null;
  widgets = [];
})
</script>