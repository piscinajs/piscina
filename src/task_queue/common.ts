import type { kQueueOptions } from '../symbols';

export interface TaskQueue {
    readonly size: number;
    shift(): Task | null;
    remove(task: Task): void;
    push(task: Task): void;
    /**
     * Prepend a task to the head of the queue, that is, enqueue it to be executed first. This is optional operation,
     * but required if you need strict FIFO ordering of tasks
     */
    unshift?(task: Task): void;
}

// Public Interface
export interface PiscinaTask extends Task {
    taskId: string;
    filename: string;
    name: string;
    created: number;
    isAbortable: boolean;
}

export interface Task {
    readonly [kQueueOptions]: object | null
};
