<table class="table table-bordered table-sm">
  <thead class="table-light">
    <tr>
      <th scope="col" class="text-center">月</th>
      {#each header as col}
        <th scope="col" class="text-center">{col.name}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each body as row}
      <tr>
        <td>{row.year}/{String(row.month).padStart(2, '0')}</td>
        {#each header as col}
          <td class="text-end">{(row[col.name] || 0).toLocaleString()}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<script>
  export let header = [];
  export let body = [];
</script>

<style>
  table {
    width: auto; /* テーブルが画面幅いっぱいに広がるのを防ぐ */
  }
  /* 「月」カラムの幅を指定 */
  th:first-child,
  td:first-child {
    width: 7rem;
  }
  /* 金額カラムの幅を指定 */
  th:not(:first-child),
  td:not(:first-child) {
    width: 10rem;
  }
</style>
