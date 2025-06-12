import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import taskRoutes from './routes/taskRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', taskRoutes);
app.use('/api', analyticsRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Calendar API is running!' });
});

// MongoDB connection
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in log

mongoose.connect(process.env.MONGODB_URI!)
    .then(() => {
        console.log('✅ Connected to MongoDB successfully!');

        // Start server
        app.listen(PORT, () => {
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`📍 API available at http://localhost:${PORT}`);
            console.log(`📍 Test endpoint: http://localhost:${PORT}/`);
        });
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    });

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});