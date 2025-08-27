import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './src/config/db.js';
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = `.env.${NODE_ENV}`;

dotenv.config({ path: envFile });

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(process.env.MONGO_URI);
  await connectDB()
    .then(() => {
      console.log('Database connected successfully');
    })
    .catch((error) => {
      console.error('Database connection failed:', error);
      process.exit(1);
    });
  console.log(`Server is running on port ${PORT}`);
});
