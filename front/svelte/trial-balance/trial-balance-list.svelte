<div class="row full-height">
  <table class="table table-bordered">
    <thead>
      <tr>
        <th scope="col" style="width: 100px;">
          勘定科目
        </th>
        <th scope="col" style="width: 100px;">
          繰越金額
        </th>
        <th scope="col" style="width: 100px;">
          借方金額
        </th>
        <th scope="col" style="width: 100px;">
          貸方金額
        </th>
        <th scope="col" style="width: 100px;">
          残高
        </th>
      </tr>
    </thead>
    <tbody>
      {#each lines as line, index }
      <tr>
        <td>
          {#if (line.code)}
          <button type="button" class="btn btn-link"
          	on:click={() => {
              link(`/ledger/${status.term}/${line.code}`);
            }}>
            __ {line.name}
          </button>
          {:else}
          <span>{line.name}</span>
          {/if}
        </td>
        <td class="number">
          {line.pickup ? line.pickup.toLocaleString(): '0'}
        </td>
        <td class="number">
          { !!line.debit ? line.debit.toLocaleString(): '0'}
        </td>
        <td class="number">
          { !!line.credit ? line.credit.toLocaleString() : '0'}
        </td>
        <td class="number">
          {line.balance ? line.balance.toLocaleString(): '0'}
        </td>
      </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>

</style>
<script>

export	let status;
export	let	lines;

const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
  console.log({status});
}

</script>
