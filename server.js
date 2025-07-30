require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: ["https://shopify-tags-options.vercel.app", "http://127.0.0.1:5500"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.post("/api/store-option-audit", async (req, res) => {
  const {domain, token} = req.body;
  if (!domain || !token) {
    return res.status(400).json({error: "Domínio e Token são obrigatórios."});
  }

  const auditUrl = `https://${domain}/admin/api/2024-07/products.json?limit=15&fields=variants,options`;
  const optionStats = {
    option1: {productCount: 0, values: new Set()},
    option2: {productCount: 0, values: new Set()},
    option3: {productCount: 0, values: new Set()},
  };

  try {
    const response = await axios.get(auditUrl, {headers: {"X-Shopify-Access-Token": token}});

    for (const product of response.data.products) {
      if (product.variants && product.variants.length > 1) {
        if (product.options.some((o) => o.position === 1)) optionStats.option1.productCount++;
        if (product.options.some((o) => o.position === 2)) optionStats.option2.productCount++;
        if (product.options.some((o) => o.position === 3)) optionStats.option3.productCount++;

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

    const serializableStats = {
      option1: {productCount: optionStats.option1.productCount, values: Array.from(optionStats.option1.values).sort()},
      option2: {productCount: optionStats.option2.productCount, values: Array.from(optionStats.option2.values).sort()},
      option3: {productCount: optionStats.option3.productCount, values: Array.from(optionStats.option3.values).sort()},
    };

    res.json({
      stats: serializableStats,
      bestOption: bestOption,
      analyzedProductCount: response.data.products.length,
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({error: "Falha ao auditar a loja. Verifique o domínio e o token."});
  }
});

app.post("/api/single-product-lookup", async (req, res) => {
  const {domain, token, productId} = req.body;
  if (!domain || !token || !productId) {
    return res.status(400).json({error: "Domínio, Token e ID do Produto são obrigatórios."});
  }
  const productUrl = `https://${domain}/admin/api/2024-07/products/${productId}.json`;
  try {
    const response = await axios.get(productUrl, {headers: {"X-Shopify-Access-Token": token}});
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
