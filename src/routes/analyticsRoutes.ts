import express from 'express';
import {
    getAnalytics,
    getCompletionTrends
} from '../controllers/analyticsController';

const router = express.Router();

// GET /api/analytics?days=30
router.get('/analytics', getAnalytics);

// GET /api/analytics/trends?period=daily&days=30
router.get('/analytics/trends', getCompletionTrends);

export default router; 