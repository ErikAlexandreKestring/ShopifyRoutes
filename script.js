document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("store-form");
  const resultsContainer = document.getElementById("results-container");
  const loader = document.getElementById("loader");

  // Elementos do Relatório de Produto Único
  const singleProductReport = document.getElementById("single-product-report");
  const productTitle = document.getElementById("product-title");
  const productTags = document.getElementById("product-tags");
  const productVariantAnalysis = document.getElementById("product-variant-analysis");
  const productVariantBody = document.getElementById("product-variant-body");

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

    try {
      // LÓGICA CONDICIONAL PRINCIPAL
      if (productId) {
        // Se um ID foi fornecido, busca um único produto
        const product = await fetchSingleProduct(domain, token, productId);
        displaySingleProductReport(product);
      } else {
        // Se não, faz a auditoria geral das options
        const optionAnalysis = await fetchStoreOptionAudit(domain, token);
        displayStoreAuditReport(optionAnalysis);
      }
    } catch (error) {
      console.error("Erro:", error);
      // Mostra o erro no template de produto único (serve para ambos os casos)
      singleProductReport.classList.remove("hidden");
      productTitle.textContent = "Ocorreu um Erro";
      productTags.innerHTML = `<span class="error">${error.message}</span>`;
      productVariantAnalysis.innerHTML = "";
      productVariantBody.innerHTML = "";
    }
  });

  // --- FUNÇÕES DE FETCH ---
  async function fetchSingleProduct(domain, token, productId) {
    const response = await fetch("http://localhost:3000/api/single-product-lookup", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({domain, token, productId}),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
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
      const errorData = await response.json();
      throw new Error(errorData.error);
    }
    return response.json();
  }

  // --- FUNÇÕES DE DISPLAY ---
  function displaySingleProductReport(product) {
    singleProductReport.classList.remove("hidden");
    productTitle.textContent = product.title || "Produto sem título";

    if (product.tags && product.tags.length > 0) {
      const tagsArray = product.tags.split(",").map((tag) => `<span class="tag-badge">${tag.trim()}</span>`);
      productTags.innerHTML = tagsArray.join(" ");
    } else {
      productTags.textContent = "Este produto não possui nenhuma tag.";
    }

    const {variants, options} = product;
    const optionValueCounts = {option1: new Set(), option2: new Set(), option3: new Set()};
    if (variants) {
      variants.forEach((v) => {
        if (v.option1) optionValueCounts.option1.add(v.option1);
        if (v.option2) optionValueCounts.option2.add(v.option2);
        if (v.option3) optionValueCounts.option3.add(v.option3);
      });
    }
    let mainOptionKey = null;
    let maxCount = 0;
    for (const [key, valueSet] of Object.entries(optionValueCounts)) {
      if (valueSet.size > maxCount) {
        maxCount = valueSet.size;
        mainOptionKey = key;
      }
    }
    if (mainOptionKey && maxCount > 0) {
      const optionIndex = parseInt(mainOptionKey.replace("option", ""), 10) - 1;
      const optionName = options[optionIndex]?.name || mainOptionKey;
      productVariantAnalysis.innerHTML = `Análise sugere que a opção principal deste produto é a <strong>${optionName}</strong> (<strong>${mainOptionKey}</strong>).`;
    } else {
      productVariantAnalysis.textContent = "Não foi possível analisar as variantes deste produto.";
    }

    productVariantBody.innerHTML = "";
    if (variants && variants.length > 0) {
      variants.forEach((variant) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${variant.position}</td><td>${variant.title}</td><td>${variant.price}</td>`;
        productVariantBody.appendChild(row);
      });
    } else {
      productVariantBody.innerHTML = '<tr><td colspan="3">Nenhuma variante encontrada.</td></tr>';
    }
  }

  function displayStoreAuditReport(optionAnalysis) {
    storeAuditReport.classList.remove("hidden");
    const {bestOption, stats} = optionAnalysis;

    if (bestOption !== "Nenhuma") {
      storeOptionSummary.innerHTML = `Análise geral da loja sugere que a <strong>${bestOption.toUpperCase()}</strong> é a mais provável para conter os TAMANHOS, por ter a maior variedade de valores.`;
    } else {
      storeOptionSummary.textContent = "Não foi possível determinar uma opção principal para os tamanhos na loja.";
    }

    let detailsText = `Estatísticas Detalhadas da Loja:\n`;
    detailsText += `------------------------------------\n`;
    for (const option in stats) {
      const {productCount, values} = stats[option];
      detailsText += `  - ${option.toUpperCase()}:\n`;
      detailsText += `    - Usada em: ${productCount} produtos com variantes\n`;

      // --- MUDANÇA PRINCIPAL AQUI ---
      // Removemos o limite e mostramos todos os valores.
      if (values.length > 0) {
        detailsText += `    - Valores (${values.length} únicos): ${values.join(", ")}`;
      } else {
        detailsText += `    - Valores: Nenhum valor encontrado.`;
      }
      detailsText += `\n\n`;
    }
    storeOptionDetails.textContent = detailsText;
  }
});
