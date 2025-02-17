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

app.use(bodyParser.json());
app.use(
  cors({
    origin: "https://zerodha-frontend-4gwg.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use("/auth", authRoute);

// ✅ Get all holdings
app.get("/addholdings", async (req, res) => {
  try {
    let allHolding = await HoldingModel.find({});
    res.json(allHolding);
  } catch (error) {
    res.status(500).json({ message: "Error fetching holdings", error });
  }
});

// ✅ Get all positions
app.get("/addpositions", async (req, res) => {
  try {
    let allPosition = await PositionModel.find({});
    res.json(allPosition);
  } catch (error) {
    res.status(500).json({ message: "Error fetching positions", error });
  }
});

// ✅ Create a new order
app.post("/newOrder", async (req, res) => {
  try {
    const newOrder = new OrderModel({
      name: req.body.name,
      qty: req.body.qty,
      price: req.body.price,
      mode: req.body.mode, // "BUY" or "SELL"
    });

    await newOrder.save();
    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    res.status(500).json({ message: "Error placing order", error });
  }
});

// ✅ Get all orders
app.get("/getOrders", async (req, res) => {
  try {
    const orders = await OrderModel.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error });
  }
});

// ✅ MongoDB Connection
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
