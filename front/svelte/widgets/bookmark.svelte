<HTMLPanel
	bind:status={status}
  bind:options={options}/>
<script>
import entries from '../../../config/module-list.js';
import HTMLPanel from './html-panel.svelte';
import {isSameOrigin, fetchTitleFromUrl} from '../../javascripts/utils.js';
import axios from 'axios';

export let status;
export let options;

</script>
<script context="module">
export const create = async (option, status) => {
  let href = option.href;
  let entry;
  let options = {...option};
  console.log('bookmark', options);
  if	( isSameOrigin(href) )	{
    let url = new URL(href);
    let name = url.pathname.split('/')[1];
  	entry = entries.find((ent) => {
    	return	( name === ent.name );
  	});
	  //console.log({entry});
    options.title ||= await fetchTitleFromUrl(href);
  	options.name ||= entry.name;
  	options.image ||= entry.image;
  	options.authority ||= entry.authority;
  	options.description ||= entry.description;
  } else {
    console.log('外部URL')
    let result = await axios.get('/api/menu/preview', {
      params: {
        url: href
      }
    });
    let preview = result.data;
    options.favicon ||= preview.favicon;
    options.title ||= preview.title;
    options.image ||= preview.image;
    options.description ||= preview.description;
  }
  
  return	(options);
}

export const activate = (options, status) => {
  //console.log('activateLink', options);
  let entry = entries.find((ent) => {
    return	( options.name === ent.name );
  });
  //console.log({entry});
  if	( entry )	{
  	options.authority = entry.authority;
  }
}

</script>
