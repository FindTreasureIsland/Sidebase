document.addEventListener('DOMContentLoaded', () => {
  const colorInput = document.getElementById('highlight-color');
  const blacklistEl = document.getElementById('blacklist');
  const saveButton = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get(['highlightColor', 'blacklist'], (data) => {
    colorInput.value = data.highlightColor || '#0000ff'; // Default to blue
    blacklistEl.value = (data.blacklist || []).join('\n');
  });

  // Save settings
  saveButton.addEventListener('click', () => {
    const color = colorInput.value;
    const blacklist = blacklistEl.value.split('\n').map(s => s.trim()).filter(Boolean);

    chrome.storage.sync.set({ highlightColor: color, blacklist: blacklist }, () => {
      statusEl.textContent = 'Settings saved.';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    });
  });
});
