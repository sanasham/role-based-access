import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    const options = {
      // Connection options for production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      //bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`
📊 MongoDB Connected Successfully!
🏠 Host: ${conn.connection.host}
🗄️  Database: ${conn.connection.name}
🌐 Port: ${conn.connection.port}
📈 Ready State: ${
      conn.connection.readyState === 1 ? 'Connected' : 'Not Connected'
    }
    `);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);

    // Log specific MongoDB errors
    if (error.name === 'MongoNetworkError') {
      console.error(
        'Network error: Check if MongoDB is running and accessible'
      );
    } else if (error.name === 'MongoParseError') {
      console.error('Connection string error: Check MONGODB_URI format');
    } else if (error.name === 'MongoServerError') {
      console.error('MongoDB server error: Check database permissions');
    }

    process.exit(1);
  }
};

// MongoDB connection state checker
export const checkDBConnection = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    state: states[state],
    isConnected: state === 1,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
};

// Database health check
export const dbHealthCheck = async () => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();

    return {
      status: 'healthy',
      ping: result.ok === 1,
      connection: checkDBConnection(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      connection: checkDBConnection(),
      timestamp: new Date().toISOString(),
    };
  }
};

export default connectDB;
