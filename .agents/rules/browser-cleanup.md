# Browser Process Lifecycle Rule

- **Always terminate automated browser instances**: Whenever any Chrome/Chromium instance is launched or used during a task (via browser subagent or automated browser automation), the agent must ALWAYS ensure that the spawned Chrome instance and its child processes are cleanly closed/terminated upon finishing the task.
- **No dangling browser processes**: Never leave automated browser windows, headless Chrome processes, or orphaned debugging instances running in the background.
