require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoute = require("./Routes/AuthRoute");
const { HoldingModel } = require("./Model/HoldingModel");
const { PositionModel } = require("./Model/PositionModel");
const { OrderModel } = require("./Model/OrderModel");

const app = express();
const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || !uri) {
  console.error("Missing environment variables. Check .env file.");
  process.exit(1);
}

// Middleware
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Added this line
      "http://localhost:3001",
      "https://zerodha-frontend-4gwg.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/auth", authRoute);

// Holdings endpoints
app.get("/addholdings", async (req, res) => {
  try {
    let allHolding = await HoldingModel.find({});
    res.json(allHolding);
  } catch (error) {
    res.status(500).json({ message: "Error fetching holdings", error });
  }
});

// Positions endpoints
app.get("/addpositions", async (req, res) => {
  try {
    let allPosition = await PositionModel.find({});
    res.json(allPosition);
  } catch (error) {
    res.status(500).json({ message: "Error fetching positions", error });
  }
});

// Orders endpoints
app.post("/newOrder", async (req, res) => {
  try {
    const { name, qty, price, mode } = req.body;

    // First create the order record
    const newOrder = new OrderModel({
      name,
      qty,
      price,
      mode,
    });
    await newOrder.save();

    // Then update holdings
    const existingHolding = await HoldingModel.findOne({ name });

    if (existingHolding) {
      // Update existing holding
      if (mode === "BUY") {
        // Calculate new average price
        const totalCost =
          existingHolding.avg * existingHolding.qty + price * qty;
        const totalQty = existingHolding.qty + qty;
        const newAvgPrice = totalCost / totalQty;

        await HoldingModel.findByIdAndUpdate(existingHolding._id, {
          qty: totalQty,
          avg: newAvgPrice,
          price: price, // Update current price
        });
      } else if (mode === "SELL") {
        const remainingQty = existingHolding.qty - qty;
        if (remainingQty > 0) {
          await HoldingModel.findByIdAndUpdate(existingHolding._id, {
            qty: remainingQty,
            price: price, // Update current price
          });
        } else if (remainingQty === 0) {
          // Remove the holding if qty becomes 0
          await HoldingModel.findByIdAndDelete(existingHolding._id);
        } else {
          throw new Error("Cannot sell more than owned quantity");
        }
      }
    } else if (mode === "BUY") {
      // Create new holding
      const newHolding = new HoldingModel({
        name,
        qty,
        avg: price,
        price,
        net: 0,
        day: 0,
      });
      await newHolding.save();
    } else {
      throw new Error("Cannot sell stock that is not owned");
    }

    res.status(201).json({
      message: "Order placed and holdings updated successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({
      message: "Error processing order",
      error: error.message,
    });
  }
});

// Add an endpoint to get current holding for a specific stock
app.get("/holding/:stockName", async (req, res) => {
  try {
    const holding = await HoldingModel.findOne({ name: req.params.stockName });
    res.json(holding || null);
  } catch (error) {
    res.status(500).json({ message: "Error fetching holding", error });
  }
});
app.get("/getOrders", async (req, res) => {
  try {
    const orders = await OrderModel.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error });
  }
});

// MongoDB Connection
mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
