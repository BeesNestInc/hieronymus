<div class="brand-container">
  <a href="#" class="brand-link"
    on:click|preventDefault={() => {
      link('/home');
    }}>
      <img src="/public/logo.png" alt="Logo" class="brand-image">
      <span class="brand-text">Hieronymus</span>
  </a>
</div>
<div class="sidebar">
	<nav class="mt-2">
    <ul class="nav nav-pills nav-sidebar flex-column">
      <li class="nav-item">
        <div class="d-flex align-items-center justify-content-between" style="width:240px;">
          <!-- svelte-ignore a11y-missing-attribute -->
          <a class="nav-link">
					  <i class="bi bi-menu-button-wide me-1"></i>
            メニュー
          </a>
          {#if ( isMenuEditMode)}
          <div>
          <button class="btn btn-narrow dropdown-toggle"
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

          <button type="button" class="btn btn-narrow" on:click={menuEditDone}>
            <Icon icon="bi:check" class="text-warning"></Icon></button>
          </div>
          {:else}
          <button type="button" class="btn btn-narrow" on:click={() => {
            isMenuEditMode = true;
          }}><Icon icon="bi:pencil" class="text-warning"></Icon></button>
          {/if}
        </div>
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
      {#each menu as entry}
      {#if ( entry.title && ( !entry.authority || entry.authority(status.user, company) )) }
			<li class="nav-item">
			  <a class={ status.pathname.match(entry.match) ? 'nav-link active': 'nav-link'}
          draggable="true"
          data-type={entry.name}
          on:dragstart={startDrag}
          on:click|preventDefault={() => {
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
          {entry.title}
        </a>
        {#if ( entry.submenu && ( status.pathname.match(entry.match) ) )}
        <ul>
          {#each entry.submenu as subentry}
          <li class="nav-item">
            <a class={ status.pathname.match(subentry.match) ? 'nav-link active': 'nav-link'}
              draggable="true"
              data-type={entry.name}
              on:dragstart={startDrag}
              on:click|preventDefault={() => {
                link(subentry.href(status));
              }}
              href="#">
              {#if subentry.icon}
              {#if ( subentry.icon.name)}
              <Icon class="nav-icon" icon={subentry.icon.name}></Icon>
              {:else}
              <img src={subentry.icon.src} class="icon-img">
              {/if}
              {:else}
              <Icon class="nav-icon" icon="fa6-solid:circle"></Icon>
              {/if}
              {subentry.title}
            </a>
          </li>
          {/each}
        </ul>
        {/if}
			</li>
      {/if}
      {/each}
    </ul>
  </nav>
</div>


<style>
.icon {
  margin-right: 0.5rem;
}
</style>
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher, tick} from 'svelte';
import menu from '../../../config/module-list.js';
import Sortable from 'sortablejs';
import Icon from '@iconify/svelte';
import eventBus from '../../javascripts/event-bus.js';
import {currentMenu, getStore} from '../../javascripts/current-record.js'
import {link} from '../../javascripts/router.js';
import { getCompanyInfo } from '../../../libs/utils.js';

export	let status;
export let mainCount;

let menuItems;
let isMenuEditMode = false;
let menuTemplates = [];
let company;

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
  company = await getCompanyInfo();
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
beforeUpdate(() => {
  //console.log('sidebar beforeUpdate', status);
  status.pathname = location.pathname;
  args = status.pathname.split('/');
  status.current = args[1];

});

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
