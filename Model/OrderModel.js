const { model } = require("mongoose");

const {OrderSchema} = require("../schemas/OrderSchema");

const OrderModel = new model("order", OrderSchema);


module.exports = {OrderModel};