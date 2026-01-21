document.addEventListener("DOMContentLoaded", () => {
  const BACKEND_URL = "https://shopifyroutes.onrender.com";

  const form = document.getElementById("store-form");
  const resultsContainer = document.getElementById("results-container");
  const reportWrapper = document.getElementById("report-wrapper");
  const reportTitle = document.getElementById("report-title");
  const optionsTitle = document.getElementById("options-title");
  const optionSummary = document.getElementById("option-summary");
  const optionDetails = document.getElementById("option-details");
  const errorReport = document.getElementById("error-report");
  const errorMessage = document.getElementById("error-message");
  const analyzeButton = document.getElementById("analyze-button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const domain = document.getElementById("store-domain").value.trim();
    const clientId = document.getElementById("client-id").value.trim();
    const clientSecret = document.getElementById("client-secret").value.trim();

    if (!domain || !clientId || !clientSecret) {
      alert("Preencha todos os campos de autenticação.");
      return;
    }

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Autenticando...";
    resultsContainer.classList.remove("hidden");
    reportWrapper.classList.add("hidden");
    errorReport.classList.add("hidden");

    try {
      const tokenResponse = await fetch(`${BACKEND_URL}/api/get-shopify-token`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({domain, clientId, clientSecret}),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error);

      analyzeButton.textContent = "Auditando Loja...";

      const auditResponse = await fetch(`${BACKEND_URL}/api/store-option-audit`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({domain, token: tokenData.accessToken}),
      });

      const auditData = await auditResponse.json();
      if (!auditResponse.ok) throw new Error(auditData.error);

      displayStoreAuditReport(auditData);
    } catch (error) {
      console.error("Erro:", error);
      errorReport.classList.remove("hidden");
      errorMessage.textContent = error.message;
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Autenticar e Consultar";
    }
  });

  function displayStoreAuditReport(storeAudit) {
    reportWrapper.classList.remove("hidden");
    reportTitle.textContent = "Auditoria Geral da Loja";
    optionsTitle.textContent = `Análise baseada em ${storeAudit.analyzedProductCount} produtos`;

    const {summary, details} = generateDetailedReportText(storeAudit.stats, storeAudit.bestOption, storeAudit.analyzedProductCount);
    optionSummary.innerHTML = summary;
    optionDetails.textContent = details;
  }

  function generateDetailedReportText(stats, bestOption, analyzedProductCount) {
    const productOrProducts = analyzedProductCount !== 1 ? "produtos" : "produto";
    let summary =
      bestOption !== "Nenhuma"
        ? `A análise sugere que a opção <strong>${bestOption.toUpperCase()}</strong> contém os TAMANHOS.`
        : `Não foi possível identificar a opção de tamanhos.`;

    let details = `Estatísticas Detalhadas:\n------------------------------------\n`;
    for (const optionKey in stats) {
      const {productCount, values} = stats[optionKey];
      details += `  - ${optionKey.toUpperCase()}:\n    - Em uso: ${productCount} ${productOrProducts}\n`;
      details += `    - Amostra: ${values.join(", ")}\n\n`;
    }
    return {summary, details};
  }
});
