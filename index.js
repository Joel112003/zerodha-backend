require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const fs = require('fs');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoute = require("./Routes/AuthRoute");
const { HoldingModel } = require("./Model/HoldingModel");
const { PositionModel } = require("./Model/PositionModel");
const { OrderModel } = require("./Model/OrderModel");

const app = express();
const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// Validate environment variables
if (!JWT_SECRET || !MONGO_URI) {
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

// Holdings endpoints
app.get("/addholdings", async (req, res, next) => {
  try {
    const allHoldings = await HoldingModel.find({});
    res.json({ success: true, data: allHoldings });
  } catch (error) {
    next(error);
  }
});

// Positions endpoints
app.get("/addpositions", async (req, res, next) => {
  try {
    const allPositions = await PositionModel.find({});
    res.json({ success: true, data: allPositions });
  } catch (error) {
    next(error);
  }
});

// Orders endpoints
app.post("/newOrder", async (req, res, next) => {
  try {
    const { name, qty, price, mode } = req.body;

    if (!name || !qty || !price || !mode) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ success: false, message: "Price must be a positive number" });
    }

    if (!["BUY", "SELL"].includes(mode)) {
      return res.status(400).json({ success: false, message: "Mode must be BUY or SELL" });
    }

    const newOrder = new OrderModel({ name, qty, price, mode });
    await newOrder.save();

    // Update holdings
    const existingHolding = await HoldingModel.findOne({ name });

    if (existingHolding) {
      if (mode === "BUY") {
        const totalCost = existingHolding.avg * existingHolding.qty + price * qty;
        const totalQty = existingHolding.qty + qty;
        const newAvgPrice = totalCost / totalQty;

        await HoldingModel.findByIdAndUpdate(existingHolding._id, {
          qty: totalQty,
          avg: newAvgPrice,
          price,
        });
      } else if (mode === "SELL") {
        const remainingQty = existingHolding.qty - qty;
        if (remainingQty > 0) {
          await HoldingModel.findByIdAndUpdate(existingHolding._id, {
            qty: remainingQty,
            price,
          });
        } else if (remainingQty === 0) {
          await HoldingModel.findByIdAndDelete(existingHolding._id);
        } else {
          throw new Error("Cannot sell more than owned quantity");
        }
      }
    } else if (mode === "BUY") {
      const newHolding = new HoldingModel({ name, qty, avg: price, price, net: 0, day: 0 });
      await newHolding.save();
    } else {
      throw new Error("Cannot sell stock that is not owned");
    }

    res.status(201).json({
      success: true,
      message: "Order placed and holdings updated successfully",
      order: newOrder,
    });
  } catch (error) {
    next(error);
  }
});

// Get specific stock holding
app.get("/holding/:stockName", async (req, res, next) => {
  try {
    const holding = await HoldingModel.findOne({ name: req.params.stockName });
    res.json({ success: true, data: holding || null });
  } catch (error) {
    next(error);
  }
});

// Get all orders
app.get("/addOrders", async (req, res, next) => {
  try {
    const orders = await OrderModel.find();
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// Serve static files and handle frontend routes
const frontendPath = path.resolve(__dirname, "../frontend/build");
console.log("Frontend path:", frontendPath); // Debug log

// Serve static files
app.use(express.static(frontendPath));

// Handle all other routes by serving index.html
app.get("*", (req, res) => {
  const indexPath = path.resolve(frontendPath, "index.html");
  console.log("Index path:", indexPath); // Debug log
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error("Frontend build not found at:", indexPath);
    res.status(404).send('Frontend build not found. Make sure you have built the React app.');
  }
});

// 404 Middleware
app.use((req, res) => {
  res.status(404).json({ success: false, message: `❌ Resource not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal Server Error" });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

connectDB();