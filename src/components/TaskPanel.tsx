import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api';
import type { TaskEntry, AgentInfo } from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308',
  running: '#2563EB',
  completed: '#16A34A',
  failed: '#DC2626',
  cancelled: '#94A3B8',
};

const STEP_STATUS_ICONS: Record<string, string> = {
  pending: '○',
  running: '◎',
  done: '✓',
  failed: '✕',
  skipped: '–',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function TaskPanel() {
  const [taskList, setTaskList] = useState<TaskEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskEntry | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState('');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const statusFilter = filter === 'all' ? undefined : filter;
      const res = await api.tasks.list(statusFilter);
      setTaskList(res.tasks);
    } catch { /* ignore */ }
    try {
      const agRes = await api.agents.list();
      setAgents(agRes);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCreate = async () => {
    if (!createType) return;
    setLoading(true);
    try {
      const inputParams: Record<string, unknown> = {};
      if (textInput.trim()) inputParams.text = textInput;
      const task = await api.tasks.create(createType, inputParams);
      await api.tasks.start(task.id);
      setShowCreate(false);
      setTextInput('');
      await refresh();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleCancel = async (uid: string) => {
    await api.tasks.cancel(uid);
    await refresh();
  };

  const handleResume = async (uid: string) => {
    await api.tasks.resume(uid);
    await refresh();
  };

  const handleRefreshTask = async (uid: string) => {
    const t = await api.tasks.get(uid);
    setSelectedTask(t);
  };

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <h2>Background Tasks</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Task'}
        </button>
      </div>

      {showCreate && (
        <div className="task-create-form">
          <select
            value={createType}
            onChange={e => setCreateType(e.target.value)}
            className="select"
          >
            <option value="">Select agent type...</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.stepCount} steps)</option>
            ))}
          </select>
          {(createType === 'knowledge_extraction') && (
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Enter text to extract knowledge from..."
              className="input"
              rows={3}
              style={{ marginTop: 8 }}
            />
          )}
          {createType === 'chat_summarization' && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Will summarize the current chat session into long-term memories.
            </p>
          )}
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8, width: '100%' }}
            onClick={handleCreate}
            disabled={!createType || loading}
          >
            {loading ? 'Creating...' : 'Create & Start'}
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="task-filters">
        {['all', 'running', 'pending', 'completed', 'failed'].map(f => (
          <button
            key={f}
            className={`tier-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="task-list">
        {taskList.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No tasks yet. Create one to get started.</p>
          </div>
        ) : (
          taskList.map(task => (
            <div
              key={task.id}
              className={`task-card ${selectedTask?.id === task.id ? 'selected' : ''}`}
              onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
            >
              <div className="task-card-header">
                <div className="task-card-title">
                  <span
                    className="task-status-dot"
                    style={{ backgroundColor: STATUS_COLORS[task.status] }}
                  />
                  <span className="task-type-label">{task.type.replace(/_/g, ' ')}</span>
                </div>
                <div className="task-card-actions">
                  {task.status === 'running' && (
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={e => { e.stopPropagation(); handleCancel(task.id); }}
                    >
                      Cancel
                    </button>
                  )}
                  {(task.status === 'failed' || task.status === 'cancelled') && (
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={e => { e.stopPropagation(); handleResume(task.id); }}
                    >
                      Resume
                    </button>
                  )}
                  <span className="task-time">{timeAgo(task.createdAt)}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="task-progress-track">
                <div
                  className="task-progress-fill"
                  style={{
                    width: `${task.progress}%`,
                    backgroundColor: STATUS_COLORS[task.status],
                  }}
                />
              </div>
              <div className="task-progress-text">
                Step {task.currentStep}/{task.totalSteps} · {task.progress}%
              </div>

              {/* Expanded: step trail */}
              {selectedTask?.id === task.id && (
                <div className="task-steps" onClick={e => e.stopPropagation()}>
                  {task.steps.map(step => (
                    <div key={step.index} className={`task-step task-step-${step.status}`}>
                      <span className="task-step-icon">{STEP_STATUS_ICONS[step.status] || '?'}</span>
                      <span className="task-step-name">{step.name.replace(/_/g, ' ')}</span>
                      <span className="task-step-status" style={{ color: STATUS_COLORS[step.status] || 'var(--text-muted)' }}>
                        {step.status}
                      </span>
                      {step.error && (
                        <span className="task-step-error">{step.error}</span>
                      )}
                    </div>
                  ))}
                  {task.errorMessage && (
                    <div className="task-error-banner">{task.errorMessage}</div>
                  )}
                  {task.result && (
                    <div className="task-result">
                      <strong>Result:</strong>
                      <pre>{JSON.stringify(task.result, null, 2)}</pre>
                    </div>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    style={{ marginTop: 8 }}
                    onClick={() => handleRefreshTask(task.id)}
                  >
                    ↻ Refresh
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
