require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.send("API ShopifyRoutes está rodando corretamente!");
});

app.post("/api/get-shopify-token", async (req, res) => {
  const {domain, clientId, clientSecret} = req.body;

  if (!domain || !clientId || !clientSecret) {
    return res.status(400).json({error: "Domínio, Client ID e Secret são obrigatórios."});
  }

  const tokenUrl = `https://${domain}/admin/oauth/access_token`;

  try {
    const response = await axios.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    res.json({accessToken: response.data.access_token});
  } catch (error) {
    console.error("Erro na autenticação OAuth:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Falha na autenticação. Verifique o domínio e as credenciais do App.",
    });
  }
});

app.post("/api/store-option-audit", async (req, res) => {
  const {domain, token} = req.body;
  if (!domain || !token) {
    return res.status(400).json({error: "Domínio e Token são obrigatórios."});
  }

  const auditUrl = `https://${domain}/admin/api/2024-07/products.json?limit=15&fields=variants,options`;

  const optionStats = {
    option1: {productCount: 0, values: new Set(), score: 0},
    option2: {productCount: 0, values: new Set(), score: 0},
    option3: {productCount: 0, values: new Set(), score: 0},
  };

  const sizeValueRegex =
    /^(pp|p|m|g|gg|xg|xgg|eg|egg|s|l|xl|xxl|xs|xxs|xxx|2xl|3xl|4xl|uni|único|unico|one\s?size|tamanho\s?único|\d{1,3}(\s?(cm|mm|in|"))?)$/i;

  const commonColorsRegex =
    /^(preto|branco|azul|vermelho|verde|amarelo|rosa|cinza|marrom|bege|nude|black|white|blue|red|green|grey|gray|pink|yellow|brown|orange|purple|gold|silver|talla|color)$/i;

  try {
    const response = await axios.get(auditUrl, {
      headers: {"X-Shopify-Access-Token": token},
    });

    for (const product of response.data.products) {
      if (product.variants && product.variants.length > 1) {
        if (product.options.some((o) => o.position === 1)) optionStats.option1.productCount++;
        if (product.options.some((o) => o.position === 2)) optionStats.option2.productCount++;
        if (product.options.some((o) => o.position === 3)) optionStats.option3.productCount++;

        for (const variant of product.variants) {
          checkAndScoreOption("option1", variant.option1, optionStats, sizeValueRegex, commonColorsRegex);
          checkAndScoreOption("option2", variant.option2, optionStats, sizeValueRegex, commonColorsRegex);
          checkAndScoreOption("option3", variant.option3, optionStats, sizeValueRegex, commonColorsRegex);
        }
      }
    }

    let bestOption = "Nenhuma";
    let maxScore = -1;

    for (const option in optionStats) {
      if (optionStats[option].score > maxScore) {
        maxScore = optionStats[option].score;
        bestOption = option;
      }
    }

    if (maxScore <= 0) {
      if (optionStats.option1.values.size > 0 && optionStats.option2.values.size > 0) {
        bestOption = "option2";
      }
    }

    const serializableStats = {
      option1: {
        productCount: optionStats.option1.productCount,
        values: Array.from(optionStats.option1.values).sort().slice(0, 10),
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
    console.error("Erro na auditoria:", error.message);
    res.status(error.response?.status || 500).json({error: "Falha ao auditar a loja. Verifique o domínio e o token."});
  }
});

function checkAndScoreOption(optionKey, value, stats, sizeRegex, colorRegex) {
  if (!value) return;
  stats[optionKey].values.add(value);
  if (sizeRegex.test(value)) stats[optionKey].score += 2;
  if (colorRegex.test(value)) stats[optionKey].score -= 1;
}

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
    const message = status === 404 ? "Produto não encontrado. Verifique o ID." : "Falha ao buscar dados.";
    res.status(status).json({error: message});
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor proxy rodando na porta ${PORT}`);
});
