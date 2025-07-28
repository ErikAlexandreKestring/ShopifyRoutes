document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("store-form");
  const resultsContainer = document.getElementById("results-container");
  const loader = document.getElementById("loader");

  // Elementos do Relatório de Produto Único
  const singleProductReport = document.getElementById("single-product-report");
  const productTitle = document.getElementById("product-title");
  const productTags = document.getElementById("product-tags");
  const productOptionSummary = document.getElementById("product-option-summary");
  const productOptionDetails = document.getElementById("product-option-details");

  // Elementos do Relatório de Auditoria da Loja
  const storeAuditReport = document.getElementById("store-audit-report");
  const storeOptionSummary = document.getElementById("store-option-summary");
  const storeOptionDetails = document.getElementById("store-option-details");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const domain = document.getElementById("store-domain").value.trim();
    const token = document.getElementById("api-token").value.trim();
    const productId = document.getElementById("product-id").value.trim();

    if (!domain || !token) {
      alert("Domínio e Token são obrigatórios.");
      return;
    }

    resultsContainer.classList.remove("hidden");
    loader.classList.remove("hidden");
    singleProductReport.classList.add("hidden");
    storeAuditReport.classList.add("hidden");

    try {
      if (productId) {
        const product = await fetchSingleProduct(domain, token, productId);
        displaySingleProductReport(product);
      } else {
        const optionAnalysis = await fetchStoreOptionAudit(domain, token);
        displayStoreAuditReport(optionAnalysis);
      }
    } catch (error) {
      console.error("Erro:", error);
      singleProductReport.classList.remove("hidden");
      storeAuditReport.classList.add("hidden");
      productTitle.textContent = "Ocorreu um Erro";
      productTags.innerHTML = `<span class="error">${error.message}</span>`;
      productOptionSummary.innerHTML = "";
      productOptionDetails.textContent = "";
    } finally {
      loader.classList.add("hidden");
    }
  });

  async function fetchSingleProduct(domain, token, productId) {
    const response = await fetch("http://localhost:3000/api/single-product-lookup", {
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
    const response = await fetch("http://localhost:3000/api/store-option-audit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token}),
    });
    if (!response.ok) {
      throw new Error((await response.json()).error);
    }
    return response.json();
  }

  // --- FUNÇÃO REUTILIZÁVEL ATUALIZADA ---
  // Agora ela sempre mostra a contagem de produtos, tornando o formato consistente.
  function generateOptionAnalysisReport(stats, bestOption, context) {
    let summaryHTML = "";
    if (bestOption !== "Nenhuma") {
      summaryHTML = `Análise ${context} sugere que a <strong>${bestOption.toUpperCase()}</strong> é a mais provável para conter os TAMANHOS.`;
    } else {
      summaryHTML = `Não foi possível determinar uma opção principal para os tamanhos ${context}.`;
    }

    let detailsText = `Estatísticas Detalhadas ${context}:\n`;
    detailsText += `------------------------------------\n`;
    for (const option in stats) {
      const {productCount, values} = stats[option];
      const usePlural = productCount !== 1 ? "s" : "";
      detailsText += `  - ${option.toUpperCase()}:\n`;

      // Esta linha agora é exibida em ambos os relatórios
      detailsText += `    - Usada em: ${productCount} produto${usePlural} com variantes\n`;

      if (values.length > 0) {
        detailsText += `    - Valores (${values.length} únicos): ${values.join(", ")}`;
      } else {
        detailsText += `    - Valores: Nenhum valor encontrado.`;
      }
      detailsText += `\n\n`;
    }
    return {summaryHTML, detailsText};
  }

  // --- FUNÇÃO DE EXIBIÇÃO DE PRODUTO ÚNICO ATUALIZADA ---
  function displaySingleProductReport(product) {
    singleProductReport.classList.remove("hidden");

    productTitle.textContent = product.title || "Produto sem título";
    if (product.tags && product.tags.length > 0) {
      const tagsArray = product.tags.split(",").map((tag) => `<span class="tag-badge">${tag.trim()}</span>`);
      productTags.innerHTML = tagsArray.join(" ");
    } else {
      productTags.textContent = "Este produto não possui nenhuma tag.";
    }

    // ---- LÓGICA DE ANÁLISE CORRIGIDA ----
    // 1. Calcula as estatísticas completas para este produto
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
    for (const option in optionStats) {
      if (optionStats[option].values.length > maxCount) {
        maxCount = optionStats[option].values.length;
        bestOption = option;
      }
    }

    // 2. Gera e exibe o relatório usando a função reutilizável
    const report = generateOptionAnalysisReport(optionStats, bestOption, "deste Produto");
    productOptionSummary.innerHTML = report.summaryHTML;
    productOptionDetails.textContent = report.detailsText;
  }

  function displayStoreAuditReport(optionAnalysis) {
    storeAuditReport.classList.remove("hidden");

    const report = generateOptionAnalysisReport(optionAnalysis.stats, optionAnalysis.bestOption, "da Loja (amostra de 15 produtos)");
    storeOptionSummary.innerHTML = report.summaryHTML;
    storeOptionDetails.textContent = report.detailsText;
  }
});
