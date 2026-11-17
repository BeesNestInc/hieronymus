{#if ( getStore(currentPage) === '/login') }
<Login
  bind:current={status.current}></Login>
{:else if ( getStore(currentPage) === '/signup' ) }
<SignUp></SignUp>
{:else}
<nav class="main-header navbar navbar-expand-lg">
  <NavBar
    status={status}></NavBar>
</nav>
<aside
  class="main-sidebar">
  <SideBar
    bind:status={status}></SideBar>
</aside>
<main class="content-wrapper" class:wide-content={isWide}>
  <div class="container-fluid">
    <div class="content">
      <Alert bind:alert={alert} {alert_level}></Alert>
      <Router {routes} {toast}
        bind:status={status}/>
    </div>
  </div>
</main>
<footer
  class="main-footer">
  <CommonFooter></CommonFooter>
</footer>
<Toast bind:this={toast}/>
<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={operation}
  ></OkModal>
{/if}

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import axios from 'axios';

import NavBar from './common/nav.svelte';
import CommonFooter from './common/footer.svelte';
import SideBar from './common/sidebar.svelte';
import Toast from './common/toast.svelte';
import eventBus from '../javascripts/event-bus.js';

import Alert from './components/alert.svelte';

import Login from './login/login.svelte';
import SignUp from './login/signup.svelte';
import OkModal from './common/ok-modal.svelte';

import Router from './components/router.svelte';
import {currentPage, getStore} from '../javascripts/router.js';
import {buildTitle, pageTitleDetail} from '../javascripts/title.js';
import { getCompanyInfo } from '../../libs/utils.js';
import { pageRoutes } from '../javascripts/pages.js';

export let term;

const routes = pageRoutes;

let toast;
let description;
let title;
let operation;
let modal;

let alert;
let alert_level;
let status = {
  fy: {
    term: term,
    startDate: new Date(),
    endDate: new Date()
  },
  company: {},
  user: {},
  pathname: '',
  current: 'login'
}

let mainCount = 0;
// 全幅で使いたいページ（マッピング等の表がある設定画面）。他は従来の1200px固定
$: isWide = /^\/expense\/(home|unsorted|payee|payment)/.test($currentPage || '');
// タブの<TITLE>を画面に合わせる（タイトル用の新規fetchはしない.
// 会社名は取得済みの status.company、メニュー名は表示用取得済み値を流用）
$: docTitle = buildTitle($currentPage, status.company?.name, $pageTitleDetail);
$: if (typeof document !== 'undefined' && docTitle) { document.title = docTitle; }

let reply;
const doReply = (event) => {
  eventBus.emit(reply, event.detail);
}
// currentPage.set('/home');

onMount(async () => {
  console.log('index onMount');
  status.pathname = location.pathname;
  // currentPage.set(location.pathname);
  const res = await axios.get('/api/user');
  status.user = res.data.user;
  // AIの設定有無。AI前提のボタンを見せない(視覚ノイズを減らす)ために使う
  status.aiAvailable = res.data.aiAvailable;
  status.company = await getCompanyInfo();
  // 年度が未選択（session.term無し）のまま開いた場合は年度情報を取得しない。
  // ナビバーに「年度を設定してください」が出て、そこから選択させる
  if ( term ) {
    axios.get(`/api/term/${term}`).then((res) => {
      let fy = res.data;
      if  ( fy )  {
        status.fy = fy;
        console.log({fy});
        status.fy.startDate = new Date(fy.startDate);
        status.fy.endDate = new Date(fy.endDate);
      } else {
        status.fy = {};
      }
    });
  } else {
    status.fy = {};
  }
  // popstate（戻る/進む）への追従は router.js 側のリスナーが担う
  eventBus.on('okModal', (args) => {
    console.log(args);
    title = args.title;
    description = args.description;
    reply = args.reply;
    operation = doReply;
    modal.show();
  })
})

beforeUpdate(() => {
  let args = location.pathname.split('/');
  //console.log('index beforeUpdate', args);
  //status = status;
  //console.log('index beforeUpdate', {status});
})
afterUpdate(() => {
  console.log('index afterUpdate');
})

</script>
<style>
/* 全幅ページ（設定画面等）。サイドバー分を除いた残りをすべて使う */
.content-wrapper.wide-content {
  width: auto;
}
.content-wrapper.wide-content :global(.content) {
  min-width: 0;
}
</style>
