import express from "express";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import dotenv from "dotenv";
import compression from "compression";
import mongodbSanitize from "mongodb-sanitize";
import path from "path";

import DATABASE from "./config/DATABASE.js";
import UserAgentMiddleware from "./middleware/userAgent.js";
import userRouter from "./router/userRouter.js";
import packageRouter from "./router/packageRouter.js";
import cronSchedule from "./utils/cron.js";
import Transfer from "./router/sendMoneyRouter.js";
import transaction from "./router/transactionRouter.js";

dotenv.config();
const PORT = process.env.PORT || 4000;

const app = express();

const limit = rateLimit({
  windowMs: process.env.REQ_MS,
  max: process.env.REQ_LIMIT,
  message: "Too many requests, please try again later.",
  statusCode: 429,
});

app.use(limit);
const allowedOrigins = process.env.FRONTEND_URLS.split(",");
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  })
);

app.use(cookieParser());
app.use(mongodbSanitize());
app.use(hpp());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(UserAgentMiddleware);

app.use("/api/v1", userRouter, packageRouter, Transfer,transaction);

app.use("/images", express.static(path.join("./images")));

cronSchedule();

app.listen(PORT, () => {
  DATABASE();
  console.log(`Server Is Running On Port ${PORT}`);
});
