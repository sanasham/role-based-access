import express from 'express';
import { loginUser, registerUser } from '../controllers/authController.js';
const authRouter = express.Router();
authRouter.get('/', (req, res) => {
  res.send('API is running...');
});
authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);
// router.get("/me", protect, getMe);
export default authRouter;
