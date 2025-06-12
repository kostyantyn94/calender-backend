import { Request, Response, RequestHandler } from 'express';
import Task, { ITask, RecurrenceRule } from '../models/Task';

// Utility function to generate recurring dates
const generateRecurringDates = (startDate: Date, recurrence: RecurrenceRule, endDate: Date): Date[] => {
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    let count = 0;
    
    while (currentDate <= endDate && (!recurrence.count || count < recurrence.count)) {
        dates.push(new Date(currentDate));
        
        switch (recurrence.type) {
            case 'daily':
                currentDate.setDate(currentDate.getDate() + recurrence.interval);
                break;
            case 'weekly':
                // For weekly, if weekdays are specified, generate for those days
                if (recurrence.weekdays && recurrence.weekdays.length > 0) {
                    let nextWeekday = false;
                    for (let i = 1; i <= 7; i++) {
                        const testDate = new Date(currentDate);
                        testDate.setDate(testDate.getDate() + i);
                        if (recurrence.weekdays.includes(testDate.getDay())) {
                            currentDate = testDate;
                            nextWeekday = true;
                            break;
                        }
                    }
                    if (!nextWeekday) {
                        currentDate.setDate(currentDate.getDate() + 7 * recurrence.interval);
                    }
                } else {
                    currentDate.setDate(currentDate.getDate() + 7 * recurrence.interval);
                }
                break;
            case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + recurrence.interval);
                break;
            case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + recurrence.interval);
                break;
            default:
                return dates;
        }
        
        count++;
        
        // Safety check to prevent infinite loops
        if (count > 1000) {
            console.warn('Stopping recurring task generation at 1000 instances');
            break;
        }
    }
    
    return dates;
};

// Get all tasks for a specific month
export const getTasksByMonth: RequestHandler = async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            res.status(400).json({ error: 'Year and month are required' });
            return;
        }

        // Create date range for the month
        const startDate = new Date(Number(year), Number(month) - 1, 1);
        const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

        const tasks = await Task.find({
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ date: 1, order: 1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

// Create a new task
export const createTask: RequestHandler = async (req, res) => {
    try {
        const { title, description, date, priority, recurrence } = req.body;

        console.log('Received task data:', req.body); // Debug log

        if (!title || !date) {
            res.status(400).json({ error: 'Title and date are required' });
            return;
        }

        // Parse date to ensure it's valid
        const taskDate = new Date(date);
        console.log('Parsed date:', taskDate); // Debug log

        // Get the highest order for tasks on the same date
        const tasksOnDate = await Task.find({
            date: {
                $gte: new Date(taskDate.setHours(0, 0, 0, 0)),
                $lt: new Date(taskDate.setHours(23, 59, 59, 999))
            }
        }).sort({ order: -1 }).limit(1);

        const highestOrder = tasksOnDate.length > 0 ? tasksOnDate[0].order : -1;

        const task = new Task({
            title,
            description: description || '',
            date: new Date(date),
            order: highestOrder + 1,
            priority: priority || 'medium',
            completed: false,
            recurrence: recurrence || { type: 'none', interval: 1 },
            isRecurring: recurrence && recurrence.type !== 'none'
        });

        const savedTask = await task.save();
        console.log('Task saved:', savedTask); // Debug log
        res.status(201).json(savedTask);
    } catch (error) {
        console.error('Error creating task:', error); // Debug log
        res.status(500).json({ error: 'Failed to create task' });
    }
};

// Update a task
export const updateTask: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, date, order, priority, completed, recurrence } = req.body;

        const updateData: any = { 
            title, 
            description, 
            date, 
            order, 
            priority, 
            completed 
        };

        // Handle recurrence updates
        if (recurrence !== undefined) {
            updateData.recurrence = recurrence;
            updateData.isRecurring = recurrence && recurrence.type !== 'none';
        }

        const task = await Task.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
};

// Delete a task
export const deleteTask: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findByIdAndDelete(id);

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
};

// Generate recurring task instances
export const generateRecurringInstances: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.body;

        console.log(`Generating recurring instances for task ${id} from ${startDate} to ${endDate}`);

        // Find the parent task
        const parentTask = await Task.findById(id);
        if (!parentTask) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        if (!parentTask.recurrence || parentTask.recurrence.type === 'none') {
            res.status(400).json({ error: 'Task is not recurring' });
            return;
        }

        // Generate dates for recurring instances
        const recurringDates = generateRecurringDates(
            parentTask.date,
            parentTask.recurrence,
            new Date(endDate)
        );

        console.log(`Generated ${recurringDates.length} recurring dates`);

        // Filter dates to only include those in the requested range
        const filteredDates = recurringDates.filter(date => 
            date >= new Date(startDate) && date <= new Date(endDate)
        );

        // Remove the original date to avoid duplicates
        const instanceDates = filteredDates.filter(date => 
            date.toDateString() !== parentTask.date.toDateString()
        );

        console.log(`Creating ${instanceDates.length} instances after filtering`);

        // Create task instances
        const instances = await Promise.all(
            instanceDates.map(async (date, index) => {
                // Get highest order for this date
                const tasksOnDate = await Task.find({
                    date: {
                        $gte: new Date(date.setHours(0, 0, 0, 0)),
                        $lt: new Date(date.setHours(23, 59, 59, 999))
                    }
                }).sort({ order: -1 }).limit(1);

                const highestOrder = tasksOnDate.length > 0 ? tasksOnDate[0].order : -1;

                const instance = new Task({
                    title: parentTask.title,
                    description: parentTask.description,
                    date: date,
                    order: highestOrder + 1,
                    priority: parentTask.priority,
                    completed: false,
                    parentTaskId: parentTask._id,
                    isRecurring: false // Instances are not recurring themselves
                });

                return await instance.save();
            })
        );

        console.log(`Created ${instances.length} recurring task instances`);
        res.json(instances);
    } catch (error) {
        console.error('Error generating recurring instances:', error);
        res.status(500).json({ error: 'Failed to generate recurring instances' });
    }
};

// Reorder tasks
export const reorderTasks: RequestHandler = async (req, res) => {
    try {
        const { tasks } = req.body;

        console.log('Reorder request:', tasks); // Debug log

        if (!Array.isArray(tasks)) {
            res.status(400).json({ error: 'Tasks array is required' });
            return;
        }

        // Update each task with new order and date
        const updatePromises = tasks.map((task: { id: string; order: number; date: string }) => {
            console.log(`Updating task ${task.id} with order ${task.order} and date ${task.date}`); // Debug log

            return Task.findByIdAndUpdate(
                task.id,
                {
                    order: task.order,
                    date: new Date(task.date)
                },
                { new: true }
            );
        });

        const updatedTasks = await Promise.all(updatePromises);

        // Filter out any null results (in case a task wasn't found)
        const validTasks = updatedTasks.filter(task => task !== null);

        console.log('Updated tasks:', validTasks); // Debug log
        res.json(validTasks);
    } catch (error) {
        console.error('Error in reorderTasks:', error); // Debug log
        res.status(500).json({ error: 'Failed to reorder tasks' });
    }
};