require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoute = require("./Routes/AuthRoute");
const { HoldingModel } = require("./Model/HoldingModel");
const { PositionModel } = require("./Model/PositionModel");
const { OrderModel } = require("./Model/OrderModel");

const app = express();
const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;
const jwtSecret = process.env.JWT_SECRET;

// Validate environment variables
if (!jwtSecret || !uri) {
  console.error("❌ Missing required environment variables. Check .env file.");
  process.exit(1);
}

// Security Middlewares
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://zerodha-frontend-4gwg.onrender.com",
  "https://zerodha-dashboard-head.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Routes
app.use("/auth", authRoute);


// Serve frontend (Production Setup)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}

// 404 Middleware
app.use((req, res) => {
  res.status(404).json({ success: false, message: `❌ Resource not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal Server Error" });
});
// Holdings endpoints
app.get("/addholdings", async (req, res) => {
  try {
    const allHoldings = await HoldingModel.find({});
    res.json({ success: true, data: allHoldings });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching holdings",
        error: error.message,
      });
  }
});

// Positions endpoints
app.get("/addpositions", async (req, res) => {
  try {
    const allPositions = await PositionModel.find({});
    res.json({ success: true, data: allPositions });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching positions",
        error: error.message,
      });
  }
});

// Orders endpoints
app.post("/newOrder", async (req, res) => {
  try {
    const { name, qty, price, mode } = req.body;

    // Input validation
    if (!name || !qty || !price || !mode) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Quantity must be a positive integer",
        });
    }
    if (typeof price !== "number" || price <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Price must be a positive number" });
    }
    if (!["BUY", "SELL"].includes(mode)) {
      return res
        .status(400)
        .json({ success: false, message: "Mode must be BUY or SELL" });
    }

    // Create order record
    const newOrder = new OrderModel({ name, qty, price, mode });
    await newOrder.save();

    // Update holdings
    const existingHolding = await HoldingModel.findOne({ name });

    if (existingHolding) {
      if (mode === "BUY") {
        const totalCost =
          existingHolding.avg * existingHolding.qty + price * qty;
        const totalQty = existingHolding.qty + qty;
        const newAvgPrice = totalCost / totalQty;

        await HoldingModel.findByIdAndUpdate(existingHolding._id, {
          qty: totalQty,
          avg: newAvgPrice,
          price, // Update current price
        });
      } else if (mode === "SELL") {
        const remainingQty = existingHolding.qty - qty;
        if (remainingQty > 0) {
          await HoldingModel.findByIdAndUpdate(existingHolding._id, {
            qty: remainingQty,
            price, // Update current price
          });
        } else if (remainingQty === 0) {
          await HoldingModel.findByIdAndDelete(existingHolding._id);
        } else {
          throw new Error("Cannot sell more than owned quantity");
        }
      }
    } else if (mode === "BUY") {
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

    res
      .status(201)
      .json({
        success: true,
        message: "Order placed and holdings updated successfully",
        order: newOrder,
      });
  } catch (error) {
    console.error("Error processing order:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error processing order",
        error: error.message,
      });
  }
});

// Holding for specific stock
app.get("/holding/:stockName", async (req, res) => {
  try {
    const holding = await HoldingModel.findOne({ name: req.params.stockName });
    res.json({ success: true, data: holding || null });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching holding",
        error: error.message,
      });
  }
});

app.get("/getOrders", async (req, res) => {
  try {
    const orders = await OrderModel.find();
    res.json({ success: true, data: orders });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching orders",
        error: error.message,
      });
  }
});

// Serve frontend (ensure this is last)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}


// MongoDB Connection
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
