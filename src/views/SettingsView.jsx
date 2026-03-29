import { useState, useMemo } from 'react';
import {
  notificationsSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  saveReminderConfig,
} from '../storage/push';
import { downloadICS } from '../utils/ics';
import { readLS } from '../storage/index';
import { useSettings } from '../hooks/useSettings';
import { FolderOpen, Download, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { writeLS } from '../storage/index';
import { flushPendingPushes } from '../storage/sync';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
  ROUTE_EDIT_TEMPLATE,
} from '../constants';

export default function SettingsView({
  onReimport,
  templateList,
  deleteTemplate,
  renameTemplate,
  duplicateTemplate,
  navigate,
  onClearAllData,
  syncStatus,
  lastSynced,
  onPullSync,
  onPushSync,
}) {
  const showToast = useToast();
  const { settings, updateSettings } = useSettings();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [reminderDraft, setReminderDraft] = useState(settings.reminderTime || '');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearSelections, setClearSelections] = useState({});
  const [templateSearch, setTemplateSearch] = useState('');
  const [notifStatus, setNotifStatus] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
  );
  const [notifLoading, setNotifLoading] = useState(false);

  const handleEnableNotifications = async () => {
    if (!notificationsSupported()) {
      showToast('Notifications not supported on this device', 'error');
      return;
    }
    setNotifLoading(true);
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      showToast(
        permission === 'denied'
          ? 'Notifications blocked — enable in browser settings'
          : 'Notification permission dismissed',
        'error'
      );
      setNotifLoading(false);
      return;
    }
    const subOk = await subscribeToPush();
    showToast(
      subOk ? 'Notifications enabled!' : 'Rest timer notifications enabled (server push unavailable)'
    );
    updateSettings({ notificationsEnabled: true });
    setNotifStatus('granted');
    setNotifLoading(false);
  };

  const handleDisableNotifications = async () => {
    setNotifLoading(true);
    await unsubscribeFromPush();
    await saveReminderConfig(null);
    updateSettings({ notificationsEnabled: false, reminderTime: null });
    setNotifStatus(typeof Notification !== 'undefined' ? Notification.permission : 'unavailable');
    showToast('Notifications disabled');
    setNotifLoading(false);
  };

  const handleReminderTimeChange = async (time) => {
    const ok = await saveReminderConfig(time || null);
    updateSettings({ reminderTime: time || null });
    if (time) {
      showToast(ok ? `Reminder set for ${time}` : 'Reminder saved (server unreachable)', ok ? 'success' : 'error');
    } else {
      showToast('Workout reminder off');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const [exportUntil, setExportUntil] = useState('');

  const handleExportCalendar = () => {
    const schedule = readLS('th_schedule', {});
    const workouts = readLS('th_workouts', {});
    const filtered = Object.keys(schedule).filter(
      (d) => d >= today && (!exportUntil || d <= exportUntil)
    );
    if (filtered.length === 0) {
      showToast('No upcoming workouts in that range', 'error');
      return;
    }
    downloadICS(schedule, workouts, today, exportUntil || undefined);
    showToast(`Exported ${filtered.length} workout${filtered.length !== 1 ? 's' : ''}`);
  };

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
      reader.onload = async (ev) => {
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
              writeLS(key, data[key]); // write to LS + queue sync push
              restored++;
            }
          });
          await flushPendingPushes(); // push to server before reload
          sessionStorage.setItem('skipSync', '1'); // don't let pull overwrite restored data
          showToast(`Restored ${restored} data sections!`);
          setTimeout(() => window.location.reload(), 500); // brief delay so toast shows
        } catch {
          showToast('Invalid backup file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const clearDataLabels = {
    [LS_WORKOUTS]: 'Workouts',
    [LS_SCHEDULE]: 'Schedule',
    [LS_WORKOUT_LOGS]: 'Workout Logs',
    [LS_TEMPLATES]: 'Templates',
    [LS_YOUTUBE_LINKS]: 'YouTube Links',
    [LS_ACTIVE_SESSION]: 'Active Session',
  };

  const handleClearAll = () => {
    const keys = Object.keys(clearSelections).filter((k) => clearSelections[k]);
    setShowClearConfirm(false);
    if (keys.length === Object.keys(clearDataLabels).length) {
      onClearAllData();
    } else {
      onClearAllData(keys);
    }
    const count = keys.length;
    showToast(`Cleared ${count} data section${count !== 1 ? 's' : ''}`);
  };

  const toggleClearSelection = (key) => {
    setClearSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedClearCount = Object.values(clearSelections).filter(Boolean).length;
  const allSelected = selectedClearCount === Object.keys(clearDataLabels).length;

  return (
    <div className="view settings-view">
      <div className="settings-view__header">
        <h1>Settings</h1>
      </div>

      <div className="settings-view__content">
        {/* Workout section */}
        <div className="card">
          <h3 className="mb-md">Workout</h3>
          <p className="text-secondary text-sm mb-sm">Default rest duration</p>
          <div className="settings-view__rest-options">
            {[30, 60, 90, 120, 180].map((s) => (
              <button
                key={s}
                className={`btn btn-small${settings.restDuration === s ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => updateSettings({ restDuration: s })}
              >
                {s < 60 ? `${s}s` : `${s / 60}min`}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications section */}
        <div className="card">
          <h3 className="mb-md">Notifications</h3>
          {!notificationsSupported() ? (
            !window.isSecureContext ? (
              <p className="text-secondary text-sm">
                Notifications require HTTPS. Access the app via your Tailscale HTTPS address (e.g. <strong>https://…ts.net</strong>) and add it to your Home Screen.
              </p>
            ) : (
              <p className="text-secondary text-sm">
                Not supported on this browser. On iPhone, add the app to your Home Screen first, then enable notifications.
              </p>
            )
          ) : notifStatus === 'denied' ? (
            <p className="text-secondary text-sm">
              Notifications are blocked. Enable them in your browser or OS settings, then reload.
            </p>
          ) : settings.notificationsEnabled ? (
            <>
              <p className="text-secondary text-sm mb-md">
                Rest timer notifications are on. You'll also get a daily workout reminder if a time is set below.
              </p>
              <div className="settings-view__reminder-row">
                <label className="text-sm">Daily workout reminder</label>
                <input
                  type="time"
                  className="input settings-view__reminder-time"
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                />
              </div>
              <div className="settings-view__reminder-actions mt-sm">
                <button
                  className="btn btn-primary btn-small"
                  disabled={!reminderDraft || reminderDraft === settings.reminderTime}
                  onClick={() => handleReminderTimeChange(reminderDraft)}
                >
                  Set Reminder
                </button>
                {settings.reminderTime && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => { setReminderDraft(''); handleReminderTimeChange(''); }}
                  >
                    Turn off
                  </button>
                )}
              </div>
              {settings.reminderTime && (
                <p className="text-secondary text-sm mt-sm">
                  Currently set for {settings.reminderTime}
                </p>
              )}
              <button
                className="btn btn-secondary w-full mt-md"
                onClick={handleDisableNotifications}
                disabled={notifLoading}
              >
                {notifLoading ? 'Disabling…' : 'Disable All Notifications'}
              </button>
            </>
          ) : (
            <>
              <p className="text-secondary text-sm mb-md">
                Get notified when your rest timer finishes — works even when the app is in the background.
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={handleEnableNotifications}
                disabled={notifLoading}
              >
                {notifLoading ? 'Enabling…' : 'Enable Notifications'}
              </button>
            </>
          )}
        </div>

        {/* Sync section */}
        <div className="card">
          <h3 className="mb-md">NAS Sync</h3>
          <div className="settings-view__sync-status">
            <span className={`sync-dot sync-dot--${syncStatus}`} />
            <span className="text-sm">
              {syncStatus === 'online'
                ? 'Connected'
                : syncStatus === 'checking'
                ? 'Checking...'
                : 'Offline'}
            </span>
            {lastSynced && (
              <span className="text-secondary text-sm" style={{ marginLeft: 'auto' }}>
                Last synced: {new Date(lastSynced).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="settings-view__data-actions mt-md">
            <button className="btn btn-secondary w-full" onClick={onPullSync}>
              Pull from Server
            </button>
            <button className="btn btn-secondary w-full" onClick={onPushSync}>
              Push to Server
            </button>
          </div>
          <p className="text-secondary text-sm mt-sm" style={{ fontSize: '11px' }}>
            Data syncs automatically in background. Use these buttons for manual sync.
          </p>
        </div>

        {/* Data section */}
        <div className="card">
          <h3 className="mb-md">Data</h3>
          <p className="text-secondary text-sm mb-sm">Export to Calendar</p>
          <div className="settings-view__reminder-row mb-sm">
            <label className="text-sm">From</label>
            <input
              type="date"
              className="input settings-view__reminder-time"
              value={today}
              disabled
            />
          </div>
          <div className="settings-view__reminder-row mb-md">
            <label className="text-sm">Until</label>
            <input
              type="date"
              className="input settings-view__reminder-time"
              value={exportUntil}
              min={today}
              onChange={(e) => setExportUntil(e.target.value)}
              placeholder="No end date"
            />
          </div>
          <div className="settings-view__data-actions">
            <button
              className="btn btn-secondary w-full"
              onClick={handleExportCalendar}
            >
              <Download size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Export Schedule (.ics)
            </button>
          </div>
          <p className="text-secondary text-sm mt-sm mb-md" style={{ fontSize: '11px' }}>
            Imports into Apple Calendar, Google Calendar, or Outlook. Leave "Until" blank to export all future workouts.
          </p>
          <div className="settings-view__data-actions">
            <button className="btn btn-secondary w-full" onClick={onReimport}>
              <FolderOpen size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Re-import CSV
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleExportBackup}
            >
              <Download size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Export Backup (JSON)
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleImportBackup}
            >
              <Upload size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Restore from Backup
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
            onClick={() => {
              setClearSelections({
                [LS_WORKOUTS]: true,
                [LS_SCHEDULE]: true,
                [LS_WORKOUT_LOGS]: true,
                [LS_TEMPLATES]: true,
                [LS_YOUTUBE_LINKS]: true,
                [LS_ACTIVE_SESSION]: true,
              });
              setShowClearConfirm(true);
            }}
          >
            Clear Data...
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
              <input
                type="text"
                className="input"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                style={{ marginBottom: 'var(--space-md)' }}
              />
              {templateList
                .filter((tpl) =>
                  tpl.name.toLowerCase().includes(templateSearch.toLowerCase())
                )
                .map((tpl) => {
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
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
                            className="btn btn-primary btn-small"
                            onClick={() => navigate(ROUTE_EDIT_TEMPLATE, { templateId: tpl.id })}
                          >
                            Edit
                          </button>
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
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal__title">Clear Data</h2>
            <p className="modal__message" style={{ marginBottom: 'var(--space-md)' }}>
              Select which data to delete. This cannot be undone.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600, paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)' }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    const next = !allSelected;
                    const updated = {};
                    Object.keys(clearDataLabels).forEach((k) => { updated[k] = next; });
                    setClearSelections(updated);
                  }}
                />
                Select All
              </label>
              {Object.entries(clearDataLabels).map(([key, label]) => (
                <label
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
                >
                  <input
                    type="checkbox"
                    checked={!!clearSelections[key]}
                    onChange={() => toggleClearSelection(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="modal__actions flex gap-md">
              <button className="btn btn-secondary flex-1" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger flex-1"
                onClick={handleClearAll}
                disabled={selectedClearCount === 0}
              >
                Delete{selectedClearCount > 0 ? ` (${selectedClearCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
