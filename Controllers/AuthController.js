const User = require("../Model/UserModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Constants
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "1h";
const PASSWORD_MIN_LENGTH = 8;

/**
 * Validates email format using regex
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * User signup controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
module.exports.Signup = async (req, res) => {
  try {
    // Extract and sanitize inputs
    let { email, password, username, createdAt } = req.body;
    
    // Input validation
    const validationErrors = [];
    
    // Validate email
    email = email?.trim().toLowerCase();
    if (!email) {
      validationErrors.push("Email is required");
    } else if (!isValidEmail(email)) {
      validationErrors.push("Invalid email format");
    }
    
    // Validate password
    password = password?.trim();
    if (!password) {
      validationErrors.push("Password is required");
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      validationErrors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    
    // Validate username
    username = username?.trim();
    if (!username) {
      validationErrors.push("Username is required");
    } else if (username.length < 3) {
      validationErrors.push("Username must be at least 3 characters");
    }
    
    // Return all validation errors at once
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }
    
    // Check for existing user
    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }).select('_id'),
      User.findOne({ username }).select('_id')
    ]);
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }
    
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already taken"
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      username,
      createdAt: createdAt || new Date()
    });
    
    // Generate JWT token
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      username: user.username
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      {
        expiresIn: TOKEN_EXPIRY,
        issuer: process.env.APP_NAME || 'YourAppName',
        audience: user._id.toString()
      }
    );
    
    // Set secure cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000, // 1 hour in milliseconds
      path: "/"
    };
    
    res.cookie("token", token, cookieOptions);
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
      },
      token // Consider removing this if using httpOnly cookies exclusively
    });
    
  } catch (error) {
    console.error("Signup Error:", error);
    
    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Generic error response
    return res.status(500).json({
      success: false,
      message: "An error occurred during signup",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};