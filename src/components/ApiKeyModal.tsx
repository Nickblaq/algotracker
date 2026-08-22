import { useState } from 'react';

interface Props {
  visible: boolean;
  onSetKey: (key: string) => void;
  onClose: () => void;
}

export function ApiKeyModal({ visible, onSetKey, onClose }: Props) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect to OpenRouter</h2>
          <button className="btn btn-ghost modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Enter your OpenRouter API key to power the LLM conversations.
            The key stays in your browser and is never stored on any server.
          </p>
          <div className="api-key-input-group">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="input api-key-input"
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Skip for now</button>
          <button
            className="btn btn-primary"
            onClick={() => onSetKey(key)}
            disabled={!key.trim()}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
