const fs = require('fs');
const path = require('path');
const { updateChapterData } = require('./update-chapters-data');

const projectRoot = path.resolve(__dirname, '..');
const watchedFolders = ['images/battleofthebooks', 'images/murdermystery'];
const watchers = [];

function refresh() {
  updateChapterData();
}

watchedFolders.forEach((folder) => {
  const folderPath = path.join(projectRoot, folder);
  if (!fs.existsSync(folderPath)) {
    console.log(`Folder not found: ${folderPath}`);
    return;
  }

  const watcher = fs.watch(folderPath, { persistent: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.startsWith('.')) return;
    console.log(`[chapters watcher] ${eventType}: ${filename}`);
    refresh();
  });

  watchers.push(watcher);
  console.log(`Watching ${folderPath}`);
});

refresh();
console.log('Watching chapters image folders for changes. Press Ctrl+C to stop.');

process.on('SIGINT', () => {
  watchers.forEach((watcher) => watcher.close());
  process.exit(0);
});
