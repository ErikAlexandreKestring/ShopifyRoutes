require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ROTA 1: Para a auditoria geral das OPTIONS da loja
app.post("/api/store-option-audit", async (req, res) => {
  const {domain, token} = req.body;

  if (!domain || !token) {
    return res.status(400).json({error: "Domínio e Token são obrigatórios."});
  }

  let nextPageUrl = `https://${domain}/admin/api/2024-07/products.json?limit=250&fields=variants,options`;

  const optionStats = {
    option1: {values: new Set(), productCount: 0},
    option2: {values: new Set(), productCount: 0},
    option3: {values: new Set(), productCount: 0},
  };

  try {
    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, {
        headers: {"X-Shopify-Access-Token": token},
      });

      for (const product of response.data.products) {
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

      const linkHeader = response.headers.link;
      nextPageUrl = null;
      if (linkHeader) {
        const nextLink = linkHeader.split(",").find((s) => s.includes('rel="next"'));
        if (nextLink) nextPageUrl = nextLink.match(/<(.*?)>/)[1];
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

    // --- MUDANÇA PRINCIPAL AQUI ---
    // Prepara os dados para serem enviados como JSON, convertendo os Sets para Arrays
    const serializableStats = {
      option1: {
        productCount: optionStats.option1.productCount,
        values: Array.from(optionStats.option1.values).sort(), // Converte para array e ordena
      },
      option2: {
        productCount: optionStats.option2.productCount,
        values: Array.from(optionStats.option2.values).sort(),
      },
      option3: {
        productCount: optionStats.option3.productCount,
        values: Array.from(optionStats.option3.values).sort(),
      },
    };

    res.json({stats: serializableStats, bestOption: bestOption});
  } catch (error) {
    console.error("Erro no proxy:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({error: "Falha ao auditar a loja. Verifique o domínio e o token."});
  }
});

// ROTA 2: Para buscar um produto específico pelo ID
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
    console.error("Erro no proxy:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = status === 404 ? "Produto não encontrado. Verifique o ID." : "Falha ao buscar dados. Verifique as credenciais.";
    res.status(status).json({error: message});
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor proxy rodando na porta http://localhost:${PORT}`);
});
