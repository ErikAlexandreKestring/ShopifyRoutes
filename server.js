require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
// Usa a porta do .env ou 3000 por padrão
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Rota para teste rápido no navegador ---
app.get("/", (req, res) => {
  res.send("API ShopifyRoutes está rodando com nova lógica de detecção de tamanhos!");
});

// --- Rota: Auditoria de opções (Lógica: Validação por Valores Comuns) ---
app.post("/api/store-option-audit", async (req, res) => {
  const {domain, token} = req.body;
  if (!domain || !token) {
    return res.status(400).json({error: "Domínio e Token são obrigatórios."});
  }

  const auditUrl = `https://${domain}/admin/api/2024-07/products.json?limit=15&fields=variants,options`;

  // Estrutura para estatísticas
  const optionStats = {
    option1: {productCount: 0, values: new Set(), score: 0},
    option2: {productCount: 0, values: new Set(), score: 0},
    option3: {productCount: 0, values: new Set(), score: 0},
  };

  // --- REGEX DE TAMANHOS COMUNS (PT-BR e Internacional) ---
  // Captura:
  // 1. Letras: PP, P, M, G, GG, XG, S, L, XL, XXL, XS, 2XL, etc.
  // 2. Numérico: 1 a 3 dígitos (ex: 36, 38, 40, 42, 10, 12)
  // 3. Palavras: Único, Unico, One Size, Unitario
  const sizeValueRegex =
    /^(pp|p|m|g|gg|xg|xgg|eg|egg|s|l|xl|xxl|xs|xxs|xxx|2xl|3xl|4xl|uni|único|unico|one\s?size|tamanho\s?único|\d{1,3}(\s?(cm|mm|in|"))?)$/i;

  // Regex para penalizar Cores (para desempatar)
  const commonColorsRegex =
    /^(preto|branco|azul|vermelho|verde|amarelo|rosa|cinza|marrom|bege|nude|black|white|blue|red|green|grey|gray|pink|yellow|brown|orange|purple|gold|silver|talla|color)$/i;

  try {
    const response = await axios.get(auditUrl, {
      headers: {"X-Shopify-Access-Token": token},
    });

    for (const product of response.data.products) {
      if (product.variants && product.variants.length > 1) {
        // Contagem básica de uso
        if (product.options.some((o) => o.position === 1)) optionStats.option1.productCount++;
        if (product.options.some((o) => o.position === 2)) optionStats.option2.productCount++;
        if (product.options.some((o) => o.position === 3)) optionStats.option3.productCount++;

        // Analisar valores dos variantes
        for (const variant of product.variants) {
          checkAndScoreOption("option1", variant.option1, optionStats, sizeValueRegex, commonColorsRegex);
          checkAndScoreOption("option2", variant.option2, optionStats, sizeValueRegex, commonColorsRegex);
          checkAndScoreOption("option3", variant.option3, optionStats, sizeValueRegex, commonColorsRegex);
        }
      }
    }

    // --- Lógica de Decisão Baseada no Score ---
    let bestOption = "Nenhuma";
    let maxScore = -1; // Começa negativo para garantir que 0 entre se necessário

    for (const option in optionStats) {
      // Regra de desempate: Se scores forem iguais, prefira a opção que tem MENOS caracteres médios (Tamanhos "P" são curtos, Cores "Azul Marinho" são longas)
      // Mas por enquanto, vamos puramente pelo score do Regex.
      if (optionStats[option].score > maxScore) {
        maxScore = optionStats[option].score;
        bestOption = option;
      }
    }

    // Se o score for muito baixo (nenhum tamanho detectado), fallback para a lógica de maior variabilidade (opcional)
    // Mas como você quer forçar tamanhos, se o score for 0, mantemos o que tiver maior score (mesmo que zero) ou "Nenhuma".
    if (maxScore <= 0) {
      // Fallback: Tenta pegar o option2 por padrão se option1 parecer cor
      if (optionStats.option1.values.size > 0 && optionStats.option2.values.size > 0) {
        bestOption = "option2"; // Chute educado para ecommerce de moda padrão
      }
    }

    const serializableStats = {
      option1: {
        productCount: optionStats.option1.productCount,
        values: Array.from(optionStats.option1.values).sort().slice(0, 10), // Limita amostra
        score: optionStats.option1.score,
      },
      option2: {
        productCount: optionStats.option2.productCount,
        values: Array.from(optionStats.option2.values).sort().slice(0, 10),
        score: optionStats.option2.score,
      },
      option3: {
        productCount: optionStats.option3.productCount,
        values: Array.from(optionStats.option3.values).sort().slice(0, 10),
        score: optionStats.option3.score,
      },
    };

    res.json({
      stats: serializableStats,
      bestOption: bestOption,
      analyzedProductCount: response.data.products.length,
      method: "Análise de Padrão de Valores (Regex Tamanhos)",
    });
  } catch (error) {
    console.error(error);
    res.status(error.response?.status || 500).json({error: "Falha ao auditar a loja. Verifique o domínio e o token."});
  }
});

// Função auxiliar para pontuar
function checkAndScoreOption(optionKey, value, stats, sizeRegex, colorRegex) {
  if (!value) return;

  // Adiciona ao set para visualização no relatório
  stats[optionKey].values.add(value);

  // 1. Ganha ponto se parecer tamanho (P, M, G, 38, 40)
  if (sizeRegex.test(value)) {
    stats[optionKey].score += 2; // Peso alto para match positivo
  }

  // 2. Perde ponto se parecer cor (Preto, Azul)
  if (colorRegex.test(value)) {
    stats[optionKey].score -= 1; // Penalidade
  }
}

// --- Rota: Busca produto específico ---
app.post("/api/single-product-lookup", async (req, res) => {
  const {domain, token, productId} = req.body;
  if (!domain || !token || !productId) {
    return res.status(400).json({error: "Domínio, Token e ID do Produto são obrigatórios."});
  }
  const productUrl = `https://${domain}/admin/api/2024-07/products/${productId}.json`;
  try {
    const response = await axios.get(productUrl, {
      headers: {"X-Shopify-Access-Token": token},
    });
    res.json(response.data.product);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = status === 404 ? "Produto não encontrado. Verifique o ID." : "Falha ao buscar dados. Verifique as credenciais.";
    res.status(status).json({error: message});
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor proxy rodando na porta ${PORT}`);
});
