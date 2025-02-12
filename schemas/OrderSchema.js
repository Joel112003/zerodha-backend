const { Schema } = require("mongoose");

const OrderSchema = new Schema({
  name: String,
  qty: Number,
  mode: String,
  price: Number,
});

module.exports = { OrderSchema };
