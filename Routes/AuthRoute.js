const { Signup } = require("../Controllers/AuthController");
const router = require("express").Router();

router.post("/auth/signup", Signup);

module.exports = router;