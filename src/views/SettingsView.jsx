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
import { getQuotaUsage, getQuotaWarning } from '../storage/quota';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Cloud,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  MessageSquare,
  ShieldAlert,
  Timer,
  Upload,
} from 'lucide-react';
import Modal from '../components/Modal';
import FeedbackModal from '../components/FeedbackModal';
import { useToast } from '../components/Toast';
import { writeLS } from '../storage/index';
import { buildBackup, BACKUP_KEYS } from '../storage/backup';
import { flushPendingPushes } from '../storage/sync';
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
  const [pendingRestore, setPendingRestore] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
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
          ? 'Notifications blocked - enable in browser settings'
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

  // Storage usage via quota module
  const storageUsage = useMemo(() => {
    const { used, estimate } = getQuotaUsage();
    const warning = getQuotaWarning(used, estimate);
    return { used, estimate, ...warning };
  }, [templateList]);

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleExportBackup = () => {
    // A complete snapshot: every required section is always present (empty ones
    // as {}) so restoring never leaves stale data behind.
    const backup = buildBackup();

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
          const keys = BACKUP_KEYS.filter(
            (key) => data[key] !== undefined && data[key] !== null
          );
          if (keys.length === 0) {
            showToast('No TrainLog data found in that file', 'error');
            return;
          }
          // Restore overwrites existing data — confirm before applying.
          setPendingRestore({ data, keys });
        } catch {
          showToast('Invalid backup file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    const { data, keys } = pendingRestore;
    keys.forEach((key) => {
      writeLS(key, data[key]); // write to LS + queue sync push
    });
    await flushPendingPushes(); // push to server before reload
    sessionStorage.setItem('skipSync', '1'); // don't let pull overwrite restored data
    setPendingRestore(null);
    showToast(`Restored ${keys.length} data section${keys.length !== 1 ? 's' : ''}!`);
    setTimeout(() => window.location.reload(), 500); // brief delay so toast shows
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
  const syncLabel =
    syncStatus === 'online' ? 'Connected' : syncStatus === 'checking' ? 'Checking...' : 'Offline';
  const storageTone =
    storageUsage.level === 'critical'
      ? 'settings-section--danger'
      : storageUsage.level === 'warning'
      ? 'settings-section--warning'
      : '';

  return (
    <div className="view settings-view">
      <div className="settings-view__header">
        <h1>Settings</h1>
        <p>Manage training defaults, sync, exports, and local data.</p>
      </div>

      <div className="settings-view__content">
        <section className="settings-section">
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><Timer size={20} /></span>
            <div>
              <h2>Training setup</h2>
              <p>Defaults and reusable structure for planning workouts.</p>
            </div>
          </div>
          <div className="settings-control">
            <div className="settings-control__label">
              <span>Default rest duration</span>
              <small>Used when an exercise does not override rest.</small>
            </div>
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
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><Bell size={20} /></span>
            <div>
              <h2>Notifications</h2>
              <p>Rest timer alerts and optional daily workout reminders.</p>
            </div>
          </div>
          {!notificationsSupported() ? (
            !window.isSecureContext ? (
              <p className="settings-section__message">
                Notifications require HTTPS. Access the app via your Tailscale HTTPS address (e.g. <strong>https://...ts.net</strong>) and add it to your Home Screen.
              </p>
            ) : (
              <p className="settings-section__message">
                Not supported on this browser. On iPhone, add the app to your Home Screen first, then enable notifications.
              </p>
            )
          ) : notifStatus === 'denied' ? (
            <p className="settings-section__message">
              Notifications are blocked. Enable them in your browser or OS settings, then reload.
            </p>
          ) : settings.notificationsEnabled ? (
            <>
              <p className="settings-section__message">
                Rest timer notifications are on. You'll also get a daily workout reminder if a time is set below.
              </p>
              <div className="settings-view__reminder-row">
                <label>Daily workout reminder</label>
                <input
                  type="time"
                  className="input settings-view__reminder-time"
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                />
              </div>
              <div className="settings-view__reminder-actions">
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
                <p className="settings-section__hint">
                  Currently set for {settings.reminderTime}
                </p>
              )}
              <button
                className="btn-text-danger w-full mt-md"
                onClick={handleDisableNotifications}
                disabled={notifLoading}
              >
                {notifLoading ? 'Disabling...' : 'Disable All Notifications'}
              </button>
            </>
          ) : (
            <>
              <p className="settings-section__message">
                Get notified when your rest timer finishes - works even when the app is in the background.
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={handleEnableNotifications}
                disabled={notifLoading}
              >
                {notifLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>
            </>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><Cloud size={20} /></span>
            <div>
              <h2>NAS sync</h2>
              <p>Offline-first data with manual pull/push controls.</p>
            </div>
          </div>
          <div className="settings-view__sync-status">
            <span className={`sync-dot sync-dot--${syncStatus}`} />
            <span>{syncLabel}</span>
            {lastSynced && (
              <span className="settings-view__last-synced">
                Last synced: {new Date(lastSynced).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="settings-view__data-actions">
            <button className="btn btn-secondary w-full" onClick={onPullSync}>
              Pull from Server
            </button>
            <button className="btn btn-secondary w-full" onClick={onPushSync}>
              Push to Server
            </button>
          </div>
          <p className="settings-section__hint">
            Data syncs automatically in background. Use these buttons for manual sync.
          </p>
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><Database size={20} /></span>
            <div>
              <h2>Data portability</h2>
              <p>Calendar export, CSV re-import, and complete backups.</p>
            </div>
          </div>
          <div className="settings-subsection">
            <div className="settings-subsection__title">
              <CalendarDays size={16} />
              <span>Export to Calendar</span>
            </div>
          </div>
          <div className="settings-view__reminder-row">
            <label>From</label>
            <input
              type="date"
              className="input settings-view__reminder-time"
              value={today}
              disabled
            />
          </div>
          <div className="settings-view__reminder-row">
            <label>Until</label>
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
              <Download size={15} />
              Export Schedule (.ics)
            </button>
          </div>
          <p className="settings-section__hint">
            Imports into Apple Calendar, Google Calendar, or Outlook. Leave "Until" blank to export all future workouts.
          </p>
          <div className="settings-view__data-actions">
            <button className="btn btn-secondary w-full" onClick={onReimport}>
              <FolderOpen size={15} />
              Re-import CSV
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleExportBackup}
            >
              <Download size={15} />
              Export Backup (JSON)
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleImportBackup}
            >
              <Upload size={15} />
              Restore from Backup
            </button>
          </div>
        </section>

        <section className={`settings-section ${storageTone}`}>
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><HardDrive size={20} /></span>
            <div>
              <h2>Storage</h2>
              <p>Local data stored on this device.</p>
            </div>
          </div>
          <div className="settings-view__storage">
            <div className="settings-view__storage-top">
              <span>Storage used</span>
              <strong>{formatBytes(storageUsage.used)} ({storageUsage.percent}%)</strong>
            </div>
            <div className="settings-view__storage-bar">
              <div
                className={`settings-view__storage-fill settings-view__storage-fill--${storageUsage.level}`}
                style={{
                  width: `${Math.min(storageUsage.percent, 100)}%`,
                }}
              />
            </div>
            {storageUsage.level === 'critical' && (
              <p className="settings-section__alert">
                <AlertTriangle size={15} />
                Storage nearly full. Consider clearing old workout logs.
              </p>
            )}
            {storageUsage.level === 'warning' && (
              <p className="settings-section__alert">
                <AlertTriangle size={15} />
                Storage usage is getting high.
              </p>
            )}
            {storageUsage.level === 'ok' && (
              <p className="settings-section__hint">
                About 5 MB of localStorage is available in most browsers.
              </p>
            )}
          </div>
        </section>

        <section className="settings-section settings-section--danger">
          <div className="settings-section__head">
            <span className="settings-section__icon" aria-hidden="true"><ShieldAlert size={20} /></span>
            <div>
              <h2>Danger zone</h2>
              <p>Remove local training data from this device.</p>
            </div>
          </div>
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
        </section>

        <section className="settings-section settings-section--about">
          <div className="settings-view__version">TrainLog v0.1.0</div>
          <button className="btn btn-secondary w-full" onClick={() => setShowFeedback(true)}>
            <MessageSquare size={15} />
              Send Feedback
          </button>
        </section>
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

      {pendingRestore && (
        <Modal
          title="Restore from backup?"
          message={`This overwrites your current data with this backup (${pendingRestore.keys.length} section${pendingRestore.keys.length !== 1 ? 's' : ''}). This can't be undone.`}
          onConfirm={handleConfirmRestore}
          onCancel={() => setPendingRestore(null)}
          confirmText="Restore"
          cancelText="Cancel"
        />
      )}

      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal__title">Clear Data</h2>
            <p className="modal__message settings-clear-modal__message">
              Select which data to delete. This cannot be undone.
            </p>
            <div className="settings-clear-modal__checks">
              <label className="settings-clear-modal__check settings-clear-modal__check--all">
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
                  className="settings-clear-modal__check"
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

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} showToast={showToast} />
      )}
    </div>
  );
}
