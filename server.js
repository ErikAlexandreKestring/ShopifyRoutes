// server.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors

const app = express();
const PORT = 3000;

app.use(cors()); // Habilita o CORS para que seu frontend possa chamar este backend
app.use(express.json());

// Endpoint para buscar todos os produtos
app.post("/api/products", async (req, res) => {
  const {domain, token} = req.body;

  if (!domain || !token) {
    return res.status(400).json({error: "Domínio e Token são obrigatórios."});
  }

  let allProducts = [];
  let nextPageUrl = `https://${domain}/admin/api/2024-07/products.json?limit=250&status=active`;

  try {
    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, {
        headers: {"X-Shopify-Access-Token": token},
      });

      allProducts = allProducts.concat(response.data.products);

      const linkHeader = response.headers.link;
      nextPageUrl = null;
      if (linkHeader) {
        const nextLink = linkHeader.split(",").find((s) => s.includes('rel="next"'));
        if (nextLink) {
          nextPageUrl = nextLink.match(/<(.*?)>/)[1];
        }
      }
    }
    res.json(allProducts);
  } catch (error) {
    console.error("Erro no proxy:", error.response ? error.response.data : error.message);
    res.status(error.response?.status || 500).json({error: "Falha ao buscar dados da Shopify. Verifique as credenciais."});
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor proxy rodando na porta http://localhost:${PORT}`);
});
