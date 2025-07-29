document.addEventListener("DOMContentLoaded", () => {
  const BACKEND_URL = "https://URL-DO-SEU-BACKEND-AQUI.up.railway.app";

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
    const token = document.getElementById("api-token").value.trim();
    const productId = document.getElementById("product-id").value.trim();

    if (!domain || !token) {
      alert("Domínio e Token são obrigatórios.");
      return;
    }

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analisando...";
    resultsContainer.classList.remove("hidden");
    reportWrapper.classList.add("hidden");
    errorReport.classList.add("hidden");

    try {
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
      analyzeButton.textContent = "Analisar";
    }
  });

  async function fetchSingleProduct(domain, token, productId) {
    // Usa a variável BACKEND_URL para montar a rota
    const response = await fetch(`${BACKEND_URL}/api/single-product-lookup`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token, productId}),
    });
    if (!response.ok) {
      throw new Error((await response.json()).error);
    }
    return response.json();
  }

  async function fetchStoreOptionAudit(domain, token) {
    // Usa a variável BACKEND_URL para montar a rota
    const response = await fetch(`${BACKEND_URL}/api/store-option-audit`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token}),
    });
    if (!response.ok) {
      throw new Error((await response.json()).error);
    }
    return response.json();
  }

  function generateDetailedReportText(stats, bestOption, analyzedProductCount) {
    const productOrProducts = analyzedProductCount !== 1 ? "produtos" : "produto";
    let summary = "";
    if (bestOption !== "Nenhuma") {
      summary = `Análise de ${analyzedProductCount} ${productOrProducts} sugere que a <strong>${bestOption.toUpperCase()}</strong> é a mais provável para conter os TAMANHOS.`;
    } else {
      summary = `Não foi possível determinar uma opção principal nos ${analyzedProductCount} ${productOrProducts} analisados.`;
    }

    let details = `Estatísticas Detalhadas:\n`;
    details += `------------------------------------\n`;
    for (const optionKey in stats) {
      const {productCount, values} = stats[optionKey];
      const usePlural = productCount !== 1 ? "s" : "";
      details += `  - ${optionKey.toUpperCase()}:\n`;
      details += `    - Usada em: ${productCount} produto${usePlural} com variantes\n`;
      if (values.length > 0) {
        details += `    - Valores (${values.length} únicos): ${values.join(", ")}`;
      } else {
        details += `    - Valores: Nenhum valor encontrado.`;
      }
      details += `\n\n`;
    }
    return {summary, details};
  }

  function displaySingleProductReport(product) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.remove("hidden");

    reportTitle.textContent = product.title || "Produto Sem Título";
    optionsTitle.textContent = "Análise de Opções do Produto";

    if (product.tags && product.tags.length > 0) {
      productTags.innerHTML = product.tags
        .split(",")
        .map((tag) => `<span class="tag-badge">${tag.trim()}</span>`)
        .join(" ");
    } else {
      productTags.textContent = "Este produto não possui nenhuma tag.";
    }

    const hasVariants = product.variants && product.variants.length > 1;
    const optionStats = {
      option1: {
        productCount: hasVariants && product.options.some((o) => o.position === 1) ? 1 : 0,
        values: Array.from(new Set(product.variants.map((v) => v.option1).filter(Boolean))),
      },
      option2: {
        productCount: hasVariants && product.options.some((o) => o.position === 2) ? 1 : 0,
        values: Array.from(new Set(product.variants.map((v) => v.option2).filter(Boolean))),
      },
      option3: {
        productCount: hasVariants && product.options.some((o) => o.position === 3) ? 1 : 0,
        values: Array.from(new Set(product.variants.map((v) => v.option3).filter(Boolean))),
      },
    };

    let bestOption = "Nenhuma";
    let maxCount = 0;
    for (const optionKey in optionStats) {
      if (optionStats[optionKey].values.length > maxCount) {
        maxCount = optionStats[optionKey].values.length;
        bestOption = optionKey;
      }
    }

    const {summary, details} = generateDetailedReportText(optionStats, bestOption, 1);
    optionSummary.innerHTML = summary;
    optionDetails.textContent = details;
  }

  function displayStoreAuditReport(storeAudit) {
    reportWrapper.classList.remove("hidden");
    tagsSection.classList.add("hidden");

    reportTitle.textContent = "Auditoria Geral da Loja";
    optionsTitle.textContent = `Análise das Opções (baseado em uma amostra de ${storeAudit.analyzedProductCount} produtos)`;

    const {summary, details} = generateDetailedReportText(storeAudit.stats, storeAudit.bestOption, storeAudit.analyzedProductCount);
    optionSummary.innerHTML = summary;
    optionDetails.textContent = details;
  }
});
