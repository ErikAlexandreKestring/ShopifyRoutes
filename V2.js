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

    if (!domain || !clientId || !clientSecret) {
      alert("Domínio, Client ID e Secret são obrigatórios.");
      return;
    }

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Autenticando...";
    resultsContainer.classList.remove("hidden");
    reportWrapper.classList.add("hidden");
    errorReport.classList.add("hidden");
    tagsSection.classList.add("hidden");

    try {
      const token = await fetchTemporaryToken(domain, clientId, clientSecret);

      analyzeButton.textContent = "Consultando...";

      if (productId) {
        const product = await fetchSingleProduct(domain, token, productId);
        displaySingleProductReport(product);
      } else {
        const storeAudit = await fetchStoreOptionAudit(domain, token);
        displayStoreAuditReport(storeAudit);
      }
    } catch (error) {
      console.error("Erro:", error);
      errorReport.classList.remove("hidden");
      errorMessage.textContent = error.message;
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Autenticar e Consultar";
    }
  });

  async function fetchTemporaryToken(domain, clientId, clientSecret) {
    const response = await fetch(`${BACKEND_URL}/api/get-shopify-token`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, clientId, clientSecret}),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Falha na autenticação OAuth.");
    }
    const data = await response.json();
    return data.accessToken;
  }

  async function fetchSingleProduct(domain, token, productId) {
    const response = await fetch(`${BACKEND_URL}/api/single-product-lookup`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token, productId}),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    return response.json();
  }

  async function fetchStoreOptionAudit(domain, token) {
    const response = await fetch(`${BACKEND_URL}/api/store-option-audit`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token}),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    return response.json();
  }

  function displaySingleProductReport(product) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.remove("hidden");
    reportTitle.textContent = product.title || "Produto Encontrado";
    optionsTitle.textContent = "Análise de Opções deste Produto";

    productTags.innerHTML = product.tags
      ? product.tags
          .split(",")
          .map((t) => `<span class="tag-badge">${t.trim()}</span>`)
          .join(" ")
      : "Este produto não possui tags.";

    const optionStats = {
      option1: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option1).filter(Boolean)))},
      option2: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option2).filter(Boolean)))},
      option3: {productCount: 1, values: Array.from(new Set(product.variants.map((v) => v.option3).filter(Boolean)))},
    };

    const {summary, details} = generateDetailedReportText(optionStats, "Nenhuma", 1);
    optionSummary.innerHTML = "Exibindo valores das variantes encontradas para este produto.";
    optionDetails.textContent = details;
  }

  function displayStoreAuditReport(storeAudit) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.add("hidden");
    reportTitle.textContent = "Auditoria Geral da Loja";
    optionsTitle.textContent = `Análise baseada em ${storeAudit.analyzedProductCount} produtos`;

    const {summary, details} = generateDetailedReportText(storeAudit.stats, storeAudit.bestOption, storeAudit.analyzedProductCount);
    optionSummary.innerHTML = summary;
    optionDetails.textContent = details;
  }

  function generateDetailedReportText(stats, bestOption, analyzedProductCount) {
    const productOrProducts = analyzedProductCount !== 1 ? "produtos" : "produto";
    let summary =
      bestOption !== "Nenhuma" ? `A análise sugere que a opção <strong>${bestOption.toUpperCase()}</strong> contém os TAMANHOS.` : "";

    let details = `Estatísticas Detalhadas:\n------------------------------------\n`;
    for (const optionKey in stats) {
      const {productCount, values} = stats[optionKey];
      details += `  - ${optionKey.toUpperCase()}:\n    - Usada em: ${productCount} ${productOrProducts}\n`;
      details += `    - Valores: ${values.length > 0 ? values.join(", ") : "Nenhum"}\n\n`;
    }
    return {summary, details};
  }
});
