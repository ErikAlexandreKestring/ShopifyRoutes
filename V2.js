document.addEventListener("DOMContentLoaded", () => {
  const BACKEND_URL = "https://shopifyroutes.onrender.com";

  const form = document.getElementById("store-form");
  const resultsContainer = document.getElementById("results-container");
  const reportWrapper = document.getElementById("report-wrapper");
  const reportTitle = document.getElementById("report-title");
  const tagsSection = document.getElementById("tags-section");
  const productTags = document.getElementById("product-tags");
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
    const productId = document.getElementById("product-id").value.trim();

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Autenticando...";
    resultsContainer.classList.remove("hidden");
    reportWrapper.classList.add("hidden");
    errorReport.classList.add("hidden");

    try {
      const authResponse = await fetch(`${BACKEND_URL}/api/get-shopify-token`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({domain, clientId, clientSecret}),
      });

      const authData = await authResponse.json();
      if (!authResponse.ok) throw new Error(authData.error);
      const token = authData.accessToken;

      analyzeButton.textContent = "Consultando...";

      if (productId) {
        const response = await fetch(`${BACKEND_URL}/api/single-product-lookup`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({domain, token, productId}),
        });
        const product = await response.json();
        if (!response.ok) throw new Error(product.error);
        displaySingleProductReport(product);
      } else {
        const response = await fetch(`${BACKEND_URL}/api/store-option-audit`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({domain, token}),
        });
        const auditData = await response.json();
        if (!response.ok) throw new Error(auditData.error);
        displayStoreAuditReport(auditData);
      }
    } catch (error) {
      errorReport.classList.remove("hidden");
      errorMessage.textContent = error.message;
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Consultar";
    }
  });

  function displaySingleProductReport(product) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.remove("hidden");
    reportTitle.textContent = product.title || "Produto Encontrado";
    optionsTitle.textContent = "Opções do Produto";

    productTags.innerHTML = product.tags
      ? product.tags
          .split(",")
          .map((t) => `<span class="tag-badge">${t.trim()}</span>`)
          .join(" ")
      : "Sem tags.";

    const optionStats = {
      option1: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option1).filter(Boolean)))},
      option2: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option2).filter(Boolean)))},
      option3: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option3).filter(Boolean)))},
    };
    const {details} = generateDetailedReportText(optionStats, "Nenhuma", 1);
    optionSummary.innerHTML = "Análise das variantes do produto específico.";
    optionDetails.textContent = details;
  }

  function displayStoreAuditReport(storeAudit) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.add("hidden");
    reportTitle.textContent = "Auditoria Geral da Loja";
    const {summary, details} = generateDetailedReportText(storeAudit.stats, storeAudit.bestOption, storeAudit.analyzedProductCount);
    optionSummary.innerHTML = summary;
    optionDetails.textContent = details;
  }

  function generateDetailedReportText(stats, bestOption, analyzedProductCount) {
    const pText = analyzedProductCount !== 1 ? "produtos" : "produto";
    let summary = bestOption !== "Nenhuma" ? `Provável opção de TAMANHOS: <strong>${bestOption.toUpperCase()}</strong>.` : "";
    let details = `Estatísticas Detalhadas:\n------------------------------------\n`;
    for (const key in stats) {
      details += `  - ${key.toUpperCase()}:\n    - Usada em: ${stats[key].productCount} ${pText}\n    - Amostra: ${stats[key].values.join(
        ", "
      )}\n\n`;
    }
    return {summary, details};
  }
});
