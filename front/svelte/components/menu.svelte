<div class="row">
  <div class="col-12 d-flex justify-content-between">
    {#if (isEditMode)}
    {/if}
  </div>
</div>
<div class="row" style="padding-bottom:20px;min-height:400px;">
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="grid-stack"
    on:dragover={allowDrop}
    on:drop|preventDefault={dropWidget}>
    {#each widgets as widget (widget.id)}
    {#if ( !widget.options.authority ||
            widget.options.authority(status.user, widget.options))}
    <div class="grid-stack-item"
      gs-id={widget.id}
      gs-x={widget.x}
      gs-y={widget.y}
      gs-w={widget.w}
      gs-h={widget.h}
    >
      <div class="grid-stack-item-content border"
	      draggable="true"
        on:dragstart={(event) => {
          startDrag(event,widget)
        }}
      	>
        <div class="menu-header d-flex align-items-center justify-content-between">
          <div class="flex-grow-1 mt-2 ms-2 d-flex align-items-center text-truncate" style="overflow-x: hidden; white-space: nowrap;">
            {#if (widget.options.favicon)}
            <img src="{widget.options.favicon}" alt="icon" style="width: 20px; height: 20px; margin-right: 6px; flex-shrink: 0;">
            {/if}
            {#if ( !widget.isEditMode)}
            <h5 class="text-truncate">
              {#if ( widget.options)}
              {#if ( widget.options.href )}
              {#if ( isSameOrigin(widget.options.href) )}
              <!-- svelte-ignore a11y-invalid-attribute -->
              <a href="#" class="link"
                on:click|preventDefault={() => {
                  link(widget.options.href);
                }}
              >
                {widget.options.title}
              </a>
              {:else}
              <a href={widget.options.href} class="link" target="_blank">
                {widget.options.title}
              </a>
              {/if}
              {:else}
              {widget.options.title}
              {/if}
              {/if}
            </h5>
            {:else}
            <input type="text" class=""
            style="width:100%;font-size:1.25rem;font-weght:500;margin-top:-5px;margin-left:-5px;margin-bottom:2px;"
            	bind:value={widget.options.title}>
            {/if}
          </div>
          <div class="flex-shrink-0  mt-0" style="width:100px;text-align:right;">
            {#if (isEditMode)}
            {#if (widget.isEditMode)}
            <button type="button" class="btn btn-narrow" on:click={() => {
              widget.isEditMode = !widget.isEditMode;
            }}><i class="bi bi-check"></i></button>
            {:else}
            <button type="button" class="btn btn-narrow" on:click={() => {
              widget.isEditMode = !widget.isEditMode;
            }}><i class="bi bi-pencil"></i></button>
            {/if}
            {/if}
            <button type="button" class="btn btn-narrow"
              on:click={() => {
                widget.minimize = !widget.minimize;
                if	( widget.minimize )	{
                  widget._h = widget.h;
                  widget.h = 5;
                } else {
                  widget.h = widget._h;
                }
              }
            }>
              {#if widget.minimize}
              <i class="bi bi-square"></i>
              {:else}
              <i class="bi bi-dash-square"></i>
              {/if}
            </button>
            {#if isEditMode}
            <button class="btn btn-narrow"
              on:click={() => {
                if	( isEditMode )	{
                  removeWidget(widget.id);
                }
              }
            }><i class="bi bi-x"></i></button>
            {/if}
          </div>
        </div>
        {#if !widget.minimize }
        <svelte:component class="mt-0"
          this={widget._component}
          bind:status={status}
          bind:toast={toast}
          bind:options={widget.options}
        />
        {/if}
      </div>
    </div>
    {/if}
    {/each}
  </div>
</div>
  
<style>
</style>
  
<script>
import { onMount, beforeUpdate, afterUpdate, tick, createEventDispatcher } from "svelte";
import "gridstack/dist/gridstack.min.css";
import { GridStack } from "gridstack";
import { v4 as uuidv4 } from "uuid";
import {findComponent} from '../../javascripts/widget-list.js';
import {isSameOrigin, fetchTitleFromUrl} from '../../javascripts/utils.js';

export let status;
export let toast;
export let widgets;
export let defaultWidgets;
export let reload;
export let isEditMode;

let grid;

const startDrag = (event, widget) => {
  console.log('dragData', widget);
  event.dataTransfer.setData("application/json", JSON.stringify(widget));
  event.dataTransfer.effectAllowed = "copy";
};

const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
}

const allowDrop = (event) => {
  event.preventDefault();
};

const dropWidget = async(event) => {
  if  ( !isEditMode ) return;

  // マウスの位置を取得し、適当な x, y で配置
  const gridRect = event.currentTarget.getBoundingClientRect();
  
  // GridStack のセルサイズを取得
  const cellWidth = grid.cellWidth();
  const cellHeight = grid.getCellHeight(true);
  
  // マウス座標を `x, y` に変換（グリッド内の相対位置）
  const x = Math.floor((event.clientX - gridRect.left) / cellWidth);
  const y = Math.floor((event.clientY - gridRect.top) / cellHeight);

  let href;
  let json;
  let html;
  let files;
  for	( let _type of event.dataTransfer.types )	{
    console.log('type', _type);
    let data = event.dataTransfer.getData(_type);
    switch	(_type)	{
      case	'application/json':
				json = data;
        break;
      case	'text/uri-list':
        href = data;
        break;
      case	'text/html':
        html = data;
        break;
     	case	'Files':
        files = event.dataTransfer.files;
        break;
    }
  }
  console.log('drop', event.dataTransfer)
  console.log('drop', event.dataTransfer.types)
  console.log('drop', event.dataTransfer.items)
  console.log({href});
  console.log({json});
  console.log({html});
  console.log({files})

  let widgetData;
  if	( json )	{
		widgetData = JSON.parse(json);
  }
  if	( widgetData )	{
    // メニューからのdrop
    console.log('menu', widgetData);

    const componentName = widgetData.component;
    const component = findComponent(componentName);

	  let options = widgetData.options || {};
  	if  ( component.create )  {
      options.name ||= widgetData.name;
    	options = await component.create(options, status);
    } else {
      options.title = component.title;
    }
    addWidget(componentName, x, y, component.defaultW, component.defaultH, options);
  } else {
    if	( href )	{
    	console.log('URL', href);
      //	アドレスバーのdrop
      let component = findComponent('Bookmark');
      let options = await component.create({
        href: href
      }, status);
      addWidget(component.name, x, y, component.defaultW, component.defaultH, options);
    }
  }
}
  
// **ウィジェットを追加**
const addWidget = (component, x, y, w, h, options) => {
  console.log('ウィジェット追加', component, x, y, w, h, options);
  let _component = findComponent(component);
  const newId = uuidv4();
  widgets = [...widgets, {
    id: newId,
    x: x,
    y: y,
    w: w,
    h: h,
    minimize: false,
    component,
    _component: _component.component,
    options}
  ];
  console.log('after addWidgets', widgets);
}
  
const initializeGrid = () => {
  if (grid) {
    grid.destroy(false);
    grid = null;
  }
  
  tick().then(() => {
    grid = GridStack.init({
      cellHeight: 10,
      margin: 5,
      draggable: isEditMode,
      resizable: isEditMode,
      float: true,
    });
  
    grid.on("change", () => {
      updateWidgets();
    });
  
    const newItems = grid.getGridItems().filter((el) => !el.gridstackNode);
    newItems.forEach((el) => grid.makeWidget(el));
  
    grid.enableMove(isEditMode);
    grid.enableResize(isEditMode);
  });
}

const initiateWidgets = () => {
  //console.log('initiateWigets')
  for ( let widget of widgets) {
    if	( !widget._component )	{
    	//console.log({widget});
    	let component = findComponent(widget.component);
    	//console.log('activate', component);
    	if  ( component.activate )  {
      	component.activate(widget.options, status);
      	//console.log('widget', widget.options);
    	}
      widget._component = component.component;
    }
  }
  //console.log('initiateWigets end', widgets)
}

onMount(() => {
  console.log("menu onMount");

  initiateWidgets();
  initializeGrid();
  console.log("menu onMount end");
});

let previousReload = -1;
beforeUpdate(() => {
  console.log('menu beforeUpdate', widgets);
  if (reload !== previousReload) {
    console.log('Reloading widgets...');
    previousReload = reload;
    initiateWidgets();
    initializeGrid();
  }
})
afterUpdate(() => {
  if (!grid) return;
  const items = grid.getGridItems();
  const newItems = items.filter((el) => !el.gridstackNode);
  
  if (newItems.length > 0) {
    //console.log("makeWidget for", newItems.length, "items");
    newItems.forEach((el) => grid.makeWidget(el));
  }
  
  if (grid.opts.movable !== isEditMode) grid.enableMove(isEditMode);
  if (grid.opts.resizable !== isEditMode) grid.enableResize(isEditMode);
});
let updatePending = false;
  
const updateWidgets = () => {
  if (updatePending) return;
  updatePending = true;
  
  grid.off("change", updateWidgets);
  
  requestAnimationFrame(() => {
    const newLayout = grid.save();
  
    let changed = false;
  
    const updated = widgets.map((widget) => {
      const found = newLayout.find((item) => item.id === widget.id);
      if (!found) return widget;
  
      const newWidget = {
        ...widget,
        x: found.x,
        y: found.y,
        w: found.w,
        h: found.h ?? widget.h ?? 1, // hが省略されてたら維持
      };
  
      if (
        widget.x !== newWidget.x ||
        widget.y !== newWidget.y ||
        widget.w !== newWidget.w ||
        widget.h !== newWidget.h ) {
        changed = true;
      }
  
      return newWidget;
    });
  
    if (changed) {
      widgets = updated;
    }
  
    updatePending = false;
    grid.on("change", updateWidgets);
  });
};
  
// **ウィジェットの削除**
const removeWidget = (id) => {
  widgets = widgets.filter((widget) => widget.id !== id);
  const widgetElement = document.querySelector(`[gs-id="${id}"]`);
  if (widgetElement) {
    grid.removeWidget(widgetElement);
  }
}
</script>
