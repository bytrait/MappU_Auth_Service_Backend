const express = require("express")
require("dotenv").config()

const cors = require("cors")
const cookieParser = require("cookie-parser")

const authRoutes = require("./routes/auth.routes")
const counsellorRoutes = require("./routes/counsellor.routes")
const internalRoutes = require("./routes/internal.routes")

const app = express()

/* =======================================================
   CORS CONFIG
======================================================= */

// Convert env string -> array
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(origin => origin.trim())
  : []

const corsOptions = {
  origin(origin, callback) {
    try {
      // Allow Postman/mobile apps/server-side requests
      if (!origin) {
        return callback(null, true)
      }

      // Allow configured origins
      if (corsOrigins.includes(origin)) {
        return callback(null, true)
      }

      console.error(`❌ Blocked by CORS: ${origin}`)

      return callback(
        new Error(`Origin ${origin} not allowed by CORS`)
      )
    } catch (err) {
      callback(err)
    }
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],

  optionsSuccessStatus: 200,
}

/* =======================================================
   MIDDLEWARE
======================================================= */

app.use(cors(corsOptions))

app.options(/.*/, cors(corsOptions))

app.use(cookieParser())

app.use(express.json())

app.use(express.urlencoded({ extended: true }))

/* =======================================================
   ROUTES
======================================================= */

app.use("/api/v2/auth", authRoutes)

app.use("/api/v2/counsellor", counsellorRoutes)

app.use("/api/v2/internal", internalRoutes)

/* =======================================================
   HEALTH CHECK
======================================================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Auth service running",
  })
})

module.exports = app