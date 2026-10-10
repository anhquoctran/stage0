import { create } from 'zustand';
import type { GitTaskState } from '../types/GitTaskState';

// Task lifetime belongs to the store, never to an input dialog. Backgrounding
// changes presentation only; the invoke promise and its progress channel live on.
export const useGitTaskStore = create<GitTaskState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isBackgroundManagerOpen: false,
  setBackgroundManagerOpen: (open) => set({ isBackgroundManagerOpen: open }),
  startTask: (operation, title, repositoryPath) => {
    const running = get().tasks.find(
      (task) => task.repositoryPath === repositoryPath && task.status === 'running'
    );
    if (running) {
      get().showTask(running.id);
      throw new Error('A Git operation is already running for this repository.');
    }
    const id = crypto.randomUUID();
    set((state) => ({
      tasks: [{
        id, operation, title, repositoryPath, status: 'running',
        phase: 'Starting', progress: null, message: `Starting ${title.toLowerCase()}…`,
        error: null, startedAt: Date.now(), finishedAt: null, background: false,
        resultRepository: null,
      }, ...state.tasks.filter((task, index) => task.status === 'running' || index < 19)],
      selectedTaskId: id,
      isBackgroundManagerOpen: false,
    }));
    return id;
  },
  updateTask: (id, progress) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === id && task.status === 'running' ? {
      ...task,
      phase: progress.phase,
      progress: progress.percent !== null && Number.isFinite(progress.percent)
        ? Math.min(100, Math.max(0, progress.percent)) : null,
      message: progress.message.slice(0, 8192),
    } : task),
  })),
  completeTask: (id, message, repository) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === id && task.status === 'running' ? {
      ...task, status: 'succeeded', phase: 'Completed', progress: 100,
      message: message.slice(0, 8192), finishedAt: Date.now(), resultRepository: repository ?? null,
    } : task),
  })),
  failTask: (id, error) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === id && task.status === 'running' ? {
      ...task, status: 'failed', phase: 'Failed', progress: null,
      error: error.slice(0, 8192), finishedAt: Date.now(),
    } : task),
  })),
  runInBackground: (id) => set((state) => {
    if (!state.tasks.some((task) => task.id === id)) return state;
    return {
      tasks: state.tasks.map((task) => task.id === id ? { ...task, background: true } : task),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      isBackgroundManagerOpen: state.selectedTaskId === id || state.isBackgroundManagerOpen,
    };
  }),
  dismissTask: (id) => set((state) => {
    if (state.tasks.some((task) => task.id === id && task.status === 'running')) return state;
    const remaining = state.tasks.filter((task) => task.id !== id);
    return {
      tasks: remaining,
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      isBackgroundManagerOpen: state.isBackgroundManagerOpen && remaining.some((task) => task.background),
    };
  }),
  showTask: (id) => set((state) => {
    const task = state.tasks.find((task) => task.id === id);
    if (!task) return state;
    return task.background
      ? { selectedTaskId: null, isBackgroundManagerOpen: true }
      : { selectedTaskId: id, isBackgroundManagerOpen: false };
  }),
}));
