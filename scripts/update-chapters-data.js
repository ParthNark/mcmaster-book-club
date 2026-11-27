const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputFile = path.join(projectRoot, 'js', 'chapters-data.js');

// Past events, oldest first (chapter numbers follow this order). The page
// shows them newest first. Each folder holds up to 15 photos, resized to
// max 1600px (see README "Past event photos").
// `featured` lists group photos to use as the chapter's thumbnails, the first
// one as the large image; any free thumbnail slots are filled at random.
const CHAPTER_CONFIG = [
  { title: 'Clubfest 2025', year: 'Sept 2025', imageFolder: 'images/events/clubfest2025',
    featured: ['01.jpg'] },
  { title: 'Murder Mystery Night', year: '2025/26', imageFolder: 'images/events/murdermystery',
    featured: ['01.jpg', '12.jpg', '06.jpg'] },
  { title: 'Battle of the Books', year: '2025/26', imageFolder: 'images/events/battleofthebooks',
    featured: ['01.jpg', '09.jpg', '04.jpg'] },
  { title: 'Clubfest 2026', year: 'Sept 2026', imageFolder: 'images/events/clubfest2026',
    featured: ['01.jpg', '08.jpg', '12.jpg'] },
  { title: 'September Book Discussions', year: 'Sept 2026', imageFolder: 'images/events/septemberdiscussions',
    featured: ['01.jpg', '02.jpg', '03.jpg'] },
  { title: 'Scavenger Hunt', year: 'Sept 2026', imageFolder: 'images/events/scavengerhunt',
    featured: ['01.jpg', '06.jpg', '02.jpg'] },
  { title: 'October Discussions & Halloween Social', year: 'Oct 2026', imageFolder: 'images/events/octoberevents',
    featured: ['01.jpg', '15.jpg', '13.jpg'] }
].map((chapter, i) => ({ number: String(i + 1).padStart(2, '0'), ...chapter }));

function listImageFiles(folderPath) {
  if (!fs.existsSync(folderPath)) return [];

  return fs
    .readdirSync(folderPath)
    .filter((file) => !file.startsWith('.'))
    .filter((file) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function updateChapterData() {
  const chapters = CHAPTER_CONFIG.map((chapter) => {
    const folderPath = path.join(projectRoot, chapter.imageFolder);
    const images = listImageFiles(folderPath);
    const featured = (chapter.featured || []).filter((file) => {
      if (images.includes(file)) return true;
      console.warn(`Featured photo not found, skipping: ${chapter.imageFolder}/${file}`);
      return false;
    });
    return {
      ...chapter,
      featured,
      images
    };
  }).reverse(); // newest chapter at the top of the page

  const content = `var CHAPTERS_DATA = ${JSON.stringify(chapters, null, 2)};\n`;
  fs.writeFileSync(outputFile, content, 'utf8');

  const totalImages = chapters.reduce((sum, chapter) => sum + chapter.images.length, 0);
  console.log(`Updated ${outputFile} with ${totalImages} images across ${chapters.length} chapters.`);
  return chapters;
}

module.exports = { CHAPTER_CONFIG, updateChapterData };

if (require.main === module) {
  updateChapterData();
}
