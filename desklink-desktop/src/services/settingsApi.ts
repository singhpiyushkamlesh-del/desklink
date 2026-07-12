export async function getClipboardSyncEnabled(): Promise<boolean> {
  if (!window.desklink?.getClipboardSyncEnabled) return true;
  return window.desklink.getClipboardSyncEnabled();
}

export async function setClipboardSyncEnabled(enabled: boolean): Promise<boolean> {
  if (!window.desklink?.setClipboardSyncEnabled) return enabled;
  return window.desklink.setClipboardSyncEnabled(enabled);
}
