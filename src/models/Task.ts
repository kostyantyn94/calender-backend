import mongoose, { Schema, Document } from 'mongoose';

// Recurrence types
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
    type: RecurrenceType;
    interval: number; // Every N days/weeks/months/years
    endDate?: Date; // Optional end date
    count?: number; // Optional max occurrences
    weekdays?: number[]; // For weekly: 0=Sunday, 1=Monday, etc.
}

// Task interface
export interface ITask extends Document {
    title: string;
    description?: string;
    date: Date;
    order: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
    // Recurrence fields
    recurrence?: RecurrenceRule;
    parentTaskId?: mongoose.Types.ObjectId; // For recurring task instances
    isRecurring?: boolean;
}

// Recurrence rule schema
const RecurrenceRuleSchema: Schema = new Schema({
    type: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'none'
    },
    interval: {
        type: Number,
        default: 1,
        min: 1
    },
    endDate: {
        type: Date,
        required: false
    },
    count: {
        type: Number,
        required: false,
        min: 1
    },
    weekdays: {
        type: [Number],
        required: false,
        validate: {
            validator: function(weekdays: number[]) {
                return weekdays.every(day => day >= 0 && day <= 6);
            },
            message: 'Weekdays must be between 0 (Sunday) and 6 (Saturday)'
        }
    }
}, { _id: false });

// Task schema
const TaskSchema: Schema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        date: {
            type: Date,
            required: true
        },
        order: {
            type: Number,
            required: true,
            default: 0
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
        },
        completed: {
            type: Boolean,
            default: false
        },
        // Recurrence fields
        recurrence: {
            type: RecurrenceRuleSchema,
            required: false
        },
        parentTaskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            required: false
        },
        isRecurring: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Create index for better query performance
TaskSchema.index({ date: 1, order: 1 });
TaskSchema.index({ parentTaskId: 1 }); // Index for recurring task instances

export default mongoose.model<ITask>('Task', TaskSchema);