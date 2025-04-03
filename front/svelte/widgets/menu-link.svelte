<HTMLPanel
	bind:status={status}
  bind:options={options}/>
<script>
import entries from '../../../config/module-list.js';
import HTMLPanel from './html-panel.svelte';
export let status;
export let options;

</script>
<script context="module">
export const create = (option, status) => {
  let entry = {};
  entry = entries.find((ent) => {
    return	( option.name === ent.name );
  });
  //console.log({entry});
  let options = {};
  options.title = entry.title;
  options.name = entry.name;
  options.image = entry.image;
  options.href = entry.href(status);
  options.authority = entry.authority;
  options.description = entry.description;
  
  return	(options);
}

export const activate = (options, status) => {
  //console.log('activateLink', options);
  let entry = {};
  entry = entries.find((ent) => {
    return	( options.name === ent.name );
  });
  //console.log({entry});
  options.authority = entry.authority;
  options.href = entry.href(status);
}

</script>
