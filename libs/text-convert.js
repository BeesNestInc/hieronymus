// markdown support
import MarkdownIt from 'markdown-it';
import { full as Emoji } from  "markdown-it-emoji";
import Prism from "markdown-it-prism";
import Attrs from "markdown-it-attrs";
import ReplaceLink from "markdown-it-replace-link";

import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-http";
import "prismjs/components/prism-llvm";
import "prismjs/components/prism-makefile";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-python";
import "prismjs/components/prism-shell-session";


const mdInit = () => {
  let _markdown = new MarkdownIt({
    html:         true,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    linkify:      true,         // autoconvert URL-like texts to links
    typographer:  true,         // Enable smartypants and other sweet transforms
  })
  .use((ReplaceLink), {
    replaceLink: (link) => {
      console.log(link);
      return	`${link}`;
    }
  })
  .use(Emoji)
  .use(Attrs)
  .use(Prism, {
    defaultLanguage: 'clike'
  });

    _markdown.renderer.rules.table_open = () => {
    return '<table class="table table-striped">\n';
  };
	
  return(_markdown);
}

let markdown = mdInit();

const renderMarkdown = (source) => {
  try {
    if	( source )	{
      let html = markdown.render(source);
      return	(html);
    } else {
      return	('');
    }
  } catch(err)	{
    console.log('markdown render error', err);
    console.log(source);
    return	('');
  }
}

export const textConvert = (source, source_format, target_format) => {
    let html;
    //console.log(source_format, ':', target_format)
    if  ( source_format === 'markdown' || source_format === 'text' )   {
        html = renderMarkdown(source);
    } else {
        html = source || ''
    }
    if  ( target_format === 'text' )    {
        return  (html.replaceAll(/<h\d>(.*)<\/h\d>/gms, '$1').replaceAll(/\<(.*?)\>/gms, ''))
    } else {
        return  html;
    }
}

export default textConvert;