import { Request, Response, RequestHandler } from 'express';
import Task, { ITask } from '../models/Task';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Get comprehensive analytics data
export const getAnalytics: RequestHandler = async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysCount = Math.min(Number(days), 365); // Limit to 1 year max
        
        const endDate = new Date();
        const startDate = subDays(endDate, daysCount);

        console.log(`Fetching analytics for ${daysCount} days from ${startDate} to ${endDate}`);

        // Get all tasks in the date range
        const tasks = await Task.find({
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ createdAt: 1 });

        // Basic completion stats
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed).length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const overdueTasks = tasks.filter(task => 
            !task.completed && new Date(task.date) < new Date()
        ).length;

        const completionStats = {
            totalTasks,
            completedTasks,
            completionRate: Math.round(completionRate * 100) / 100,
            overdueTasks
        };

        // Priority stats
        const priorityStats = ['low', 'medium', 'high', 'urgent'].map(priority => {
            const priorityTasks = tasks.filter(task => task.priority === priority);
            const completedPriorityTasks = priorityTasks.filter(task => task.completed);
            const priorityCompletionRate = priorityTasks.length > 0 
                ? (completedPriorityTasks.length / priorityTasks.length) * 100 
                : 0;

            return {
                priority,
                total: priorityTasks.length,
                completed: completedPriorityTasks.length,
                completionRate: Math.round(priorityCompletionRate * 100) / 100
            };
        });

        // Daily stats
        const dailyStatsMap = new Map();
        const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
        
        // Initialize all dates with 0
        dateRange.forEach(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            dailyStatsMap.set(dateStr, {
                date: dateStr,
                tasksCreated: 0,
                tasksCompleted: 0,
                completionRate: 0
            });
        });

        // Fill with actual data
        tasks.forEach(task => {
            const createdDate = format(new Date(task.createdAt), 'yyyy-MM-dd');
            const dayStats = dailyStatsMap.get(createdDate);
            if (dayStats) {
                dayStats.tasksCreated++;
                if (task.completed) {
                    dayStats.tasksCompleted++;
                }
                dayStats.completionRate = dayStats.tasksCreated > 0 
                    ? Math.round((dayStats.tasksCompleted / dayStats.tasksCreated) * 10000) / 100
                    : 0;
            }
        });

        const dailyStats = Array.from(dailyStatsMap.values());

        // Weekly stats (last 12 weeks)
        const weeklyStats = [];
        for (let i = 0; i < 12; i++) {
            const weekEnd = subDays(endDate, i * 7);
            const weekStart = startOfWeek(weekEnd);
            const weekEndDate = endOfWeek(weekEnd);
            
            const weekTasks = tasks.filter(task => {
                const taskDate = new Date(task.createdAt);
                return taskDate >= weekStart && taskDate <= weekEndDate;
            });

            const weekCompleted = weekTasks.filter(task => task.completed).length;
            const weekCompletionRate = weekTasks.length > 0 
                ? (weekCompleted / weekTasks.length) * 100 
                : 0;

            weeklyStats.unshift({
                week: `${format(weekStart, 'MMM dd')} - ${format(weekEndDate, 'MMM dd')}`,
                tasksCreated: weekTasks.length,
                tasksCompleted: weekCompleted,
                completionRate: Math.round(weekCompletionRate * 100) / 100,
                averageTasksPerDay: Math.round((weekTasks.length / 7) * 100) / 100
            });
        }

        // Monthly stats (last 6 months)
        const monthlyStats = [];
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            
            const monthTasks = tasks.filter(task => {
                const taskDate = new Date(task.createdAt);
                return taskDate >= monthStart && taskDate <= monthEnd;
            });

            const monthCompleted = monthTasks.filter(task => task.completed).length;
            const monthCompletionRate = monthTasks.length > 0 
                ? (monthCompleted / monthTasks.length) * 100 
                : 0;
            const daysInMonth = monthEnd.getDate();

            monthlyStats.unshift({
                month: format(monthDate, 'MMM yyyy'),
                tasksCreated: monthTasks.length,
                tasksCompleted: monthCompleted,
                completionRate: Math.round(monthCompletionRate * 100) / 100,
                averageTasksPerDay: Math.round((monthTasks.length / daysInMonth) * 100) / 100
            });
        }

        // Heatmap data (GitHub-style)
        const heatmapData = dateRange.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayTasks = tasks.filter(task => 
                format(new Date(task.createdAt), 'yyyy-MM-dd') === dateStr
            );
            const completedCount = dayTasks.filter(task => task.completed).length;
            
            // Calculate intensity level (0-4)
            const level = completedCount === 0 ? 0 :
                        completedCount <= 2 ? 1 :
                        completedCount <= 4 ? 2 :
                        completedCount <= 6 ? 3 : 4;

            return {
                date: dateStr,
                count: completedCount,
                level
            };
        });

        // Streak calculation
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastCompletionDate = null;

        // Sort daily stats by date descending to calculate current streak
        const sortedDailyStats = [...dailyStats].reverse();
        
        for (const dayStats of sortedDailyStats) {
            if (dayStats.tasksCompleted > 0) {
                if (currentStreak === 0) {
                    lastCompletionDate = dayStats.date;
                }
                currentStreak++;
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                if (currentStreak > 0) {
                    // Only break current streak if we've started counting
                    break;
                }
                tempStreak = 0;
            }
        }

        const streakData = {
            currentStreak,
            longestStreak,
            lastCompletionDate
        };

        // Top categories (based on first word of task title)
        const categoryMap = new Map();
        tasks.forEach(task => {
            const firstWord = task.title.split(' ')[0].toLowerCase();
            if (firstWord.length > 2) { // Only count meaningful words
                categoryMap.set(firstWord, (categoryMap.get(firstWord) || 0) + 1);
            }
        });

        const topCategories = Array.from(categoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Calculate average tasks per day
        const averageTasksPerDay = totalTasks > 0 
            ? Math.round((totalTasks / daysCount) * 100) / 100 
            : 0;

        // Calculate productivity score (0-100)
        const productivityScore = Math.round(
            (completionRate * 0.4) + // 40% completion rate
            (Math.min(averageTasksPerDay / 3, 1) * 30) + // 30% task volume (max 3 tasks/day = 100%)
            (Math.min(currentStreak / 7, 1) * 20) + // 20% current streak (max 7 days = 100%)
            (priorityStats.find(p => p.priority === 'high')?.completionRate || 0) * 0.1 // 10% high priority completion
        );

        const analyticsData = {
            completionStats,
            priorityStats,
            dailyStats,
            weeklyStats,
            monthlyStats,
            heatmapData,
            streakData,
            topCategories,
            averageTasksPerDay,
            productivityScore: Math.round(productivityScore * 100) / 100
        };

        console.log('Analytics data generated successfully');
        res.json(analyticsData);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
};

// Get task completion trends
export const getCompletionTrends: RequestHandler = async (req, res) => {
    try {
        const { period = 'daily', days = 30 } = req.query;
        const daysCount = Math.min(Number(days), 365);
        
        const endDate = new Date();
        const startDate = subDays(endDate, daysCount);

        const tasks = await Task.find({
            updatedAt: {
                $gte: startDate,
                $lte: endDate
            },
            completed: true
        }).sort({ updatedAt: 1 });

        let trends: { date: string; completions: number }[] = [];

        if (period === 'daily') {
            const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
            trends = dateRange.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayCompletions = tasks.filter(task => 
                    format(new Date(task.updatedAt), 'yyyy-MM-dd') === dateStr
                ).length;

                return {
                    date: dateStr,
                    completions: dayCompletions
                };
            });
        }

        res.json(trends);
    } catch (error) {
        console.error('Error fetching completion trends:', error);
        res.status(500).json({ error: 'Failed to fetch completion trends' });
    }
}; 