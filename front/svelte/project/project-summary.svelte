<div class="container-fluid">
  <div class="page-title d-flex justify-content-between mt-2">
  	<h1>プロジェクト集計</h1>
    <div>
      <button class="btn btn-primary" on:click={downloadCSV} disabled={!summaryBody.length}>CSVダウンロード</button>
    </div>
	</div>

  <div class="row page-subtitle align-items-center">
    <div class="col-md-4">
      <select class="form-select" name="projectId" value={selectedProjectId} on:change={handleChange}>
        <option value={null}>プロジェクトを選択...</option>
        {#each projects as project}
          <option value={project.id}>{project.name}</option>
        {/each}
      </select>
    </div>
    <div class="col-md-auto">
      <input type="month" class="form-control" name="from" value={selectedFrom} on:change={handleChange}>
    </div>
    <div class="col-md-auto">
      〜
    </div>
    <div class="col-md-auto">
      <input type="month" class="form-control" name="to" value={selectedTo} on:change={handleChange}>
    </div>
  </div>

  <hr/>

  {#if summaryBody.length > 0}
    <Line data={chartData} options={{}}/>
    <div class="summary-list-container">
      <ProjectSummaryList header={summaryHeader} body={summaryBody} />
    </div>
  {:else}
    <p>表示するデータがありません。</p>
  {/if}

</div>

<script>
  import axios from 'axios';
  import { onMount } from 'svelte';
  import { currentPage, link } from '../../javascripts/router.js';
  import { Line } from "svelte-chartjs";
  import ProjectSummaryList from './project-summary-list.svelte';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
  } from 'chart.js';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale
  );

  export let status;

  let projects = [];
  let terms = []; // term解決のために必要
  let selectedProjectId = null;
  let selectedFrom = null;
  let selectedTo = null;

  let summaryHeader = [];
  let summaryBody = [];
  let chartData = {};

  const colors = ["#1F497D", "#4F81BD", "#C0504D", "#9BBB59", "#8064A2", "#4BACC6", "#F79646", "#C00000"];

  const formatMonth = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  
  const downloadCSV = () => {
    if (!summaryHeader.length || !summaryBody.length) return;
    const header = ['月', ...summaryHeader.map(h => h.name)];
    const rows = summaryBody.map(row => {
      const yearMonth = `${row.year}/${String(row.month).padStart(2, '0')}`;
      const values = summaryHeader.map(h => row[h.name] || 0);
      return [yearMonth, ...values].join(',');
    });
    const csvContent = [header.join(','), ...rows].join('\n');
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const dlLink = document.createElement('a');
    const url = URL.createObjectURL(blob);
    dlLink.setAttribute('href', url);
    dlLink.setAttribute('download', `project-summary-${selectedProjectId}-${selectedFrom}-${selectedTo}.csv`);
    dlLink.style.visibility = 'hidden';
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
  };

  // --- URL監視 & 状態更新 ---
  $: checkPage($currentPage);

  // --- UIイベントハンドラ ---
  const handleChange = (e) => {
    let newProjectId = selectedProjectId;
    let newFrom = selectedFrom;
    let newTo = selectedTo;

    const value = e.target.value;
    switch (e.target.name) {
      case 'projectId':
        newProjectId = parseInt(value, 10);
        break;
      case 'from':
        newFrom = value;
        break;
      case 'to':
        newTo = value;
        break;
    }

    if (newProjectId && newFrom && newTo) {
      link(`/project/summary/${newProjectId}?from=${newFrom}&to=${newTo}`);
    }
  };

  // --- データ処理 ---
  const updateChart = () => {
    if (!summaryHeader.length || !summaryBody.length) {
      chartData = {};
      return;
    }
    const newChartData = {
      labels: summaryBody.map(row => `${row.year}/${String(row.month).padStart(2, '0')}`),
      datasets: summaryHeader.map((col, index) => ({
        label: col.name,
        fill: false,
        borderColor: colors[index % colors.length],
        data: summaryBody.map(row => row[col.name] || 0)
      }))
    };
    chartData = newChartData;
  };

  const updateSummary = async (projectId, from, to) => {
    if (!projectId || !from || !to) {
      summaryHeader = [];
      summaryBody = [];
      updateChart();
      return;
    }
    try {
      const response = await axios.get(`/api/project-summary/${projectId}?from=${from}&to=${to}`);
      summaryHeader = response.data.header || [];
      summaryBody = response.data.body || [];
      updateChart();
    } catch (err) {
      console.error("集計データの取得に失敗しました:", err);
    }
  };

  // --- URL解釈 & 状態更新 ---
  const checkPage = (page) => {
    if (!page || !page.startsWith('/project/summary')) return;

    const url = new URL(page, location.origin);
    const projectId = parseInt(url.pathname.split('/')[3], 10);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (projectId && from && to) {
      if (selectedProjectId !== projectId || selectedFrom !== from || selectedTo !== to) {
        selectedProjectId = projectId;
        selectedFrom = from;
        selectedTo = to;
        updateSummary(projectId, from, to);
      }
    }
  };

  // --- 初期化 ---
  onMount(async () => {
    await Promise.all([
      axios.get('/api/projects').then(res => { projects = res.data; }),
      axios.get('/api/term').then(res => { terms = res.data; })
    ]);

    const url = new URL(location.href);
    const pathProjectId = parseInt(url.pathname.split('/')[3], 10) || null;
    const queryFrom = url.searchParams.get('from');
    const queryTo = url.searchParams.get('to');

    // URLにprojectIdが含まれていない場合 (メニューから直接来た場合)
    if (!pathProjectId) {
      selectedFrom = formatMonth(status.fy.startDate);
      selectedTo = formatMonth(status.fy.endDate);
      return; // データは読み込まず、選択を促す
    }

    // URLにprojectIdが含まれている場合 (他の画面から来た場合など)
    if (pathProjectId && queryFrom && queryTo) {
      checkPage(location.pathname + location.search);
    } else {
      const projectIdToUse = pathProjectId;
      const fromToUse = queryFrom || formatMonth(status.fy.startDate);
      const toToUse = queryTo || formatMonth(status.fy.endDate);

      if (projectIdToUse) {
        const newUrl = `/project/summary/${projectIdToUse}?from=${fromToUse}&to=${toToUse}`;
        if (location.pathname + location.search !== newUrl) {
          link(newUrl, { replace: true });
        }
      }
    }
  });

</script>