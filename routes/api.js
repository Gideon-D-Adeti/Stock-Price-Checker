"use strict";

// Import necessary modules
const fetch = require("node-fetch");
const mongoose = require("mongoose");

// Connect to the database
mongoose.connect(process.env.DB);

// Define the schema for stocks
const stockSchema = mongoose.Schema({
  symbol: { type: String, required: true },
  likes: { type: [String], default: [] },
});

// Create the Stock model using the schema
const Stock = mongoose.model("Stock", stockSchema);

// Function to create a new stock entry
const createStock = async (stock, like, ip) => {
  // Create a new Stock instance
  const newStock = new Stock({
    symbol: stock,
    likes: like ? [ip] : [],
  });

  // Save the new stock entry
  return await newStock.save();
};

// Function to find a stock by symbol
const findStock = async (stock) => {
  return await Stock.findOne({ symbol: stock }).exec();
};

// Function to save a stock entry
const saveStock = async (stock, like, ip) => {
  // Find the stock entry
  const foundStock = await findStock(stock);

  // If the stock does not exist, create a new entry
  if (!foundStock) {
    return await createStock(stock, like, ip);
  } else {
    // If like is true and IP is not already in likes, add IP to likes
    if (like && foundStock.likes.indexOf(ip) === -1) {
      foundStock.likes.push(ip);
    }
    // Save the updated stock entry
    return await foundStock.save();
  }
};

// Function to fetch stock data from an API
const getStock = async (stock) => {
  const response = await fetch(
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`
  );
  const { symbol, latestPrice } = await response.json();
  return { symbol, latestPrice };
};

// Export the route handler for the API
module.exports = function (app) {
  app.route("/api/stock-prices").get(async (req, res) => {
    const { stock, like } = req.query;

    // If multiple stocks are requested
    if (Array.isArray(stock)) {
      // Fetch data for the first stock
      const { symbol, latestPrice } = await getStock(stock[0]);
      // Fetch data for the second stock
      const { symbol: symbol2, latestPrice: latestPrice2 } = await getStock(
        stock[1]
      );

      // Save data for the first stock
      const firstStock = await saveStock(stock[0], like, req.ip);
      // Save data for the second stock
      const secondStock = await saveStock(stock[1], like, req.ip);

      // Prepare response data for both stocks
      let stockData = [];
      if (!symbol) {
        stockData.push({
          rel_likes: firstStock.likes.length - secondStock.likes.length,
        });
      } else {
        stockData.push({
          stock: symbol,
          price: latestPrice,
          rel_likes: firstStock.likes.length - secondStock.likes.length,
        });
      }

      if (!symbol2) {
        stockData.push({
          rel_likes: secondStock.likes.length - firstStock.likes.length,
        });
      } else {
        stockData.push({
          stock: symbol2,
          price: latestPrice2,
          rel_likes: secondStock.likes.length - firstStock.likes.length,
        });
      }

      // Send the response with stock data
      res.json({
        stockData,
      });
      return;
    }

    // If only one stock is requested
    const { symbol, latestPrice } = await getStock(stock);
    if (!symbol) {
      res.json({ stockData: { likes: like ? 1 : 0 } });
      return;
    }

    // Save data for the single requested stock
    const oneStockData = await saveStock(symbol, like, req.ip);

    // Send the response with data for the single stock
    res.json({
      stockData: {
        stock: symbol,
        price: latestPrice,
        likes: oneStockData.likes.length,
      },
    });
  });
};
