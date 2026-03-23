export default function SettingsView({ onReimport }) {
  return (
    <div className="view settings-view">
      <h1>Settings</h1>
      <div className="card">
        <button className="btn btn-secondary w-full" onClick={onReimport}>
          Re-import CSV
        </button>
      </div>
    </div>
  );
}
