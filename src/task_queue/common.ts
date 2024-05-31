import type { kQueueOptions } from '../symbols';

export interface TaskQueue {
    readonly size: number;
    shift(): Task | null;
    remove(task: Task): void;
    push(task: Task): void;
}

// Public Interface
export interface PiscinaTask extends Task {
    taskId: number;
    filename: string;
    name: string;
    created: number;
    isAbortable: boolean;
}

export interface Task {
    readonly [kQueueOptions]: object | null
};
