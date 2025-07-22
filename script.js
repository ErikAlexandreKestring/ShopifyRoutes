document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("store-form");
  const resultsContainer = document.getElementById("results-container");
  const reportElement = document.getElementById("analysis-report");
  const loader = document.getElementById("loader");

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // Impede o recarregamento da página

    const domain = document.getElementById("store-domain").value.trim();
    const token = document.getElementById("api-token").value.trim();

    if (!domain || !token) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    // Prepara a UI para a busca
    resultsContainer.classList.remove("hidden");
    loader.classList.remove("hidden");
    reportElement.innerHTML = "";

    try {
      // A chamada agora é feita pela nova função que conversa com o nosso backend
      const allProducts = await fetchAllProducts(domain, token);

      if (allProducts.length === 0) {
        reportElement.innerHTML =
          '<span class="error">Nenhum produto encontrado na loja. Verifique as credenciais ou as permissões do token.</span>';
        return;
      }
      const analysisResult = analyzeProductOptions(allProducts);
      displayReport(analysisResult);
    } catch (error) {
      console.error("Erro detalhado:", error);
      reportElement.innerHTML = `<span class="error">Falha ao buscar produtos.\n\nCertifique-se que o servidor backend (node server.js) está rodando.\n\nDetalhes: ${error.message}</span>`;
    } finally {
      // Esconde o loader ao finalizar
      loader.classList.add("hidden");
    }
  });

  /**
   * NOVA VERSÃO: Busca os produtos através do nosso backend proxy para evitar erros de CORS.
   */
  async function fetchAllProducts(domain, token) {
    // O frontend agora chama o nosso backend na porta 3000
    const response = await fetch("http://localhost:3000/api/products", {
      method: "POST", // Usamos POST para enviar os dados de forma segura
      headers: {
        "Content-Type": "application/json",
      },
      // Enviamos as credenciais no corpo da requisição para o backend usar
      body: JSON.stringify({domain, token}),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Lança um erro com a mensagem vinda do backend
      throw new Error(errorData.error || `Erro de rede: ${response.status}`);
    }

    // Retorna a lista de produtos recebida do nosso backend
    return response.json();
  }

  /**
   * Analisa as opções dos produtos para determinar qual contém os tamanhos.
   * ESTA FUNÇÃO NÃO MUDA.
   */
  function analyzeProductOptions(products) {
    const optionStats = {
      option1: {values: new Set(), productCount: 0},
      option2: {values: new Set(), productCount: 0},
      option3: {values: new Set(), productCount: 0},
    };

    const sizeIndicators = /\b(P|M|G|XG|PP|GG|EG|EGG|U|UNICO|ONE SIZE|\d{2,3}(cm)?)\b/i;
    const colorIndicators = /\b(preto|branco|cinza|azul|verde|vermelho|amarelo|rosa|roxo|laranja|marrom|bege|dourado|prata)\b/i;

    for (const product of products) {
      if (product.variants && product.variants.length > 1) {
        if (product.options[0] && product.options[0].name !== "Title") optionStats.option1.productCount++;
        if (product.options[1]) optionStats.option2.productCount++;
        if (product.options[2]) optionStats.option3.productCount++;

        for (const variant of product.variants) {
          if (variant.option1) optionStats.option1.values.add(variant.option1);
          if (variant.option2) optionStats.option2.values.add(variant.option2);
          if (variant.option3) optionStats.option3.values.add(variant.option3);
        }
      }
    }

    let bestOption = "Nenhuma";
    let maxUniqueValues = 0;

    for (const option in optionStats) {
      if (optionStats[option].values.size > maxUniqueValues) {
        maxUniqueValues = optionStats[option].values.size;
        bestOption = option;
      }
    }

    let warning = "";
    if (bestOption !== "Nenhuma") {
      const values = Array.from(optionStats[bestOption].values);
      const hasSizes = values.some((v) => sizeIndicators.test(v));
      const hasColors = values.some((v) => colorIndicators.test(v));

      if (hasSizes && hasColors) {
        warning = `⚠️ Alerta: Esta opção (${bestOption}) parece misturar TAMANHOS e CORES.`;
      } else if (!hasSizes) {
        warning = `ℹ️ Info: Esta opção (${bestOption}) parece conter variações, mas não foram identificados tamanhos padrão (P, M, G, 38, 40, etc).`;
      }
    }

    return {
      totalProducts: products.length,
      productsWithVariants: products.filter((p) => p.variants.length > 1).length,
      bestOption,
      stats: optionStats,
      warning,
    };
  }

  /**
   * Exibe o relatório final na tela.
   * ESTA FUNÇÃO NÃO MUDA.
   */
  function displayReport(result) {
    const {totalProducts, productsWithVariants, bestOption, stats, warning} = result;

    let report = `Análise Concluída\n`;
    report += `------------------------------------\n`;
    report += `Total de Produtos na Loja: ${totalProducts}\n`;
    report += `Produtos com Variantes: ${productsWithVariants}\n\n`;

    report += `Diagnóstico Principal:\n`;
    if (bestOption !== "Nenhuma") {
      report += `A **${bestOption.toUpperCase()}** é a candidata mais provável para conter os TAMANHOS.\n`;
      report += `Motivo: É a opção com a maior variedade de valores distintos (${stats[bestOption].values.size} valores).\n\n`;
    } else {
      report += `Não foi possível determinar uma opção principal para tamanhos. A loja pode não usar variantes de tamanho ou usar um padrão diferente.\n\n`;
    }

    if (warning) {
      report += `${warning}\n\n`;
    }

    report += `Estatísticas Detalhadas:\n`;
    for (const option in stats) {
      const {values, productCount} = stats[option];
      report += `  - ${option.toUpperCase()}:\n`;
      report += `    - Usada em: ${productCount} produtos\n`;
      report += `    - Valores Únicos (${values.size}): ${[...values].slice(0, 5).join(", ")}${values.size > 5 ? "..." : ""}\n`;
    }

    reportElement.textContent = report;
  }
});
