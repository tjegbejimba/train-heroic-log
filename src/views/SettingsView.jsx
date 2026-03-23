import { useState, useMemo } from 'react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
} from '../constants';

export default function SettingsView({
  onReimport,
  templateList,
  deleteTemplate,
  renameTemplate,
  duplicateTemplate,
  onClearAllData,
}) {
  const showToast = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleStartRename = (tpl) => {
    setRenamingId(tpl.id);
    setRenameDraft(tpl.name);
  };

  const handleSaveRename = () => {
    if (renameDraft.trim()) {
      renameTemplate(renamingId, renameDraft.trim());
      showToast('Template renamed');
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteTemplate(deleteTarget);
      setDeleteTarget(null);
      showToast('Template deleted');
    }
  };

  const handleDuplicate = (id) => {
    duplicateTemplate(id);
    showToast('Template duplicated');
  };

  // Storage usage
  const storageUsage = useMemo(() => {
    let total = 0;
    const keys = [
      LS_WORKOUTS,
      LS_SCHEDULE,
      LS_YOUTUBE_LINKS,
      LS_WORKOUT_LOGS,
      LS_ACTIVE_SESSION,
      LS_TEMPLATES,
    ];
    keys.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) total += val.length * 2; // UTF-16 = 2 bytes per char
    });
    return total;
  }, [templateList]); // re-calc when templates change

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleExportBackup = () => {
    const backup = {};
    [LS_WORKOUTS, LS_SCHEDULE, LS_YOUTUBE_LINKS, LS_WORKOUT_LOGS, LS_TEMPLATES].forEach(
      (key) => {
        const val = localStorage.getItem(key);
        if (val) backup[key] = JSON.parse(val);
      }
    );

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trainlog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported!');
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          const validKeys = [
            LS_WORKOUTS,
            LS_SCHEDULE,
            LS_YOUTUBE_LINKS,
            LS_WORKOUT_LOGS,
            LS_TEMPLATES,
          ];
          let restored = 0;
          validKeys.forEach((key) => {
            if (data[key]) {
              localStorage.setItem(key, JSON.stringify(data[key]));
              restored++;
            }
          });
          showToast(`Restored ${restored} data sections. Reload to apply.`, 'info', 4000);
        } catch {
          showToast('Invalid backup file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearAll = () => {
    setShowClearConfirm(false);
    onClearAllData();
    showToast('All data cleared');
  };

  return (
    <div className="view settings-view">
      <div className="settings-view__header">
        <h1>Settings</h1>
      </div>

      <div className="settings-view__content">
        {/* Data section */}
        <div className="card">
          <h3 className="mb-md">Data</h3>
          <div className="settings-view__data-actions">
            <button className="btn btn-secondary w-full" onClick={onReimport}>
              📂 Re-import CSV
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleExportBackup}
            >
              📦 Export Backup (JSON)
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleImportBackup}
            >
              📥 Restore from Backup
            </button>
          </div>
          <div className="settings-view__storage mt-lg">
            <div className="flex-between">
              <span className="text-secondary text-sm">Storage used</span>
              <span className="text-sm">{formatBytes(storageUsage)}</span>
            </div>
            <div className="settings-view__storage-bar mt-sm">
              <div
                className="settings-view__storage-fill"
                style={{
                  width: `${Math.min((storageUsage / (5 * 1024 * 1024)) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-secondary text-sm mt-sm" style={{ fontSize: '11px' }}>
              ~5 MB localStorage limit
            </p>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card">
          <h3 className="mb-md text-red">Danger Zone</h3>
          <button
            className="btn btn-danger w-full"
            onClick={() => setShowClearConfirm(true)}
          >
            Clear All Data
          </button>
        </div>

        {/* Templates section */}
        <div className="card">
          <h3 className="mb-md">
            Templates ({templateList ? templateList.length : 0})
          </h3>

          {!templateList || templateList.length === 0 ? (
            <p className="text-secondary text-sm">
              No templates yet. Save a workout as a template from the Training
              view.
            </p>
          ) : (
            <div className="settings-templates">
              {templateList.map((tpl) => {
                const isExpanded = expandedId === tpl.id;
                const exerciseCount = tpl.blocks.reduce(
                  (sum, b) => sum + b.exercises.length,
                  0
                );

                return (
                  <div key={tpl.id} className="settings-template-item">
                    <div className="settings-template-item__header">
                      {renamingId === tpl.id ? (
                        <div className="settings-template-item__rename">
                          <input
                            type="text"
                            className="input"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            autoFocus
                          />
                          <button
                            className="btn btn-primary btn-small"
                            onClick={handleSaveRename}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          className="settings-template-item__toggle"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : tpl.id)
                          }
                        >
                          <div>
                            <div className="settings-template-item__name">
                              {tpl.name}
                            </div>
                            <div className="text-secondary text-sm">
                              {exerciseCount} exercises
                            </div>
                          </div>
                          <span>{isExpanded ? '▾' : '▸'}</span>
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="settings-template-item__details">
                        <div className="settings-template-item__exercises">
                          {tpl.blocks.map((block, bIdx) =>
                            block.exercises.map((ex, eIdx) => (
                              <div
                                key={`${bIdx}-${eIdx}`}
                                className="text-sm text-secondary"
                              >
                                {ex.title} — {ex.sets.length} sets
                              </div>
                            ))
                          )}
                        </div>
                        <div className="settings-template-item__actions">
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleStartRename(tpl)}
                          >
                            Rename
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleDuplicate(tpl.id)}
                          >
                            Duplicate
                          </button>
                          <button
                            className="btn btn-secondary btn-small settings-template-item__delete-btn"
                            onClick={() => setDeleteTarget(tpl.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* App info */}
        <div className="card">
          <div className="text-secondary text-sm text-center">
            TrainLog v0.1.0
          </div>
        </div>
      </div>

      {deleteTarget && (
        <Modal
          title="Delete Template?"
          message="This will permanently remove this template."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Delete"
          cancelText="Keep"
        />
      )}

      {showClearConfirm && (
        <Modal
          title="Clear All Data?"
          message="This will delete all workouts, logs, templates, and settings. This cannot be undone. Export a backup first!"
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
          confirmText="Delete Everything"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
