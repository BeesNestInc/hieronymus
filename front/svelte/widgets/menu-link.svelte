<script context="module">
import entries from '../../../config/module-list.js';

// module-list の name → エントリ。submenu配下の名前（bank-ledger等）も
// 検索する（会計メニュー等のテンプレートがsubmenu配下のnameを参照するため）。
// 見つからない場合は null を返す（呼び出し側で無害化する）
export const findEntryByName = (name) => {
  for ( const ent of entries ) {
    if ( ent.name === name ) {
      return ent;
    }
    for ( const sub of ( ent.submenu || [] ) ) {
      if ( sub.name === name ) {
        return { ...sub, icon: ent.icon, submenu: undefined };
      }
    }
  }
  return null;
};

export const create = (option, status) => {
  const entry = findEntryByName(option.name);
  if ( !entry ) {
    return { title: option.name || '', name: option.name, href: '/' + option.name };
  }
  const options = {};
  options.title = entry.title;
  options.name = entry.name;
  options.image = entry.image;
  options.href = entry.href(status);
  options.authority = entry.authority;
  options.description = entry.description;

  return	(options);
};

export const activate = (options, status) => {
  const entry = findEntryByName(options.name);
  if ( !entry ) {
    return;
  }
  options.authority = entry.authority;
  options.href = entry.href(status);
};
</script>

<HTMLPanel
	bind:status={status}
  bind:options={options}/>
<script>
import HTMLPanel from './html-panel.svelte';
export let status;
export let options;

</script>
