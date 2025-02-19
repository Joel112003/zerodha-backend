const { Schema, model } = require("mongoose");
const mongoose = require("mongoose");

const OrderSchema = new Schema({
  name: String,
  qty: Number,
  price: Number,
  mode: String, // "BUY" or "SELL"
  approved: { type: Boolean, default: false }
}, { timestamps: true });

const Order = model("Order", OrderSchema);

const approveOrders = async () => {
  try {
    const result = await Order.updateMany({ approved: false }, { approved: true });
    console.log("Orders approved:", result);
  } catch (error) {
    console.error("Error approving orders:", error);
  }
};

// Run this every 10 seconds
setInterval(approveOrders, 10000);

module.exports = { OrderSchema };
