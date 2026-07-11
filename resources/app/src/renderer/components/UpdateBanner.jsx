import React, { useEffect, useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!window.electronAPI?.checkAppUpdate) return;
    const timer = setTimeout(() => {
      window.electronAPI.checkAppUpdate()
        .then(info => { if (info?.updateAvailable) setUpdateInfo(info); })
        .catch(() => {});
    }, 4000); // let startup settle before hitting GitHub
    return () => clearTimeout(timer);
  }, []);

  if (!updateInfo || dismissed) return null;

  const install = async () => {
    if (!updateInfo.downloadUrl) return;
    setInstalling(true);
    const unsubscribe = window.electronAPI?.onUpdateProgress((percent) => setProgress(percent));
    try {
      window.showToast?.('Downloading update...', 'info');
      await window.electronAPI?.installAppUpdate(updateInfo.downloadUrl);
    } catch (e) {
      window.showToast?.(`Failed to install update: ${e.message}`, 'error');
      setInstalling(false);
    } finally {
      unsubscribe?.();
    }
  };

  return (
    <div className="sp-update-banner">
      {!installing ? (
        <>
          <div className="sp-update-banner-icon"><Download size={16} /></div>
          <div className="sp-update-banner-text">
            <p className="sp-update-banner-title">Update available — v{updateInfo.version}</p>
            <p className="sp-update-banner-sub">A new version of We Plays is ready to install.</p>
          </div>
          <button className="sp-update-banner-btn" onClick={install}>Install</button>
          <button className="sp-update-banner-close" onClick={() => setDismissed(true)} title="Dismiss"><X size={14} /></button>
        </>
      ) : (
        <>
          <div className="sp-update-banner-icon"><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /></div>
          <div className="sp-update-banner-text">
            <p className="sp-update-banner-title">Downloading update…</p>
            <p className="sp-update-banner-sub">{progress}% — the app will restart automatically.</p>
          </div>
        </>
      )}
    </div>
  );
}
