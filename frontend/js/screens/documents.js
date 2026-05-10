export function renderDocumentsScreen(ctx) {
  const { state, $, badge, documentStatusTone, clientById } = ctx;
  const documents = state.cases.flatMap((item) =>
    item.documents.map((doc) => ({
      ...doc,
      caseId: item.id,
      client: clientById(item.clientId).name
    }))
  );

  $("#documents").innerHTML = `
    <div class="panel table-wrap">
      <div class="toolbar"><h2>Документи</h2><button class="primary" data-view-link="cases">+ Додати до справи</button></div>
      <table>
        <thead><tr><th>Документ</th><th>Справа</th><th>Клієнт</th><th>Статус</th><th>Джерело</th></tr></thead>
        <tbody>
          ${documents.map((doc) => `<tr><td>${doc.name}</td><td>№${doc.caseId}</td><td>${doc.client}</td><td>${badge(doc.status, documentStatusTone(doc.status))}</td><td>${doc.source || "CRM"}</td></tr>`).join("") || `<tr><td colspan="5">Документів поки немає</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}
