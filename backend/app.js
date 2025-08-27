import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import authRouter from './src/routers/authoRouter.js';
import emailRouter from './src/routers/emailTest.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(authRouter);
app.use(emailRouter);

export default app;
