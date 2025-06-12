import express from 'express';
import {
    getTasksByMonth,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    generateRecurringInstances
} from '../controllers/taskController';

const router = express.Router();

// GET /api/tasks?year=2024&month=3
router.get('/tasks', getTasksByMonth);

// POST /api/tasks
router.post('/tasks', createTask);

// PUT /api/tasks/reorder - ВАЖНО: этот маршрут должен быть ПЕРЕД /:id
router.put('/tasks/reorder', reorderTasks);

// POST /api/tasks/:id/generate-recurring - Generate recurring task instances
router.post('/tasks/:id/generate-recurring', generateRecurringInstances);

// PUT /api/tasks/:id
router.put('/tasks/:id', updateTask);

// DELETE /api/tasks/:id
router.delete('/tasks/:id', deleteTask);

export default router;