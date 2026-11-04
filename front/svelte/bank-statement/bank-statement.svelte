<svelte:window on:beforeunload={saveSettleDraft} />

<div class="page-title d-flex justify-content-between">
  <h1>明細取込</h1>
  <div>
    {#if ( id )}
    <button type="button" class="btn btn-outline-secondary" on:click={goList}>一覧へ戻る</button>
    <button type="button" class="btn btn-outline-secondary me-2" title="この通帳の学習ルール（摘要→相手方仕訳）の閲覧・編集"
      on:click={() => { openRulesModal(); }}>
      学習ルール&nbsp;<i class="bi bi-mortarboard"></i>
    </button>
    {:else}
    <button type="button" class="btn btn-primary" title="明細ファイル（Excel/CSV/通帳PDF/カード明細PDF/計算書）を取り込みます"
      on:click={openModal}>
      取り込む&nbsp;<i class="bi bi-upload"></i>
    </button>
    {/if}
  </div>
</div>

{#if ( id )}
<div class="body">
  {#if ( statement )}
  <div class="mb-1 text-muted d-flex align-items-center">
    <span class="fs-5 text-dark fw-bold me-2">{ ( statement.financial || {}).name || statement.fileName }</span>
    <span>{statement.fileName} / {statement.periodFrom || '?'}〜{statement.periodTo || '?'} / {statement.lines.length}行</span>
    <a class="btn btn-link btn-sm ms-2" href={`/api/bank_statement/file/${statement.id}`}
      download title="取り込んだファイル（通帳の原典）をダウンロードします（申告で「通帳出せ」のときに）">
      <i class="bi bi-download"></i>取得済みファイル
    </a>
    <button type="button" class="btn btn-sm btn-outline-primary ms-2"
      on:click={() => { openModal({ financialId: statement.financialId, kind: statement.kind }); }}>
      取り込む&nbsp;<i class="bi bi-upload"></i>
    </button>
    <button type="button" class="btn btn-sm btn-outline-secondary ms-2"
      on:click={loadDetail} title="最新の状態に更新">
      <i class="bi bi-arrow-clockwise"></i>
    </button>
  </div>
  {#if ( statement.note )}
  <div class="text-muted" style="font-size:0.75rem;">{statement.note.replace(/\n/g, ' / ')}</div>
  {/if}
  {#if ( warnings && warnings.length > 0 )}
  <MessagePanel messages={currentWarnings} title="取込の警告" on:dismiss={dismissWarnings} />
  {/if}
  <div class="d-flex align-items-center mb-2" title="この通帳のメモ（科目管理でどの通帳かの参照を含めて表示する）">
    <label class="me-2" style="font-size:0.85rem;">メモ</label>
    <input type="text" class="form-control form-control-sm me-1" style="width:auto;flex:1;"
      placeholder="この通帳についての書き込み"
      bind:value={statement.memo}>
   <button type="button" class="btn btn-sm btn-outline-primary" title="通帳のメモを保存します"
      on:click={saveAccount}>
      メモを保存
    </button>
  </div>
  <div class="d-flex align-items-center mb-1">
    {#if ( statement.kind !== 'bank' && statement.kind !== 'settlement' )}
    <button type="button" class="btn btn-sm btn-outline-primary me-2" disabled={busy}
      title="金額が一致し日付が近い既存の伝票明細と、この明細を自動で対応付けます"
      on:click={runMatch}>既存仕訳と突合</button>
    <button type="button" class="btn btn-sm btn-primary me-2" disabled={busy || bookTargets.length === 0}
      title="未照合の行から伝票を起票します。相手方は学習ルール→仮入科目（出金仮/入金仮）の順に決まります。手数料などの合流摘要は前の行の伝票に合流します"
      on:click={() => { runBook(); }}>一括起票（対象{bookTargets.length}行 / 未照合{unmatchedCount}行）</button>
    <button type="button" class="btn btn-sm btn-outline-secondary me-2" disabled={busy}
      title="学習ルールを更新したあとに、未承認の起票伝票を解放して作り直します（確定済み伝票には触りません）"
      on:click={runRebook}><i class="bi bi-arrow-repeat me-1"></i>再実行</button>
    {/if}
  </div>
  {#if ( statement.kind !== 'bank' )}
  <div class="mb-1" style="font-size:0.85rem;">
    全{statement.lines.length}行:
    <span class="badge bg-success">照合済 {statusCounts.matched}</span>
    <span class="badge bg-primary">起票済 {statusCounts.booked}</span>
    <span class="badge bg-dark">対象外 {statusCounts.ignored}</span>
    <span class="badge bg-secondary">未照合 {statusCounts.unmatched}</span>
  </div>
  {/if}
  {#if ( statement.kind === 'settlement' && settlement )}
  <div class="card mb-2 settle-panel" style="font-size:0.85rem;">
    <div class="card-body py-2">
      {#if ( settlement.warnings && settlement.warnings.length > 0 )}
      <div class="text-warning mb-1">
        <i class="bi bi-exclamation-triangle me-1"></i>{settlement.warnings.join(' ')}
      </div>
      {/if}
      売上合計 <b>{Number(settlement.saleTotal).toLocaleString()}</b>円 ＝
      振込 <b>{Number(settlement.transferAmount || 0).toLocaleString()}</b>円 ＋
      費用合計 <b>{Number(settlement.expenseTotal).toLocaleString()}</b>円
      （伝票日付: {settleDay || '不明'}）
      {#if ( settlementBooked )}
      <span class="badge bg-primary ms-2">起票済み</span>
      {:else}
      <div class="mt-1">
        <div class="row g-1">
          <div class="col-auto">入金先（借方）</div>
          <div class="col-auto"><Account accounts={bankAccounts} bind:code={settleReceivedAccount} bind:sub_code={settleReceivedSubAccount}></Account></div>
          <div class="col-auto">売上高（貸方）</div>
          <div class="col-auto"><Account accounts={oppositeAccounts} bind:code={settleSaleAccount} bind:sub_code={settleSaleSubAccount}></Account></div>
        </div>
        <div class="mt-1">
          {#each ( settlement.suggestions || [] ) as s}
          <div class="row g-1 align-items-center mb-1">
            <div class="col-auto">
              <input type="checkbox" class="form-check-input" bind:checked={settleFeeInclude[s.lineId]}
                on:change={saveSettleDraft}
                title="この行を伝票に載せる（外した行は費用として起票しません。集計行と内訳が両方載る計算書では重複の方を外します）">
            </div>
            <div class="col-auto" style="min-width:280px;">
              {s.label} <b>{Number(s.amount).toLocaleString()}</b>円
              {#if ( s.account )}&nbsp;<span class="badge text-bg-light" style="font-size:0.7rem;" title="学習済みルールの科目">学習</span>{/if}
            </div>
            <div class="col-auto"><Account accounts={oppositeAccounts}
              bind:code={settleFeeAccounts[s.lineId].account}
              bind:sub_code={settleFeeAccounts[s.lineId].subAccount}></Account></div>
            <div class="col-auto">
              {#if ( ( settleFeeAccounts[s.lineId] || {} ).account && !s.account )}
              <button type="button" class="btn btn-sm btn-outline-secondary" style="font-size:0.75rem;"
                title="この摘要（正規化後の完全一致）に、この行の科目を学習ルールとして登録する（起票しなくても保存され、次回取込から反映される）"
                on:click={() => { registerFeeRule(s); }}>ルール登録</button>
              {/if}
            </div>
          </div>
          {/each}
          <div class="mt-1 {settleBalanceOk ? 'text-success' : 'text-danger'}" style="font-weight:600;">
            振込 {Number(settlement.transferAmount || 0).toLocaleString()} + 選択費用 {settleFeeTotal.toLocaleString()} =
            {( Number(settlement.transferAmount || 0) + settleFeeTotal ).toLocaleString()}円
            （売上合計 {Number(settlement.saleTotal).toLocaleString()}円）
            {#if ( settleBalanceOk )}✓ 貸借一致{/if}
          </div>
          {#if ( !settleBalanceOk && settleAdjust !== null )}
          <div class="small text-danger">
            検算が合いません（差額 {settleAdjust}円）。入れ子の集計行
            （Amazon支払明細書の「FBA=納品+在庫保管」など）が重複して載っている場合は、
            重複の方のチェックを外してください。あてはまらない行は外しても構いません。
          </div>
          {/if}
          {#if ( !settleFeesReady && settleMissing.length > 0 )}
          <div class="small text-danger">
            費用行の科目が未指定です: {settleMissing.map((s) => s.label).join(' / ') }。
            学習ルールに無い摘要は、この行の科目を手で選ぶか、学習ルールを登録してください。
          </div>
          {/if}
          {#if ( settlement.transferAmount === null )}
          <div class="small text-danger">振込行を特定できません（AI読取のラベル揺れ。計算書データを確認してください）。</div>
          {/if}
          <div class="text-muted" style="font-size:0.7rem;">
            ※チェック（載せる/外す）と科目の選択はこの取込の作業下書きです（このブラウザに保存され、reload でも消えません）。
            この内容を確定するのが「1伝票にして起票」、摘要と科目の組を確定するのが「ルール登録」です。
            学習ルール一覧（学習ルールダイアログ）にはルールのみ表示されます。
          </div>
          <button type="button" class="btn btn-sm btn-primary mt-1" disabled={busy || !settleFeesReady || !settleBalanceOk}
            title={( busy ) ? '処理中です' :
              ( ( !settleFeesReady || !settleBalanceOk ) ? `押せません: ${settleDisabledReason}` :
                '計算書の内容を1枚の複合伝票（借方: 預金+費用 / 貸方: 売上高）にして、承認待ちで起票します' )}
            on:click={runSettle}><i class="bi bi-sticky me-1"></i>1伝票にして起票</button>
        </div>
      </div>
      {/if}
    </div>
  </div>
  {/if}
  <div class="table-responsive table-scroll" bind:this={tableScrollEl}>
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
          <th style="width:110px;">日付</th>
          <th>摘要</th>
          <th class="number" style="width:110px;">出金</th>
          <th class="number" style="width:110px;">入金</th>
          <th class="number" style="width:110px;">残高</th>
          <th style="width:90px;">区分</th>
          <th style="width:110px;">状態</th>
          <th style="width:110px;">伝票</th>
          {#if ( statement.kind !== 'bank' )}
          <th style="width:180px;">相手方</th>
          <th style="width:90px;"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each statement.lines as line}
        <tr class:matched-row={line.status === 'matched'}>
          <td>{line.date || ''}</td>
          <td>
            {#if ( line.rawDescription )}
            <button type="button" class="btn btn-link btn-sm p-0 text-start"
              title="この摘要の仕分けルールを登録・修正する（同じ摘要は同じ仕分けになります）"
              on:click={() => { openRulesModal(line); }}>
              {line.description || line.rawDescription || ''}
            </button>
            {:else}
            {line.description || ''}
            {/if}
            {#if ( cardSuggestion(line.id) )}
            <div class="text-muted" style="font-size:0.75rem;">
              カード引落候補: {cardSuggestion(line.id).total.toLocaleString()}円（{cardSuggestion(line.id).payDate || '日付不明'}）
            </div>
            {/if}
            {#if ( settlementDeposit(line.id) )}
            <div class="text-muted" style="font-size:0.75rem;">
              {settlementDeposit(line.id).label}: {Number(settlementDeposit(line.id).amount).toLocaleString()}円
              <button type="button" class="btn btn-link btn-sm p-0" style="font-size:0.75rem;"
                disabled={busy}
                title="この入金を計算書の複合伝票の預金明細に紐付けます（新たな伝票は作りません）"
                on:click={() => { linkDeposit(settlementDeposit(line.id)); }}>
                計算書と突合（{settlementDeposit(line.id).slip.month}/{settlementDeposit(line.id).slip.day}-{settlementDeposit(line.id).slip.no}）
              </button>
            </div>
            {/if}
          </td>
          <td class="number">{( ( line.amountOut != null ) ? line.amountOut : ( ( statement.kind !== 'bank' ) ? line.amount : null ) ) != null ? Number(( line.amountOut != null ) ? line.amountOut : line.amount).toLocaleString() : ''}</td>
          <td class="number">{line.amountIn != null ? Number(line.amountIn).toLocaleString() : ''}</td>
          <td class="number">{( statement.kind === 'bank' && line.balance != null ) ? Number(line.balance).toLocaleString() : ''}</td>
          <td>{categoryLabel(line.category)}</td>
          <td>
            {#if ( line.status === 'booked' && !line.crossSlipDetailId )}
            <span class="badge bg-warning" title="紐付伝票が削除されています">伝票消滅</span>
            {:else if ( line.status === 'booked' && line.crossSlipDetailId )}
            {#if ( isTentative(line) )}
            <span class="badge bg-warning" title="仮入科目で起票されています。実科目の伝票（請求書等）を入力すると自動で差し替わります">仮起票</span>
            {:else}
            <span class="badge {statusColor(line.status)}">{statusLabel(line.status)}</span>
            {/if}
            {:else}
            <span class="badge {statusColor(line.status)}">{statusLabel(line.status)}</span>
            {/if}
          </td>
          <td>
            {#if ( line.slip )}
            <button type="button" class="btn btn-link btn-sm p-0"
              on:click={() => { openSlip(line.slip); }}>
              {line.slip.month}/{line.slip.day}-{line.slip.no}
            </button>
            {/if}
          </td>
          {#if ( statement.kind !== 'bank' )}
          <td>
            {#if ( line.status === 'booked' && line.crossSlipDetailId )}
            <span class={ isTentative(line) ? 'text-warning' : 'text-muted' }>{bookedOppositeLabel(line)}</span>
            {:else if ( line._oppositeLabel )}
            <span class="text-info"><i class="bi bi-mortarboard-fill me-1" title="学習済みのルールから起票します"></i>{line._oppositeLabel}</span>
            {/if}
          </td>
          <td style="white-space:nowrap;">
            {#if ( canBookLine(line) )}
            <button type="button" class="btn btn-sm btn-outline-primary" title="この明細だけで伝票を起票します（伝票画面に移動します）"
              on:click={() => { bookLine(line); }}><i class="bi bi-pencil-square"></i></button>
            {/if}
            {#if ( line.status === 'unmatched' && statement.kind !== 'settlement' )}
            <button type="button" class="btn btn-sm btn-outline-secondary" title="この行を起票対象から外します（対象外）"
              on:click={() => { setIgnored(line, true); }}><i class="bi bi-slash-circle"></i></button>
            {:else if ( line.status === 'ignored' || ( line.status === 'booked' && !line.crossSlipDetailId ) )}
            <button type="button" class="btn btn-sm btn-outline-secondary" title="対象外を解除して未照合に戻します"
              on:click={() => { restoreLine(line); }}><i class="bi bi-arrow-counterclockwise"></i></button>
            {/if}
          </td>
          {/if}
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</div>
{:else}
<div class="body">
  <div class="d-flex align-items-center mb-2">
    <button type="button" class="btn btn-outline-primary btn-sm me-2"
      on:click={() => { openFinancialModal(null); }}>
      ＋通帳を追加&nbsp;<i class="bi bi-plus-lg"></i>
    </button>
    <div class="form-check form-check-inline me-2">
      <input type="checkbox" class="form-check-input" id="showClosed"
        bind:checked={showClosedFinancials} on:change={loadList}>
      <label class="form-check-label" style="font-size:0.85rem;" for="showClosed">「もう使わない」通帳も表示</label>
    </div>
  </div>
  <div class="table-responsive table-scroll">
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
          <th style="width:110px;">種別</th>
          <th>通帳 / ファイル</th>
          <th style="width:220px;">期間</th>
          <th class="number" style="width:90px;">行数</th>
          <th style="width:60px;"></th>
        </tr>
      </thead>
      <tbody>
        {#each statements as row}
        <tr>
          <td>{kindLabel(row.kind)}</td>
          <td>
            {#if ( row.statementId )}
            <a class="btn btn-link p-0" href={`/bank-statement/${row.statementId}`}
              on:click|preventDefault={() => { routerLink(`/bank-statement/${row.statementId}`); }}>
              {row.name}
            </a>
            <div class="text-muted" style="font-size:0.75rem;">{row.fileName}</div>
            {:else}
            <span class="text-muted">{row.name}</span>
            <span class="badge bg-secondary ms-1">未取込</span>
            {/if}
          </td>
          <td>{row.periodFrom || '—'}〜{row.periodTo || '—'}</td>
          <td class="number">{row.lineCount != null ? row.lineCount : '—'}</td>
          <td class="text-center" style="white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-outline-primary" title="取り込む"
              on:click={() => { openModal({ financialId: row.id, kind: row.kind }); }}>
              <i class="bi bi-upload"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" title="この通帳の学習ルール（摘要→相手方仕訳）の閲覧・編集"
              on:click={() => { openRulesModal(null, row); }}>
              <i class="bi bi-mortarboard"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" title="通帳名・メモ・勘定科目を編集、または「もう使わない」にする"
              on:click={() => { openFinancialModal(row); }}>
              <i class="bi bi-gear"></i>
            </button>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
{/if}

<div class="modal" bind:this={financialModalEl} tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">{ financialEdit.id ? `通帳を編集${ financialEdit.closedAt ? '（停止中）' : '' }` : '通帳を追加' }</h5>
        <button type="button" class="btn-close" on:click={closeFinancialModal}></button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        <div class="row mb-2">
          <label class="col-4 col-form-label">通帳名</label>
          <div class="col-8">
            <input type="text" class="form-control" bind:value={financialEdit.name}
              placeholder="例: 住信SBI、三井住友カード">
          </div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">種別</label>
          <div class="col-8">
            <select class="form-select" bind:value={financialEdit.kind}>
              <option value="bank">銀行通帳</option>
              <option value="corporate_card">法人カード</option>
              <option value="personal_card">個人カード（立替）</option>
              <option value="settlement">計算書（ECモール等）</option>
            </select>
          </div>
        </div>
        {#if ( financialEdit.kind !== 'settlement' )}
        <div class="row mb-2">
          <label class="col-4 col-form-label">勘定科目+補助</label>
          <div class="col-8">
            {#key 'financial-account-' + financialModalKey}
            <Account accounts={financialAccountOptions}
              bind:code={financialEdit.accountCode}
              bind:sub_code={financialEdit.subAccountCode}></Account>
            {/key}
          </div>
        </div>
        {:else}
        <div class="row mb-2">
          <div class="col-12 text-muted" style="font-size:0.8rem;">
            計算書は複合伝票の入金先（預金）を伝票化のときに指定するので、
            勘定科目の登録は不要です。
          </div>
        </div>
        {/if}
        {#if ( financialEdit.kind === 'personal_card' )}
        <div class="row mb-2">
          <label class="col-4 col-form-label">立替者（メンバー）</label>
          <div class="col-8">
            <select class="form-select" bind:value={financialEdit.memberId}>
              <option value="">立替者を選択</option>
              {#each members as member}
              <option value={member.id}>{member.tradingName || member.legalName}</option>
              {/each}
            </select>
          </div>
        </div>
        {/if}
        <div class="row mb-2">
          <label class="col-4 col-form-label">メモ</label>
          <div class="col-8">
            <input type="text" class="form-control" bind:value={financialEdit.memo}
              placeholder="カード番号下4桁や契約メモなど">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        {#if ( financialEdit.id )}
        <button type="button" class="btn btn-outline-danger me-auto"
          title={ financialEdit.statementCount > 0 ?
            '取り込みのある通帳は削除できません。「もう使わない」を使ってください' :
            'この通帳を削除します（取り込み・ルールのない通帳のみ）' }
          disabled={ financialEdit.statementCount > 0 }
          on:click={deleteFinancial}>
          削除
        </button>
        {#if ( financialEdit.closedAt )}
        <button type="button" class="btn btn-outline-primary"
          title="この通帳をもう使う状態に戻します（一覧に戻ります）"
          on:click={reopenFinancial}>
          再開する
        </button>
        {:else}
        <button type="button" class="btn btn-outline-secondary"
          title="この通帳を「もう使わない」にする（一覧からは消えます。削除はしないので再開できます）"
          on:click={closeFinancial}>
          もう使わない
        </button>
        {/if}
        {/if}
        <button type="button" class="btn btn-primary" on:click={saveFinancial}>保存</button>
        <button type="button" class="btn btn-outline-secondary" on:click={closeFinancialModal}>閉じる</button>
      </div>
    </div>
  </div>
</div>

<div class="modal" bind:this={modalEl} tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">{uploadModalTitle}</h5>
        <button type="button" class="btn-close" on:click={closeModal}></button>
      </div>
      <!-- プレビュー+学習+警告で項目が増えるので、モーダル内でスクロールさせる -->
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        {#if ( !form.lockFinancial )}
        <div class="row mb-2">
          <label class="col-4 col-form-label">通帳</label>
          <div class="col-8">
            <select class="form-select" bind:value={form.financialId}>
              <option value="">通帳を選択してください</option>
              {#each financials as fin}
              <option value={fin.id}>{kindLabel(fin.kind)} / {fin.name}</option>
              {/each}
            </select>
          </div>
        </div>
        {/if}
        <div class="row mb-2">
          <label class="col-4 col-form-label">ファイル</label>
          <div class="col-8">
            <input type="file" class="form-control" accept=
              ".xlsx,.csv,image/*,application/pdf"
              on:change={(e) => { form.file = e.target.files[0]; }}>
          </div>
        </div>
        {#if ( preview )}
        <div class="border rounded p-2 mb-2" style="max-height:220px;overflow-y:auto;">
          <div class="text-muted mb-1">
            {preview.lineCount}行 / {preview.periodFrom}〜{preview.periodTo}
          </div>
          <MessagePanel messages={preview.warnings} level="danger" dismissible={false} />
          
          {#each preview.lines.slice(0, 10) as line}
          <div class="d-flex justify-content-between" style="font-size:0.8rem;">
            <span>{line.date || '?'} {line.rawDescription || line.merchant || ''}</span>
            <span>{( line.amountOut || line.amountIn || line.amount ) != null ? ( line.amountOut || line.amountIn || line.amount ).toLocaleString() : ''}</span>
          </div>
          {/each}
          {#if ( preview.lines.length > 10 )}
          <div class="text-muted">…ほか {preview.lines.length - 10}行</div>
          {/if}
        </div>
        {/if}
        {#if ( preview && canDraftProfile )}
        <details class="border rounded p-2 mb-2">
          <summary style="font-size:0.85rem;">この書式を学習する（AIプロファイル。承認すると次回から決定的に読める）</summary>
          <button type="button" class="btn btn-sm btn-outline-info mt-1" disabled={profileBusy}
            title="AIがこの書式のyamlプロファイルを書き、同じファイルでの再解析が一致するか自動検証します"
            on:click={draftProfile}>プロファイルを起草</button>
          {#if ( profileBusy )}
          <span class="text-muted ms-2" style="font-size:0.8rem;">AIで起草中…</span>
          {/if}
          {#if ( profileDraftError )}
          <div class="alert alert-danger py-1 px-2 mt-1" style="font-size:0.8rem;">{profileDraftError}</div>
          {/if}
          {#if ( profileDraft )}
          <div class="mt-1" style="font-size:0.8rem;">
            {#if ( profileDraft.error )}
            <span class="badge bg-warning text-dark">yamlの検証に失敗</span>
            <span class="text-muted">{profileDraft.error}</span>
            {:else if ( profileDraft.note )}
            <span class="badge bg-info">分類プロファイル</span>
            <span class="text-muted">{profileDraft.note}</span>
            {:else if ( profileDraft.agreement )}
              {#if ( profileDraft.agreement.agree )}
              <span class="badge bg-success">検証OK</span>
              <span class="text-muted">プロファイルで再解析した {profileDraft.profileLines}行 = AI読取 {profileDraft.aiLines}行（日付+金額が全行一致）</span>
              {:else}
              <span class="badge bg-warning text-dark">相違あり</span>
              <span class="text-muted">一致 {profileDraft.agreement.matched} / プロファイル{profileDraft.agreement.ofProfile}行 / AI{profileDraft.agreement.ofAi}行（使うかどうかは確認してください）</span>
              {/if}
            {:else}
            <span class="badge bg-warning text-dark">yamlの検証に失敗</span>
            {/if}
          </div>
          <textarea class="form-control mt-1" rows="10" style="font-size:0.75rem;font-family:monospace;"
            bind:value={profileDraft.yaml}></textarea>
          <button type="button" class="btn btn-sm btn-primary mt-1" disabled={profileBusy}
            title="このプロファイルをconfig/banksに保存します（保存前にyamlは検証されます）"
            on:click={saveProfile}>プロファイルを保存</button>
          {/if}
        </details>
        {/if}
        {#if ( formError )}
        <div class="alert alert-danger py-1 px-2">{formError}</div>
        {/if}
        {#if ( busy )}
        <div class="text-muted" style="font-size:0.8rem;">
          <i class="bi bi-hourglass-split me-1"></i>読み取り中…画像取り込みはAIで読取するため、数十秒〜1分ほどかかることがあります。
        </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" on:click={closeModal}>キャンセル</button>
        {#if ( !preview )}
        <button type="button" class="btn btn-primary" disabled={!form.file || busy} on:click={doPreview}>
          {#if ( busy )}読み取り中…{:else}内容確認{/if}
        </button>
        {:else}
        <button type="button" class="btn btn-success" disabled={busy} on:click={doUpload}>
          取り込む
        </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<div class="modal" bind:this={rulesModalEl} tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">学習ルール（摘要 → 相手方仕訳）{#if ( rulesFinancialLabel )}&nbsp;: {rulesFinancialLabel}{/if}</h5>
        <button type="button" class="btn-close" on:click={closeRulesModal}></button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        <div class="text-muted mb-2" style="font-size:0.8rem;">
          摘要の完全一致で照合する。実科目が決わっている仕訳から「隙あらば学習」して蓄積されます。
          この画面から手登録・修正・削除もできます。ルールを変えた後は「再実行」で未承認の起票を作り直せます。
        </div>
        {#if ( originLine )}
        <div class="alert alert-info py-2 px-3 mb-2" style="font-size:0.8rem;">
          {#if ( editingRule )}
          摘要「{activePattern}」には既にルールがあります（修正モード）。変更するとこの摘要の<b>次回起票から</b>すべてに効きます（既に起票済みの伝票には影響しません）。
          {:else}
          摘要「{activePattern}」はこの取込内に <b>{patternMatches.length} 行</b>あります。これらの行を同じ仕分けにするなら、相手方を選んで登録してください（<b>次回起票から</b>すべてに効きます）。
          {/if}
          <table class="table table-sm table-bordered mb-0 mt-1" style="font-size:0.75rem;">
            <thead class="table-light">
              <tr>
                <th style="width:90px;">日付</th>
                <th>摘要（元文）</th>
                <th class="number" style="width:90px;">出金</th>
                <th class="number" style="width:90px;">入金</th>
                <th style="width:90px;">状態</th>
              </tr>
            </thead>
            <tbody>
              {#each patternMatches as l (l.id)}
              <tr>
                <td>{l.date || ''}</td>
                <td>{l.description || l.rawDescription || ''}</td>
                <td class="number">{l.amountOut != null ? Number(l.amountOut).toLocaleString() : ''}</td>
                <td class="number">{l.amountIn != null ? Number(l.amountIn).toLocaleString() : ''}</td>
                <td>{statusLabel(l.status)}</td>
              </tr>
              {/each}
              {#if ( patternMatches.length === 0 )}
              <tr><td colspan="5" class="text-muted">この取込内に一致する行はありません</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
        {/if}
        {#if ( ruleCandidates.length > 0 )}
        <div class="border rounded p-2 mb-2" style="background-color:rgba(25,135,84,0.05);">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span style="font-size:0.85rem;" class="fw-bold">ルール候補（この取り込の摘要から。確認して登録してください）</span>
            <div>
              {#if ( status && status.aiAvailable )}
                {#if ( aiBusy )}
                <span class="text-muted me-2" style="font-size:0.8rem;">AIで候補を作成中…</span>
                {:else}
                <button type="button" class="btn btn-sm btn-outline-info me-1"
                  title="提案のない候補に、AIが売上原価系科目の相手方を付けます（実績のある候補は変えません）"
                  on:click={fillCandidatesByAI}>AIで候補を埋める</button>
                {/if}
              {/if}
              <button type="button" class="btn btn-sm btn-outline-primary"
                title="相手方の提案がある候補をすべて登録します（提案がない候補は手で選んでください）"
                on:click={registerAllCandidates}>すべて登録</button>
            </div>
          </div>
          {#each ruleCandidates as candidate (candidate)}
          <div class="d-flex align-items-center mb-1" style="font-size:0.8rem;">
            <span style="width:40%;" title={candidate.aiReason || ''}>{candidate.pattern}{#if ( candidate.ai )}&nbsp;<span class="badge text-bg-info">AI</span>{/if}</span>
            <span class="me-2" style="width:3em;">{directionLabel(candidate.direction)}</span>
            <span class="me-2 text-muted" style="width:3em;">{candidate.count}行</span>
            <div style="flex:1;">
              <Account accounts={oppositeAccounts}
                bind:code={candidate.suggestAccount}
                bind:sub_code={candidate.suggestSubAccount}></Account>
            </div>
            <button type="button" class="btn btn-sm btn-outline-primary ms-1" title="この候補をルールとして登録します"
              on:click={() => { registerCandidate(candidate); }}>登録</button>
          </div>
          {/each}
        </div>
        {/if}
        {#if ( statement && ruleCandidates.length === 0 )}
        <div class="text-muted mb-2" style="font-size:0.8rem;">
          候補はありません。この取込で登録済みのルールは、下の一覧（{rules.length}件）に載っています。
          ルールを学習済みの行は、計算書パネルで「学習」マークが付きます。
        </div>
        {/if}
        {#if ( !showAllRulesForm ) }
        <button type="button" class="btn btn-sm btn-outline-primary mb-2"
          on:click={() => { showAllRulesForm = true; }}>
          ＋新規ルール
        </button>
        {/if}
        <table class="table table-sm table-striped table-bordered" style="font-size:0.85rem;">
          <thead class="table-light">
            <tr>
              <th>摘要（完全一致）</th>
              <th style="width:70px;">方向</th>
              <th class="text-center" style="width:90px;">合流/突合</th>
              <th style="width:170px;">相手方(借)</th>
              <th style="width:170px;">貸方</th>
              <th class="number" style="width:50px;">使用</th>
              <th style="width:210px;"></th>
            </tr>
          </thead>
          <tbody>
            {#if ( showAllRulesForm )}
            <tr style="background-color:rgba(13,110,253,0.05);">
              <td><input type="text" class="form-control form-control-sm" bind:value={newRule.pattern}
                placeholder="正規化後の摘要（NFKC・空白潰し・完全一致）"></td>
              <td>
                <select class="form-select form-select-sm" bind:value={newRule.direction}
                  title="方向。両方向は入金・出金のどちらにも照合します。出金=借:相手方/貸:貸方欄、入金=借:貸方欄/貸:相手方">
                  <option value="">両方向</option>
                  <option value="out">出金</option>
                  <option value="in">入金</option>
                </select>
              </td>
              <td class="text-center" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など） / 突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                <div class="form-check form-check-inline m-0" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">
                  <input type="checkbox" class="form-check-input" bind:checked={newRule.merge}
                    title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">
                  <label class="form-check-label" style="font-size:0.75rem;" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">合流</label>
                </div>
                <div class="form-check form-check-inline m-0" title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                  <input type="checkbox" class="form-check-input" bind:checked={newRule.match}
                    title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                  <label class="form-check-label" style="font-size:0.75rem;" title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">突合</label>
                </div>
              </td>
              <td>
                {#key 'new-rule-opposite' + ruleModalKey}
                <Account accounts={oppositeAccounts}
                  bind:code={newRule.oppositeAccount}
                  bind:sub_code={newRule.oppositeSubAccount}></Account>
                {/key}
              </td>
              <td>
                {#key 'new-rule-credit' + ruleModalKey}
                <Account accounts={accounts}
                  bind:code={newRule.creditAccount}
                  bind:sub_code={newRule.creditSubAccount}
                  title="貸方の指定（省略=口座の科目）。ここに科目を書くと、このルールは1行で貸借が確定する（キャッシングリボ→短期借入金 等）"></Account>
                {/key}
              </td>
              <td class="text-center">-</td>
              <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-primary" title="ルールだけ保存する（この行には適用しない）"
                  on:click={() => { createRule(false); }}>保存</button>
                {#if ( originLine )}
                <button type="button" class="btn btn-sm btn-primary" disabled={applyButtonDisabled(originLine)}
                  title={applyButtonTitle(originLine)}
                  on:click={() => { createRule(true); }}>適用して保存</button>
                {/if}
              </td>
            </tr>
            {/if}
            {#each rules as rule (rule.id)}
            <tr class:rule-edit-row={ editingRule && editingRule.id === rule.id }>
              <td>
                {#if ( editingRule && editingRule.id === rule.id )}
                <input type="text" class="form-control form-control-sm" bind:value={editingRule.pattern}>
                {:else}
                {rule.pattern}
                {/if}
              </td>
              <td>
                {directionLabel(rule.direction)}
              </td>
              <td class="text-center" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など） / 突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                {#if ( editingRule && editingRule.id === rule.id )}
                <div class="form-check form-check-inline m-0" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">
                  <input type="checkbox" class="form-check-input" bind:checked={editingRule.merge}
                    title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">
                  <label class="form-check-label" style="font-size:0.75rem;" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">合流</label>
                </div>
                <div class="form-check form-check-inline m-0" title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                  <input type="checkbox" class="form-check-input" bind:checked={editingRule.match}
                    title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">
                  <label class="form-check-label" style="font-size:0.75rem;" title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">突合</label>
                </div>
                {:else}
                {#if ( rule.merge )}<span class="badge bg-secondary" style="font-size:0.7rem;" title="合流: この摘要の行は、取込順の直前の行（同じ日）の伝票に明細として合流します（振込の次の行の振込手数料など）">合流</span>{/if}
                {#if ( rule.match )}<span class="badge bg-info text-dark ms-1" style="font-size:0.7rem;" title="突合: この摘要の行は「既存仕訳と突合」と「後の処理」で、自動的に既存の伝票と結び付けてよい摘要です（ホワイトリスト）">突合</span>{/if}
              {/if}
              </td>
              <td>
                {#if ( editingRule && editingRule.id === rule.id )}
                {#key 'edit-rule-opposite-' + rule.id}
                <Account accounts={oppositeAccounts}
                  bind:code={editingRule.oppositeAccount}
                  bind:sub_code={editingRule.oppositeSubAccount}></Account>
                {/key}
                {:else}
                {ruleOppositeLabel(rule)}
                {/if}
              </td>
              <td>
                {#if ( editingRule && editingRule.id === rule.id )}
                  {#key 'edit-rule-credit-' + rule.id}
                  <Account accounts={accounts}
                    bind:code={editingRule.creditAccount}
                    bind:sub_code={editingRule.creditSubAccount}
                    title="貸方の指定（省略=口座の科目）。ここに科目を書くと、このルールは1行で貸借が確定する"></Account>
                  {/key}
                {:else}
                {( rule.creditAccount ) ? accountLabel(rule.creditAccount, rule.creditSubAccount) : ( ( rulesFinancialLabel ) ? rulesFinancialLabel + '（通帳）' : '（通帳科目）' )}
                {/if}
              </td>
              <td class="text-center">{rule.usageCount || 0}</td>
              <td class="text-center" style="white-space:nowrap;">
                {#if ( editingRule && editingRule.id === rule.id )}
                <button type="button" class="btn btn-sm btn-outline-primary" title="ルールだけ保存する（この行には適用しない）"
                  on:click={() => { saveRule(editingRule, false); }}>保存</button>
                {#if ( originLine )}
                <button type="button" class="btn btn-sm btn-primary" disabled={applyButtonDisabled(originLine)}
                  title={applyButtonTitle(originLine)}
                  on:click={() => { saveRule(editingRule, true); }}>適用して保存</button>
                {/if}
                <button type="button" class="btn btn-sm btn-outline-danger" title="このルールを削除する（同じ摘要に不要なものができたとき）"
                  on:click={() => { deleteRule(rule); editingRule = null; }}>削除</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" on:click={() => { editingRule = null; }}>取消</button>
                {:else}
                <button type="button" class="btn btn-sm btn-outline-secondary" title="編集"
                  on:click={() => { editingRule = JSON.parse(JSON.stringify(rule)); }}><i class="bi bi-pencil"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger" title="削除"
                  on:click={() => { deleteRule(rule); }}><i class="bi bi-trash"></i></button>
                {/if}
              </td>
            </tr>
            {/each}
          </tbody>
        </table>
        {#if ( rules.length === 0 )}
        <div class="text-muted">学習ルールはありません。実科目で起票した伝票から自動で学習します。</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" on:click={closeRulesModal}>閉じる</button>
      </div>
    </div>
  </div>
</div>


<style>
  .body {
    height: calc(100vh - 240px);
    display: flex;
    flex-direction: column;
    /* ページ全体はスクロールさせない。上の項目（メモ・計算書パネル）は
       固定表示、**起票データ（明細表）だけがスクロール**する。
       計算書パネルも項目が多いので自分の枠内でスクロールする */
    overflow: hidden;
    padding: 8px;
  }
  /* 計算書の伝票化パネル。費用行が多くても枠内でスクロールする */
  .settle-panel {
    flex-shrink: 0;
    max-height: 45vh;
    overflow-y: auto;
  }
  /* 表だけをスクロールさせ、ヘッダ行は固定する */
  .table-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  /* ヘッダ行の配色は共通スタイル(.table th)に任せる（上書きしない） */
  .table-scroll :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .matched-row td {
    background-color: rgba(25, 135, 84, 0.08);
  }
  .rule-edit-row td {
    background-color: rgba(13, 110, 253, 0.08);
  }
  .modal-header h5 {
    font-size: 1rem;
  }
</style>

<script>
import axios from 'axios';
import {onMount, tick} from 'svelte';
import Modal from 'bootstrap/js/dist/modal';
import {setAccounts} from '../../javascripts/cross-slip';
import {currentPage, link as routerLink} from '../../javascripts/router.js';
import Account from '../cross-slip/account.svelte';
import MessagePanel from '../components/message-panel.svelte';

export let status;
export let toast;

let id = null;
let modalEl;
let modal;
let tableScrollEl;
// 一覧の行は 通帳（Financial）単位。クリックはその通帳の最新取り込へ
let statements = [];   // (/api/financial のvalues。通帳情報+最新取り込サマリ)
let showClosedFinancials = false;   // 「もう使わない」通帳も表示するか
// 取込モーダルの通帳セレクト用（一覧と別に読む。closed排除はしない=未取込も選べる）
let financials = [];
// 通帳モーダル（追加/編集/「もう使わない」）
let financialModalEl;
let financialModal;
let financialEdit = {};
let financialModalKey = 0;
let members = [];
let statement = null;
let accounts = [];
let warnings = [];
let cardSuggestions = [];
let settlementDeposits = [];
let preview = null;
let previewId = null;
// AIプロファイル起草（書式学習。承認制でconfig/banksにyamlを置く）
let profileDraft = null;
let profileDraftError = '';
let profileBusy = false;
// テキスト層のある書式だけがプロファイル化できる（画像は対象外）
$: canDraftProfile = ( status && status.user.accounting && status.aiAvailable &&
  form.file && /^(application\/pdf|application\/vnd\.openxmlformats|text\/csv|text\/plain|application\/vnd\.ms-excel)/.test(form.file.type || '') );
let formError = '';
let busy = false;
let form = {};
// 学習ルール
let rulesModalEl;
// 検索式科目入力(Accountコンポーネント)をモーダルを開くたびに
// プリセット値で初期化し直すためのキー
let ruleModalKey = 0;
let rulesModal;
let rules = [];
let editingRule = null;
let showAllRulesForm = false;
let newRule = {};
// ルール候補（承認制: この取り込の未ルール摘要+過去実績からの相手方提案）
let ruleCandidates = [];
// AI提案（明示ボタンで発火。実績提案のある候補は変えない）
let aiBusy = false;


// 仮入科目（x9xxxxx）
const TEMP_ACCOUNT_CODES = [ '1900000', '3900000' ];

const KIND_LABELS = {
  bank: '通帳',
  corporate_card: 'カード',
  personal_card: '個人カード',
  settlement: '計算書'
};
const CATEGORY_LABELS = {
  normal: '', interest: '利息', fee: '手数料', card_payment: 'デビット',
  transfer: '振替', tax: '税', other: 'その他'
};
const STATUS_LABELS = {
  unmatched: '未照合', matched: '照合済', booked: '起票済',
  ignored: '対象外', selected: '精算書へ'
};
const STATUS_COLORS = {
  unmatched: 'bg-secondary', matched: 'bg-success', booked: 'bg-primary',
  ignored: 'bg-dark', selected: 'bg-info'
};

const kindLabel = (kind) => ( KIND_LABELS[ kind ] || kind );
const categoryLabel = (category) => ( CATEGORY_LABELS[ category ] || category );
const statusLabel = (status) => ( STATUS_LABELS[ status ] || status );
const statusColor = (status) => ( STATUS_COLORS[ status ] || 'bg-secondary' );

$: bankAccounts = ( accounts || [] ).filter((a) => ( /^101/.test(a.code) ));
$: bankSubAccounts = ( ( bankAccounts.find((a) => ( a.code === form.account )) || {} ).subAccounts || [] );
$: detailSubAccounts = ( statement && statement.kind === 'bank' ) ?
  ( ( bankAccounts.find((a) => ( a.code === statement.account )) || {} ).subAccounts || [] ) : [];

// 相手方仕訳の選択肢（通帳自身の科目と仮入科目は相手にしない）
$: oppositeAccounts = ( accounts || [] ).filter((a) => ( !/^101/.test(a.code) && a.code !== '1900000' && a.code !== '3900000' ));

// 学習ルールモーダルの「同じ摘要になる行」リスト（勢いでの間違い登録防止）。
// 編集フォームのpatternに反応する
$: activePattern = editingRule ? normPattern(editingRule.pattern) : normPattern(newRule.pattern);
$: activeDirection = editingRule ? ( editingRule.direction || '' ) : ( ( newRule && newRule.direction ) || '' );
// 表示と適用の範囲は「方向も一致する行」。入金と出金では相手方が
// 別ルールなので、出金ルールなら出金行だけが候補になる
$: patternMatches = ( originLine && statement && statement.lines && activePattern ) ?
  statement.lines.filter((l) => (
    ( normPattern(l.rawDescription) === activePattern ) &&
    ( ( !activeDirection ) || ( lineDirection(l) === activeDirection ) )
  )) : [];

// 未照合行数（起票対象の内訳表示用）
$: unmatchedCount = ( statement && statement.lines ) ?
  statement.lines.filter((line) => ( line.status === 'unmatched' )).length : 0;

// 状態の内訳（ヘッダ表示用）
$: statusCounts = ( statement && statement.lines ) ? {
  matched: statement.lines.filter((l) => ( l.status === 'matched' )).length,
  booked: statement.lines.filter((l) => ( l.status === 'booked' && l.crossSlipDetailId )).length,
  ignored: statement.lines.filter((l) => ( l.status === 'ignored' )).length,
  unmatched: statement.lines.filter((l) => ( l.status === 'unmatched' )).length
} : { matched: 0, booked: 0, ignored: 0, unmatched: 0 };

// 一括起票の対象行（未照合、または伝票消滅で迷子になった起票済み行。
// 相手方の決定はルール→仮入科目に落ちるので全行が対象になる）
$: bookTargets = ( statement && statement.lines ) ?
  statement.lines.filter((line) => {
    if ( line.status === 'booked' ) {
      return !line.crossSlipDetailId;
    }
    return line.status === 'unmatched';
  }) : [];

// 起票済み行が仮入科目（出金仮/入金仮）か
const isTentative = (line) => {
  const d = line.crossSlipDetail;
  if ( !d ) {
    return false;
  }
  return ( d.debitAccount === '1900000' ) || ( d.creditAccount === '3900000' );
};

const cardSuggestion = (lineId) => {
  return cardSuggestions.find((s) => ( s.lineId === lineId )) || null;
};

// 通帳の入金行と計算書複合伝票の紐付け候補（Amazon振込等）。
// 金額一致+日付±3日。押すと預金明細に紐付く（起票はしない）
const settlementDeposit = (lineId) => {
  return settlementDeposits.find((s) => ( s.lineId === lineId )) || null;
};
const linkDeposit = async (suggestion) => {
  if ( !suggestion ) {
    return;
  }
  if ( !window.confirm(`この入金を「${suggestion.label}」の伝票（${suggestion.slip.month}/${suggestion.slip.day}-${suggestion.slip.no}）の預金明細に紐付けます。よろしいですか？`) ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/link_settlement`, {
      lineId: suggestion.lineId,
      crossSlipDetailId: suggestion.crossSlipDetailId
    });
    if ( result.data && result.data.code === 0 ) {
      statement = Object.assign({}, statement, { lines: result.data.lines });
      settlementDeposits = result.data.suggestions || [];
      line = statement.lines.find((l) => ( l.id === suggestion.lineId )) || line;
      toast.show('通帳', '計算書の伝票に紐付けました（照合済）');
    } else {
      toast.show('通帳', `紐付けに失敗しました（code=${result.data.code}）`, 'warning');
    }
  } catch (e) {
    console.error('linkDeposit failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `紐付けに失敗しました${status}`;
    toast.show('通帳', message, 'warning');
  } finally {
    busy = false;
  }
};

const goList = () => {
  routerLink('/bank-statement');
};

const loadList = async () => {
  const result = await axios.get(`/api/financial${ showClosedFinancials ? '?closed=1' : '' }`);
  statements = ( result.data && result.data.values ) || [];
};
// 通帳セレクト用。全使用中の通帳
const loadFinancials = async () => {
  const result = await axios.get('/api/financial');
  financials = ( result.data && result.data.values ) || [];
};
// メンバー一覧（個人カードの立替者選択用）
const loadMembers = async () => {
  try {
    const result = await axios.get('/api/member');
    members = ( result.data && result.data.values ) || [];
  } catch (e) {
    console.error('load members failed', e);
    members = [];
  }
};
const openFinancialModal = async (row) => {
  financialModalKey += 1;
  financialEdit = row ? {
    id: row.id,
    name: row.name,
    kind: row.kind,
    accountCode: row.accountCode,
    subAccountCode: ( row.subAccountCode ) ? String(row.subAccountCode) : '',
    memberId: row.memberId || '',
    memo: row.memo || '',
    closedAt: row.closedAt || null,
    statementCount: row.statementCount || 0
  } : { name: '', kind: 'bank', accountCode: '', subAccountCode: '', memberId: '', memo: '', closedAt: null, statementCount: 0 };
  await loadMembers();
  if ( !financialModal ) {
    financialModal = new Modal(financialModalEl);
  }
  financialModal.show();
};
const closeFinancialModal = () => {
  financialModal?.hide();
};
const saveFinancial = async () => {
  if ( !financialEdit.name ) {
    toast.show('通帳', '通帳名を入力してください', 'warning');
    return;
  }
  const body = {
    name: financialEdit.name,
    kind: financialEdit.kind,
    // 計算書の通帳は勘定科目を持たない（金の動きは銀行通帳側で済んでいる。
    // 入金先は伝票化のときに指定する）
    accountCode: ( financialEdit.kind === 'settlement' ) ? null : financialEdit.accountCode,
    subAccountCode: ( financialEdit.kind === 'settlement' ) ? null : ( financialEdit.subAccountCode || null ),
    memberId: financialEdit.memberId || null,
    memo: financialEdit.memo || null
  };
  try {
    if ( financialEdit.id ) {
      await axios.put(`/api/financial/${financialEdit.id}`, body);
      toast.show('通帳', '通帳を更新しました');
    } else {
      await axios.post('/api/financial', body);
      toast.show('通帳', '通帳を追加しました');
    }
    closeFinancialModal();
    loadList();
  } catch (e) {
    console.error('save financial failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '保存に失敗しました';
    toast.show('通帳', message, 'warning');
  }
};
// 通帳の削除（取り込み・ルールのない通帳のみ。サーバ側でも検証される）
const deleteFinancial = async () => {
  if ( !window.confirm('この通帳を削除しますか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/financial/${financialEdit.id}`);
    closeFinancialModal();
    loadList();
    toast.show('通帳', '通帳を削除しました');
  } catch (e) {
    console.error('delete financial failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '削除に失敗しました';
    toast.show('通帳', message, 'warning');
  }
};

// 「もう使わない」からの復活（再開）。closedAtをnullに戻す
const reopenFinancial = async () => {
  try {
    await axios.put(`/api/financial/${financialEdit.id}`, { closed: false });
    closeFinancialModal();
    loadList();
    toast.show('通帳', '通帳を再開しました');
  } catch (e) {
    console.error('reopen financial failed', e);
    toast.show('通帳', ( e.response && e.response.data && e.response.data.message ) || '失敗しました', 'warning');
  }
};

// 「もう使わない」。closedAtで非活性化（一行列挙から消える。削除はしない）
const closeFinancial = async () => {
  if ( !window.confirm('この通帳を「もう使わない」にします。よろしいですか？') ) {
    return;
  }
  try {
    await axios.put(`/api/financial/${financialEdit.id}`, { closed: true });
    closeFinancialModal();
    loadList();
    toast.show('通帳', '「もう使わない」にしました');
  } catch (e) {
    console.error('close financial failed', e);
    toast.show('通帳', ( e.response && e.response.data && e.response.data.message ) || '失敗しました', 'warning');
  }
};

// 詳細画面のスクロール位置。伝票を開いて戻ってきたときに復元する
// （sessionStorageに入れるのでフルリロードしても生きる）
const SCROLL_KEY = 'bank-statement-scroll';
const saveScroll = () => {
  if ( tableScrollEl && id ) {
    sessionStorage.setItem(SCROLL_KEY, String(tableScrollEl.scrollTop));
  }
};
const restoreScroll = async () => {
  const pos = sessionStorage.getItem(SCROLL_KEY);
  if ( pos === null ) {
    return;
  }
  sessionStorage.removeItem(SCROLL_KEY);
  await tick();
  if ( tableScrollEl ) {
    tableScrollEl.scrollTop = parseInt(pos);
  }
};

// 科目コード→「名前/補助名」のラベル
const accountLabel = (code, subCode) => {
  if ( !code ) {
    return '';
  }
  const account = ( accounts || [] ).find((a) => ( a.code === code ));
  const sub = subCode ? ( ( ( account || {} ).subAccounts || [] ).find((s) => ( s.code === subCode )) || {} ) : {};
  return ( account ? account.name : code ) + ( sub.name ? `/${sub.name}` : '' );
};

// 学習ルールの提案（表示用）。相手方は起票時にサーバ側で決まる（ルール→仮）
const applyOppositeSuggestions = (suggestions) => {
  for ( const line of ( statement && statement.lines ) || [] ) {
    line._oppositeLabel = '';
    if ( line.status !== 'unmatched' ) continue;
    const s = ( suggestions || [] ).find((sug) => ( sug.lineId === line.id ));
    if ( s && s.learned ) {
      line._oppositeLabel = accountLabel(s.oppositeAccount, s.oppositeSubAccount);
      line._oppositeAccount = s.oppositeAccount;
      line._oppositeSubAccount = s.oppositeSubAccount;
    }
  }
};

// 警告ブロックの閉じる（×）。内容が消化済み（重複スキップ等の通帳を
// 知らせるだけの物）のときに、ずっと出たままにしない
const dismissWarnings = async () => {
  warnings = [];
  try {
    await axios.put(`/api/bank_statement/${id}`, {
      account: statement.account,
      subAccount: statement.subAccount,
      memo: ( statement.memo === undefined ) ? null : statement.memo,
      warnings: []
    });
  } catch (e) {
    // 端末ごとの表示は消えている。永続だけ失敗した場合は次回再表示される
    console.error('dismiss warnings failed', e);
  }
};

const loadDetail = async (statementId) => {
  const result = await axios.get(`/api/bank_statement/${statementId}`);
  statement = ( result.data && result.data.statement ) || null;
  // 警告は取込に保存されている（残高整合・重複スキップ・追加取込の結果等）
  warnings = ( statement && Array.isArray(statement.warnings) ) ? statement.warnings : [];
  cardSuggestions = [];
  settlementDeposits = result.data.settlementDeposits || [];
  applyOppositeSuggestions(result.data.oppositeSuggestions);
  applySettlement(result.data.settlement);
  await restoreScroll();
};

// 伝票を開く（戻り先はこの画面。スクロール位置を保存してから遷移する）
const openSlip = (slip) => {
  saveScroll();
  routerLink(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${encodeURIComponent('/bank-statement/' + id)}`);
};

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  id = args[2] ? parseInt(args[2]) : null;
  if ( id ) {
    loadDetail(id);
  } else {
    statement = null;
    loadList();
  }
};

onMount(async () => {
  modal = new Modal(modalEl);
  const accs = await axios.get('/api/accounts');
  accounts = Array.isArray(accs.data) ? accs.data : ( accs.data.values || [] );
  // 伝票と同じ科目検索（account.svelte）はこの共通リストを使う
  setAccounts(accounts);
  checkPage();
});

$: checkPage($currentPage);

// モーダルはBootstrapのModalで制御する（開閉時に状態を戻す）
const openModal = async (prefill = {}) => {
  preview = null;
  previewId = null;
  formError = '';
  form = { kind: prefill.kind || 'bank', financialId: prefill.financialId || '' };
  // 通帳が決まっている（詳細や未取込行からの取込）ときは選択欄を出さない
  form.lockFinancial = Boolean(prefill.financialId);
  await loadFinancials();
  modal?.show();
};
// 取込モーダルのタイトル。通帳が決まっているときは「この通帳に」が分かるよう
// 通帳モーダルの科目候補は全科目（種別での絞り込みはしない。連動先は運用者が選ぶ）
$: financialAccountOptions = accounts;

// 取込モーダルタイトル。選ばれた通帳が見えるように
$: uploadModalTitle = ( form.financialId ) ?
  `「${( financials.find((f) => ( String(f.id) === String(form.financialId) )) || {}).name || ''}」に取り込む` :
  '明細の取り込み';
const closeModal = () => {
  preview = null;
  previewId = null;
  formError = '';
  form = {};
  modal?.hide();
};

const doPreview = async () => {
  if ( !form.financialId ) {
    formError = '通帳を選択してください。';
    return;
  }
  busy = true;
  formError = '';
  try {
    if ( !form.financialId ) {
      formError = '通帳を選択してください。';
      return;
    }
    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('kind', form.kind);
    fd.append('financialId', form.financialId);
    // 取り込む年度。「今処理している年度」=画面で選んでいる年度を使う
    // （暦の今日が属する年度ではない）
    fd.append('fy', status.fy.term);
    const result = await axios.post('/api/bank_statement/preview', fd,
      { 'content-type': 'multipart/form-data' });
    if ( result.data && result.data.code === 0 ) {
      preview = result.data;
      previewId = result.data.previewId;
    } else {
      formError = result.data.message || '読み取りに失敗しました。';
    }
  } catch (e) {
    formError = ( e.response && e.response.data && e.response.data.message ) || '読み取りに失敗しました。';
  } finally {
    busy = false;
  }
};

// AIにプロファイルyamlを起草させる。応答は自動検証（同じファイルでの
// 再解析がAIの読みと一致するか）まで済ませて出す
const draftProfile = async () => {
  if ( !form.file || profileBusy ) {
    return;
  }
  profileBusy = true;
  profileDraftError = '';
  profileDraft = null;
  try {
    const fd = new FormData();
    fd.append('file', form.file);
    if ( previewId ) fd.append('previewId', previewId);
    const result = await axios.post('/api/bank_statement/profile_draft', fd,
      { 'content-type': 'multipart/form-data' });
    profileDraft = ( result.data && result.data.code === 0 ) ? result.data : null;
    if ( !profileDraft ) {
      profileDraftError = ( result.data && result.data.message ) || '起草に失敗しました。';
    } else if ( profileDraft.error ) {
      profileDraftError = profileDraft.error;
    }
  } catch (e) {
    profileDraftError = ( e.response && e.response.data && e.response.data.message ) || '起草に失敗しました。';
  }
  profileBusy = false;
};

// 承認したプロファイルyamlを保存する（次の取り込から決定的に読める）
const saveProfile = async () => {
  if ( !profileDraft || profileBusy ) {
    return;
  }
  profileBusy = true;
  try {
    const result = await axios.put('/api/bank_statement/profile', { yaml: profileDraft.yaml });
    if ( result.data && result.data.code === 0 ) {
      toast.show('明細取込', `プロファイル「${result.data.name}」を保存しました（次回の取込からこの書式は決定的に読めます）`);
    } else {
      toast.show('明細取込', ( result.data && result.data.message ) || '保存に失敗しました', 'warning');
    }
  } catch (e) {
    toast.show('明細取込', ( e.response && e.response.data && e.response.data.message ) || '保存に失敗しました', 'warning');
  }
  profileBusy = false;
};

const doUpload = async () => {
  if ( !form.financialId ) {
    formError = '通帳を選択してください。';
    return;
  }
  busy = true;
  formError = '';
  try {
    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('kind', form.kind);
    fd.append('financialId', form.financialId);
    fd.append('fy', status.fy.term);
    if ( previewId ) fd.append('previewId', previewId);
    const result = await axios.post('/api/bank_statement/upload', fd,
      { 'content-type': 'multipart/form-data' });
    if ( result.data && result.data.code === 0 ) {
      modal?.hide();
      preview = null;
      previewId = null;
      form = {};
      if ( result.data.warnings.length > 0 ) {
        toast.show('明細取込', `取り込みました（警告 ${result.data.warnings.length}件）`, 'warning');
      } else {
        toast.show('明細取込', '取り込みました');
      }
      // この通帳の詳細から取り込んだ場合（同じURLへの追加取り込み）は
      // 画面を再読み込みして結果を見えるようにする（遷移しないと更新されない）
      if ( String(result.data.id) === String(id) ) {
        await loadDetail(id);
      } else {
        routerLink(`/bank-statement/${result.data.id}`);
      }
    } else {
      formError = result.data.message || '取り込みに失敗しました。';
    }
  } catch (e) {
    formError = ( e.response && e.response.data && e.response.data.message ) || '取り込みに失敗しました。';
  } finally {
    busy = false;
  }
};

const runMatch = async () => {
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/match`);
    statement = result.data.statement;
    cardSuggestions = result.data.suggestions || [];
    settlementDeposits = result.data.settlementDeposits || [];
    applyOppositeSuggestions(result.data.oppositeSuggestions);
    toast.show('明細取込', `${result.data.matched}行を突合しました`);
  } catch (e) {
    toast.show('明細取込', '突合に失敗しました', 'warning');
  } finally {
    busy = false;
  }
};

// 行に単独起票できるか（相手方の決定はサーバ側でルール→仮に落ちる）
const canBookLine = (line) => {
  // 計算書（kind: settlement）は1計算書=1伝票なので行単位の起票はしない
  if ( statement.kind === 'settlement' ) {
    return false;
  }
  return ( line.status === 'unmatched' || ( line.status === 'booked' && !line.crossSlipDetailId ) );
};

// 起票済み行の相手方仕訳の表示ラベル（伝票明細から復元する）
const bookedOppositeLabel = (line) => {
  const d = line.crossSlipDetail;
  if ( !d ) return '';
  const code = ( line.amountIn != null ) ? d.creditAccount : d.debitAccount;
  const subCode = ( line.amountIn != null ) ? d.creditSubAccount : d.debitSubAccount;
  return accountLabel(code, subCode);
};

// 指定した明細行だけ起票する（未指定なら未照合行をまとめて）。
// ボタンの on:click からイベントオブジェクトが渡っても配列以外は捨てる
const runBook = async (givenBookings = null) => {
  if ( givenBookings && !Array.isArray(givenBookings) ) {
    givenBookings = null;
  }
  busy = true;
  try {
    // 相手方の決定はサーバ側（学習ルール→仮入科目）。フロントは行IDだけ渡す
    const bookings = givenBookings || [];
    const result = await axios.post(`/api/bank_statement/${id}/book`, { bookings: bookings });
    if ( result.data && result.data.code === 0 ) {
      statement = Object.assign({}, statement, { lines: result.data.lines });
      // 起票済みの行はカード引落候補の表示対象から外す
      const bookedLineIds = ( statement.lines || [] )
        .filter((l) => ( l.status === 'booked' ))
        .map((l) => l.id);
      cardSuggestions = cardSuggestions.filter((s) => !bookedLineIds.includes(s.lineId));
      settlementDeposits = settlementDeposits.filter((s) => !bookedLineIds.includes(s.lineId));
      // 仮起票の伝票を確認できた分だけ「後の処理」で差し替わる（次回の突合時）
      toast.show('明細取込', `${result.data.slips.length}枚の伝票を起票しました（承認待ち。ルール未命中は仮入科目になります）`);
      // 単行起票のときは、作った伝票の画面へ直接行く（確認・修正・証憑紐付け）
      if ( bookings.length === 1 && result.data.slips.length > 0 ) {
        const slip = result.data.slips[ 0 ];
        routerLink(`/slip/${slip.year}/${slip.month}/${slip.no}?returnTo=${encodeURIComponent('/bank-statement/' + id)}`);
      }
    } else {
      // code≠0はサイレントに来る（権限等）。原因がわかるように表示する
      const detail = result.data ? `（code=${result.data.code}）` : '';
      toast.show('明細取込', `起票に失敗しました${detail}`, 'warning');
    }
  } catch (e) {
    console.error('book failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `起票に失敗しました${status}`;
    toast.show('明細取込', message, 'warning');
  } finally {
    busy = false;
  }
};

// この明細の伝票を作る。「起票」は伝票画面を開く（下書き）で、
// 伝票ができるのは伝票画面の「登録」を押したとき（驚き最小:
// もどるを押したら何も起きない）
const bookLine = (line) => {
  const isOut = ( line.amountOut !== null && line.amountOut !== undefined ) ||
    ( statement.kind !== 'bank' && line.amount != null );
  const amount = ( isOut ) ? ( line.amountOut != null ? line.amountOut : line.amount ) : line.amountIn;
  const dateParts = line.date ? line.date.split('-').map(Number) : [];
  const params = new URLSearchParams({
    year: dateParts[0] || status.fy.startDate.getFullYear(),
    month: dateParts[1] || ( status.fy.startDate.getMonth() + 1 ),
    day: dateParts[2] || '',
    statementLineId: line.id,
    application: line.description || line.rawDescription || '',
    amount: amount || '',
    // もどるは取込の詳細に戻る（仕訳日記帳ではなく）
    returnTo: `/bank-statement/${id}`
  });
  if ( isOut ) {
    params.append('debitAccount', line._oppositeAccount || '');
    params.append('debitSubAccount', line._oppositeSubAccount || '');
    params.append('creditAccount', statement.account || '');
    params.append('creditSubAccount', statement.subAccount || '');
  } else {
    params.append('debitAccount', statement.account || '');
    params.append('debitSubAccount', statement.subAccount || '');
    params.append('creditAccount', line._oppositeAccount || '');
    params.append('creditSubAccount', line._oppositeSubAccount || '');
  }
  saveScroll();
  routerLink(`/slip/new?${params.toString()}`);
};

// 「再実行」。未承認の起票伝票を解放して現行ルールで作り直す
const runRebook = async () => {
  if ( !window.confirm('確定（承認済み）以外の起票伝票を解放して、現行ルールで起票し直します。よろしいですか？') ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/rebook`);
    if ( result.data && result.data.code === 0 ) {
      statement = Object.assign({}, statement, { lines: result.data.lines });
      toast.show('明細取込', `起票済み${result.data.rebooked}行を再起票しました（スキップ${result.data.skipped}行）`);
    } else {
      const detail = result.data ? `（code=${result.data.code}）` : '';
      toast.show('明細取込', `再実行に失敗しました${detail}`, 'warning');
    }
  } catch (e) {
    console.error('rebook failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `再実行に失敗しました${status}`;
    toast.show('明細取込', message, 'warning');
  } finally {
    busy = false;
  }
};

// === 計算書（kind: settlement）の伝票化 UI（1計算書 = 1複合伝票） ===
// 借方: 入金先預金（振込額）+ 費用各行（ここで科目を確定させる） /
// 買方: 売上高（売上側合算）。費用行の科目は学習ルール候補+入力。
// 税は全行0（計算書は税込の合算をそのまま載せる）
let settlement = null;          // GET /:id の settlement（分類集計+科目候補）
let settleDay = '';             // 伝票日付（既定=振込行の日付）
let settleReceivedAccount = '';
let settleReceivedSubAccount = '';
let settleSaleAccount = '';
let settleSaleSubAccount = '';
let settleFeeAccounts = {};     // lineId → {account, subAccount} 費用行の指定
let settleFeeInclude = {};      // lineId → boolean（false=伝票に載せない。入れ子の集計行を外す）

// 集計が使えるときだけパネルを出す（全行起票済みなら済み表示だけにする）
$: settlementBooked = settlement && statement && ( statement.lines || [] ).length > 0 &&
  ( statement.lines ).every((l) => ( l.status === 'booked' ));
// 費用行に科目が全部入ったか（承認制: 空では起票させない）。
// 判定は「伝票に載せる（チェック済み）行」だけでよい。外した行は起票対象外
// なので科目が無くてもよく、これを要求すると外した行で起票ボタンが死ぬ
$: settleFeesReady = ( ( settlement && settlement.suggestions ) || [] )
  .filter((s) => ( settleFeeInclude[ s.lineId ] !== false ))
  .every((s) => (
  ( ( settleFeeAccounts[s.lineId] || {} ).account ) || s.account
));
// 伝票に載せる（=チェックが入っている）費用行のうち科目が未指定のもの。
// 押せない理由を画面に出すため
$: settleMissing = ( ( settlement && settlement.suggestions ) || [] )
  .filter((s) => ( settleFeeInclude[s.lineId] !== false ))
  .filter((s) => !(( settleFeeAccounts[s.lineId] || {} ).account));
// 検算差（振込 + 選択費用 - 売上合計）。0 だけが起票可。
// 伝票化しない費用行（入れ子の集計行等）はチェックを外して差し引く
$: settleAdjust = ( settlement && settlement.transferAmount !== null ) ?
  ( Number(settlement.transferAmount || 0) + settleFeeTotal - Number(settlement.saleTotal) ) : null;
$: settleDisabledReason = ( !settlement ) ? '' :
  ( ( !settleFeesReady ) ?
      `費用行の科目が未指定です（${settleMissing.map((s) => s.label).join(' / ')}）` :
    ( settlement.transferAmount === null ?
        '振込行を特定できません（振込額が分かりません）' :
      ( !settleBalanceOk ?
          `検算が合いません（差額 ${settleAdjust}円）` : '' ) ));
// 費用行の（ルール外の）手選択科目を、その摘要の学習ルールとして即登録する。
// 手選択だけでは起票（settleStatement 内の自動学習）まで保存されないため、
// 起票前に reload すると消える——これが「ルールがあるはずなのに消える」感の
// 正体。ここから登録してあるなら、reload でも settlementPreview が反映する
const registerFeeRule = async (s) => {
  const pick = settleFeeAccounts[s.lineId] || {};
  if ( !pick.account ) {
    toast.show('計算書', '先にこの行の科目を選んでください', 'warning');
    return;
  }
  try {
    const result = await axios.post('/api/bank_statement_rule', {
      financialId: statement.financialId,
      direction: 'out',
      pattern: s.label,
      oppositeAccount: pick.account,
      oppositeSubAccount: pick.subAccount || null
    });
    // 権限不足等は HTTP 200 + code≠0 で返る（例外にならない）ため必ず確認する
    if ( !( result.data && result.data.code === 0 ) ) {
      const message = result.data?.message || `登録に失敗しました（code=${result.data?.code}）`;
      toast.show('計算書', message, 'warning');
      return;
    }
    s.account = pick.account;
    s.subAccount = pick.subAccount || null;
    toast.show('計算書', `「${s.label}」を学習ルールに登録しました（次回取込から自動で反映します）`);
  } catch (e) {
    console.error('register fee rule failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || 'ルール登録に失敗しました';
    toast.show('計算書', message, 'warning');
  }
};
// 計算書パネルの選択状態（対象外チェック・手選択科目）は、この取込の「作業下書き」と
// して sessionStorage に保持する。ページ reload で外したチェックが復活しないように
// するため（ダイアログの学習ルールとは別物。ルールの確定はルール登録/起票で行う）
const settleDraftKey = (sid) =>  `bank-statement-settle-draft-${sid}`;
const loadSettleDraft = (sid) =>  {
  try {
    const raw = sessionStorage.getItem(settleDraftKey(sid));
    return  ( raw ) ? JSON.parse(raw) : null;
  } catch {
    return  null;
  }
};
const saveSettleDraft = () =>  {
  try {
    if  ( !statement || !settlement )  return;
    const picks = {};
    const includes = {};
    for  ( const s of ( settlement.suggestions || [] ) )  {
      const pick = settleFeeAccounts[ s.lineId ] || {};
      picks[ s.lineId ] = { account: pick.account || '', subAccount: pick.subAccount || '' };
      includes[ s.lineId ] = ( settleFeeInclude[ s.lineId ] !== false );
    }
    sessionStorage.setItem(settleDraftKey(statement.id), JSON.stringify({ picks, includes }));
  } catch {}
};
const clearSettleDraft = () =>  {
  try {
    if  ( statement )  sessionStorage.removeItem(settleDraftKey(statement.id));
  } catch {}
};

const applySettlement = (data) => {
  // 手選択の保持: ルール変更の即反映（closing時の取り直し）や reload が
  // 手選択/チェック状態を消さないように、以前の選択を引き継ぐ。
  // 1) 同じページ内の取り直しはメモリ上の状態を優先
  // 2) reload 直後（メモリが空）は sessionStorage の下書きを復元
  // 3) サーバ側からルール付きの候補が来た場合はそちらを最優先
  //  （ルールが登録された行は、ルールの科目に正しい状態として寄せる）
  const hadMemory = ( settleFeeAccounts && Object.keys(settleFeeAccounts).length > 0 ) ||
    ( settleFeeInclude && Object.keys(settleFeeInclude).length > 0 );
  const prevPicks = hadMemory ? settleFeeAccounts : null;
  const prevIncludes = hadMemory ? settleFeeInclude : null;
  const draft = ( !hadMemory && statement ) ? loadSettleDraft(statement.id) : null;
  settlement = data || null;
  settleFeeAccounts = {};
  settleFeeInclude = {};
  if  ( !settlement )  {
    return;
  }
  settleDay = settlement.transferDate || statement.periodFrom || '';
  settleReceivedAccount = ( settlement.received && settlement.received.account ) || '';
  settleReceivedSubAccount = ( settlement.received && settlement.received.subAccount ) || '';
  settleSaleAccount = ( settlement.sale && settlement.sale.account ) || '';
  settleSaleSubAccount = ( settlement.sale && settlement.sale.subAccount ) || '';
  for  ( const s of ( settlement.suggestions || [] ) )  {
    const prevPick = prevPicks ? ( prevPicks[ s.lineId ] || {} ) : {};
    const prevInclude = prevIncludes ? prevIncludes[ s.lineId ] : undefined;
    const draftPick = ( draft && draft.picks ) ? ( draft.picks[ s.lineId ] || {} ) : {};
    const draftInclude = ( draft && draft.includes ) ? draft.includes[ s.lineId ] : undefined;
    settleFeeAccounts[ s.lineId ] = {
      account: s.account || prevPick.account || draftPick.account || '',
      subAccount: ( s.account && s.subAccount === 0 ) ? 0 :
        ( s.account ? ( s.subAccount || '' ) : ( prevPick.subAccount || ( draftPick.subAccount || '' ) ) )
    };
    settleFeeInclude[ s.lineId ] = ( prevInclude !== undefined ) ? prevInclude :
      ( ( draftInclude !== undefined ) ? draftInclude : true );
  }
};
// 選択行での検算（借方 = 振込 + 選択費用 / 貸方 = 売上合計）。
// 集計行と内訳が両方載る計算書（Amazon支払明細書の FBA=納品+在庫 等）では
// 重複の方を外せば合う。合わないものは起票させない
$: settleIncludedFees = ( settlement && settlement.suggestions || [] )
  .filter((s) => settleFeeInclude[s.lineId] !== false);
$: settleFeeTotal = settleIncludedFees.reduce((acc, s) => acc + Number(s.amount || 0), 0);
$: settleBalanceOk = settlement && settlement.transferAmount !== null &&
  ( Number(settlement.transferAmount) + settleFeeTotal ) === Number(settlement.saleTotal);
const runSettle = async () => {
  const missing = ( settlement.suggestions || [] )
    .filter((s) => ( settleFeeInclude[s.lineId] !== false ))
    .filter((s) => !(( settleFeeAccounts[s.lineId] || {} ).account));
  if ( !settleReceivedAccount ) {
    toast.show('計算書', '入金先（借方の預金）の科目を指定してください。', 'warning');
    return;
  }
  if ( !settleSaleAccount ) {
    toast.show('計算書', '売上高（貸方）の科目を指定してください。', 'warning');
    return;
  }
  if ( missing.length > 0 ) {
    toast.show('計算書', `費用行の科目が未指定です（${missing.length}行）。`, 'warning');
    return;
  }
  if ( !window.confirm('計算書を1枚の複合伝票に起票します（承認待ち）。よろしいですか？') ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${id}/settle`, {
      day: settleDay || undefined,
      received: { account: settleReceivedAccount, subAccount: settleReceivedSubAccount || null },
      sale: { account: settleSaleAccount, subAccount: settleSaleSubAccount || null },
      lines: ( settlement.suggestions || [] ).map((s) => ({
        lineId: s.lineId,
        account: ( settleFeeAccounts[s.lineId] || {} ).account,
        subAccount: ( ( settleFeeAccounts[s.lineId] || {} ).subAccount ) || null,
        include: settleFeeInclude[s.lineId] !== false
      }))
    });
    if ( result.data && result.data.code === 0 ) {
      toast.show('計算書', '計算書を複合伝票に起票しました（承認待ち）。通帳の振込行はこの伝票の預金明細と照合できます');
      clearSettleDraft();
      applySettlement(result.data.settlement);
      statement = Object.assign({}, statement, { lines: result.data.lines });
    } else {
      toast.show('計算書', `伝票化に失敗しました（code=${result.data.code}）`, 'warning');
    }
  } catch (e) {
    console.error('settle failed', e);
    const status = ( e.response && e.response.status ) ? ` HTTP${e.response.status}` : '';
    const message = ( e.response && e.response.data && e.response.data.message ) ? `${e.response.data.message}${status}` :
      `伝票化に失敗しました${status}`;
    toast.show('計算書', message, 'warning');
  } finally {
    busy = false;
  }
};

// 行の方向（出金/入金）。同じ摘要でも入金と出金で相手方は別ルール。
// カード系の行は利用額(amount)のみで載るので常に方向=出金
const lineDirection = (line) => (
  ( ( line.amountOut !== null && line.amountOut !== undefined ) ||
    ( ( line.amount !== null && line.amount !== undefined ) ) ) ? 'out' : 'in'
);
const DIRECTION_LABELS = { out: '出金', in: '入金' };
const directionLabel = (direction) => ( direction ? ( DIRECTION_LABELS[ direction ] || direction ) : '両方' );

// 正規化（サーバのmakePatternと同じ。NFKC+空白潰しの完全一致）
const normPattern = (text) => (
  String(text || '').normalize('NFKC').replace(/[\s\u3000]+/g, '')
);

// 学習ルールのモーダル。摘要クリックで開いたときはoriginLine（適用対象行）を
// 覚えておき、「適用して保存」でその行に即反映できるようにする
let originLine = null;
// ルールの対象は「今見ている通帳」1件だけ（モーダル内での通帳の選択・横断はしない。
// 一覧から行のボタンで、詳細から取込の通帳で開く）
let rulesFinancialId = '';
let rulesFinancialLabel = '';
// ルール一覧の読み込み（対象通帳に限定）
const reloadRules = async () => {
  try {
    const result = await axios.get(`/api/bank_statement_rule${ rulesFinancialId ? `?financialId=${rulesFinancialId}` : '' }`);
    rules = ( result.data && result.data.values ) || [];
  } catch (e) {
    console.error('load rules failed', e);
    rules = [];
  }
};

const openRulesModal = async (line = null, financial = null) => {
  originLine = line;
  editingRule = null;
  showAllRulesForm = false;
  ruleModalKey += 1;
  const pattern = line ? normPattern(line.rawDescription) : '';
  // 起票済みの行から開いた場合は、実際に起票されている仕訳明細の
  // 相手方（科目+補助）を既定値にする（手修正の結果がそのまま下地になる。
  // 仮入科目・銀行科目は相手方にならないので、その時は空のまま）
  let oppositeAccount = '';
  let oppositeSubAccount = '';
  // 方向は摘要クリックなら行から。手登録（＋新規ルール）は両方向のままで入力できる
  const direction = line ? lineDirection(line) : '';
  const detail = ( line && line.crossSlipDetail ) ? line.crossSlipDetail : null;
  if ( detail && statement ) {
    let opposite = null;
    const sideAccount = ( statement && statement.account ) || '';
    if ( detail.creditAccount === sideAccount ) {
      // 出金（貸方が通帳）。相手方は借方側
      opposite = { account: detail.debitAccount, sub: detail.debitSubAccount };
    } else if ( detail.debitAccount === sideAccount ) {
      // 入金（借方が通帳）。相手方は貸方側
      opposite = { account: detail.creditAccount, sub: detail.creditSubAccount };
    }
    if ( opposite && opposite.account &&
      ( !TEMP_ACCOUNT_CODES.includes(opposite.account) ) &&
      ( !/^101/.test(opposite.account) ) ) {
      oppositeAccount = opposite.account;
      oppositeSubAccount = opposite.sub ? String(opposite.sub) : '';
    }
  }
  // 対象通帳: 詳細=この取込の通帳、一覧=行の通帳。通帳名と科目は
  // 新規行・貸方の既定値に使う
  rulesFinancialId = ( statement && statement.financialId ) ?
    statement.financialId : ( financial ? financial.id : '' );
  if ( !statement && financial ) {
    await loadFinancials();
  }
  const fin = ( statement && statement.financial ) ||
    ( ( financials || [] ).find((f) => ( String(f.id) === String(rulesFinancialId) )) || null );
  // loadFinancialsは停止中の通帳を含まないので、行から渡された名前を下に使う
  rulesFinancialLabel = fin ? fin.name : ( financial ? financial.name : '' );
  newRule = {
    financialId: rulesFinancialId || '',
    direction: direction,
    pattern: pattern,
    oppositeAccount: oppositeAccount,
    oppositeSubAccount: oppositeSubAccount,
    // 貸方の既定=この通帳の科目（未払金等）。空欄のまま出すと
    // 何が入るか見えないので、既定値を見せておく（変えたければ操作）
    creditAccount: ( fin && fin.accountCode ) || '',
    creditSubAccount: ( fin && fin.subAccountCode != null ) ? String(fin.subAccountCode) : ''
  };
  if ( !rulesModal ) {
    rulesModal = new Modal(rulesModalEl);
  }
  await reloadRules();
  // ルール候補は「学習ルール」ボタンから開いたときだけ（摘要クリックの
  // 登録フローの邪魔になるので）
  ruleCandidates = [];
  if ( !line && statement && statement.financialId ) {
    try {
      const result = await axios.get(`/api/bank_statement_rule/candidates?statementId=${statement.id}`);
      ruleCandidates = ( result.data && result.data.values ) || [];
    } catch (e) {
      console.error('load rule candidates failed', e);
    }
  }
  // 貸方の既定=この通帳の科目（見えているほうが間違いが怖くない）
  if ( fin && newRule && !newRule.creditAccount ) {
    newRule.creditAccount = fin.accountCode;
    newRule.creditSubAccount = ( fin.subAccountCode != null ) ? String(fin.subAccountCode) : '';
  }
  // 完全に同じ摘要+方向のルールが既にあれば「修正」で開く。
  // 方向違い（同じ摘要の入金と出金）は「別物」= 新規登録になる
  if ( line ) {
    const existing = rules.find((r) => (
      String(r.financialId) === String(newRule.financialId) &&
      r.pattern === pattern &&
      ( ( r.direction || '' ) === ( newRule.direction || '' ) )
    )) || rules.find((r) => (
      String(r.financialId) === String(newRule.financialId) &&
      r.pattern === pattern &&
      !r.direction
    ));
    if ( existing ) {
      editingRule = JSON.parse(JSON.stringify(existing));
      // 貸方の指定が無い既存ルールは、この通帳の科目で見せる
      if ( fin && !editingRule.creditAccount ) {
        editingRule.creditAccount = fin.accountCode;
        editingRule.creditSubAccount = ( fin.subAccountCode != null ) ? String(fin.subAccountCode) : '';
      }
    } else {
      showAllRulesForm = true;
    }
  }
  rulesModal.show();
};
// 取込時の検算警告は、費用行の選択（入れ子の集計行を外す等）で解消することが
// ある。現行の選択で検算が合っているなら、検算系の警告の再表示は
// 「合っているのに合わないと言われ続ける」混乱しか生まないので非表示にする
// （残高不一致など他種の警告はそのまま出す）
$: currentWarnings = ( statement && statement.kind === 'settlement' && settlement &&
      settleBalanceOk && settlement.transferAmount !== null && Array.isArray(warnings) ) ?
    warnings.filter((w) => !( /検算が合いません|費用の内訳の合計/.test(String(w)) )) :
    ( Array.isArray(warnings) ? warnings : [] );

// 学習済み提案（相手方表示）と行状態は、ルール変更を反映するために
// 明細取込詳細へ再適用できるようにする。ルールモーダルを閉じた時に使う。
// 対象は銀行明細（oppositeSuggestions）と計算書（settlement の費用行候補
// ——「1伝票にして起票」パネルの科目）の両方。loadDetail は警告等の
// 他 state も差し替えるので、ここでは表示に必要な部分だけ差し替える
// （ユーザーが触れるヘッダ編集を壊さない）
const refreshLineSuggestions = async () => {
  if ( !statement || !id ) {
    return;
  }
  try {
    const result = await axios.get(`/api/bank_statement/${id}`);
    const next = result.data || {};
    statement.lines = ( next.statement && next.statement.lines ) ? next.statement.lines : statement.lines;
    applyOppositeSuggestions(next.oppositeSuggestions);
    if ( statement.kind === 'settlement' && next.settlement ) {
      applySettlement(next.settlement);
    }
  } catch (e) {
    console.error('refresh opposite suggestions failed', e);
  }
};

const closeRulesModal = () => {
  originLine = null;
  rulesModal?.hide();
  // モーダルは data-bs-backdrop=static で、全ての閉じ経路がここを通る。
  // ルール（AI候補の登録を含む）で変わった学習済み提案・行状態を、
  // 元の取込詳細に反映する
  refreshLineSuggestions();
};

const ruleOppositeLabel = (rule) => {
  return accountLabel(rule.oppositeAccount, rule.oppositeSubAccount);
};

// 「適用して保存」の適用先状態。確定済み・精算書由来の伝票には触れない
// （適用ボタンを無効化して、理由をtitleで出す）
const originApplyState = (line) => {
  if ( !line ) {
    return 'none';
  }
  if ( line.status === 'unmatched' ) {
    return 'book';
  }
  if ( line.status === 'booked' && !line.crossSlipDetailId ) {
    return 'book';  // 伝票消滅。起票し直せばいい
  }
  if ( line.status === 'booked' && line.crossSlipDetailId ) {
    const slip = line.slip;
    if ( slip && ( slip.approvedAt || slip.expenseReportId ) ) {
      return 'locked';
    }
    return 'rebook';
  }
  return 'none';
};
// 「適用して保存」。クリックした行だけではなく、表示中の「同摘要の行」の
// うち適用できる行すべてにまとめて適用する（照合済み・確定済み・精算書由来の
// 行は触らない。適用できる行がなければボタンは押せない）
const applyEligibleLines = () => {
  return patternMatches.filter((line) => {
    const state = originApplyState(line);
    return ( state === 'book' || state === 'rebook' );
  });
};
const applyButtonDisabled = (line) => {
  // originLineは宛先ラベル用。適用の可否は同摘要行全体で判断する
  const eligible = applyEligibleLines();
  return ( eligible.length === 0 );
};
const applyButtonTitle = (line) => {
  const eligible = applyEligibleLines();
  if ( eligible.length === 0 ) {
    return '適用できる行がありません（照合済み・確定済みなど）';
  }
  return `保存して、一致する${eligible.length}行すべてにルールを即適用する（照合済み・確定済みの行は触りません）`;
};
const applyRule = async (ruleId = null) => {
  const bookIds = [];
  const rebookIds = [];
  for ( const line of applyEligibleLines() ) {
    const state = originApplyState(line);
    if ( state === 'book' ) {
      bookIds.push(line.id);
    } else if ( state === 'rebook' ) {
      rebookIds.push(line.id);
    }
  }
  if ( bookIds.length > 0 ) {
    await axios.post(`/api/bank_statement/${id}/book`, {
      bookings: bookIds.map((lineId) => ({ lineId: lineId })),
      // usageCountに頼らない: ユーザーが選んだ（いま保存した）ルールを強制適用
      applyRuleId: ruleId
    });
  }
  if ( rebookIds.length > 0 ) {
    // 行単位の再実行（この伝票に紐づく行だけ。他の行・確定済み伝票に触れない）
    await axios.post(`/api/bank_statement/${id}/rebook`, {
      lineIds: rebookIds,
      applyRuleId: ruleId
    });
  }
  loadDetail(id);
  return bookIds.length + rebookIds.length;
};
const createRule = async (apply = false) => {
  try {
    const result = await axios.post('/api/bank_statement_rule', {
      financialId: newRule.financialId || null,
      direction: newRule.direction || null,
      pattern: newRule.pattern,
      oppositeAccount: newRule.oppositeAccount,
      oppositeSubAccount: newRule.oppositeSubAccount || null,
      creditAccount: newRule.creditAccount || null,
      creditSubAccount: newRule.creditSubAccount || null,
      merge: Boolean(newRule.merge),
      match: Boolean(newRule.match)
    });
    newRule = {};
    showAllRulesForm = false;
    let applied = null;
    if ( apply ) {
      applied = await applyRule(result.data.id);
      closeRulesModal();
    }
    await reloadRules();
    toast.show('学習ルール', ( applied !== null ) ? `ルールを登録し、一致する${applied}行に適用しました` : 'ルールを登録しました');
  } catch (e) {
    console.error('create rule failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '登録に失敗しました';
    toast.show('学習ルール', message, 'warning');
  }
};
const saveRule = async (rule, apply = false) => {
  try {
    await axios.put(`/api/bank_statement_rule/${rule.id}`, {
      direction: rule.direction || null,
      pattern: rule.pattern,
      oppositeAccount: rule.oppositeAccount,
      oppositeSubAccount: rule.oppositeSubAccount || null,
      creditAccount: rule.creditAccount || null,
      creditSubAccount: rule.creditSubAccount || null,
      merge: Boolean(rule.merge),
      match: Boolean(rule.match)
    });
    editingRule = null;
    let applied = null;
    if ( apply ) {
      applied = await applyRule(rule.id);
      closeRulesModal();
    }
    await reloadRules();
    toast.show('学習ルール', ( applied !== null ) ? `ルールを更新し、一致する${applied}行に適用しました` : 'ルールを更新しました');
  } catch (e) {
    console.error('save rule failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '更新に失敗しました';
    toast.show('学習ルール', message, 'warning');
  }
};
// 候補をルールとして登録する（承認）。登録後は候補一覧から外す
const registerCandidate = async (candidate) => {
  if ( !candidate.suggestAccount ) {
    toast.show('学習ルール', '相手方を選んでください', 'warning');
    return;
  }
  try {
    const result = await axios.post('/api/bank_statement_rule', {
      financialId: statement.financialId,
      direction: candidate.direction,
      pattern: candidate.pattern,
      oppositeAccount: candidate.suggestAccount,
      oppositeSubAccount: candidate.suggestSubAccount || null
    });
    // 権限不足等は HTTP 200 + code≠0 で返る（例外にならない）ため必ず確認する
    if ( !( result.data && result.data.code === 0 ) ) {
      const message = result.data?.message || `登録に失敗しました（code=${result.data?.code}）`;
      toast.show('学習ルール', message, 'warning');
      return;
    }
    ruleCandidates = ruleCandidates.filter((c) => (
      !( c.pattern === candidate.pattern && c.direction === candidate.direction )
    ));
    await reloadRules();
    toast.show('学習ルール', '候補をルールとして登録しました');
  } catch (e) {
    console.error('register candidate failed', e);
    const message = ( e.response && e.response.data && e.response.data.message ) || '登録に失敗しました';
    toast.show('学習ルール', message, 'warning');
  }
};
// 提案のある候補をすべて登録する（提案がない候補は残る）
// AIで候補の相手方を提案する（明示ボタンで発火。実績のある候補はサーバが変えない）。
// 応答は候補への充填のみ。登録は人が確認して行う
const fillCandidatesByAI = async () => {
  if ( !statement || aiBusy ) {
    return;
  }
  aiBusy = true;
  try {
    const result = await axios.post('/api/bank_statement_rule/ai_candidates', {
      statementId: statement.id
    });
    ruleCandidates = ( result.data && result.data.values ) || [];
    const filled = ruleCandidates.filter((c) => ( c.ai )).length;
    toast.show('学習ルール',
      filled > 0 ?
        `AIが${filled}件の候補に科目を提案しました（確認して登録してください）` :
        'AIの提案はありませんでした（わからない候補は手で選んでください）');
  } catch (e) {
    const message = ( e && e.response && e.response.data && e.response.data.message ) || 'AIで候補を生成できませんでした。';
    toast.show('学習ルール', message, 'warning');
  } finally {
    aiBusy = false;
  }
};

const registerAllCandidates = async () => {
  const withSuggestion = ruleCandidates.filter((c) => ( c.suggestAccount ));
  for ( const candidate of withSuggestion ) {
    await registerCandidate(candidate);
  }
  if ( withSuggestion.length === 0 ) {
    toast.show('学習ルール', '提案のある候補がありません', 'warning');
  }
};

const deleteRule = async (rule) => {
  if ( !window.confirm('このルールを削除しますか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/bank_statement_rule/${rule.id}`);
    rules = rules.filter((r) => ( r.id !== rule.id ));
    toast.show('学習ルール', 'ルールを削除しました');
  } catch (e) {
    console.error('delete rule failed', e);
    toast.show('学習ルール', '削除に失敗しました', 'warning');
  }
};

const setIgnored = async (line, ignored) => {
  await axios.put(`/api/bank_statement/line/${line.id}`, {
    status: ignored ? 'ignored' : 'unmatched'
  });
  loadDetail(id);
};

// 伝票消滅で迷子になった起票済み行を未照合に戻す
const restoreLine = async (line) => {
  await axios.put(`/api/bank_statement/line/${line.id}`, { status: 'unmatched' });
  loadDetail(id);
};

// 通帳のメモ（取り込み時に通帳を指定しなかった分の後付けは/financialの
// 内容で行う。ここはメモのみの保存）
const saveAccount = async () => {
  try {
    await axios.put(`/api/bank_statement/${id}`, {
      memo: ( statement.memo === undefined ) ? null : statement.memo
    });
    toast.show('明細取込', 'メモを保存しました');
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '通帳の設定に失敗しました';
    toast.show('明細取込', message, 'warning');
  }
};

const deleteStatement = async (statement) => {
  if ( !window.confirm('この取込を削除しますか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/bank_statement/${statement.id}`);
    loadList();
  } catch (e) {
    const message = ( e.response && e.response.data && e.response.data.message ) || '削除に失敗しました';
    toast.show('明細取込', message, 'warning');
  }
};
</script>
