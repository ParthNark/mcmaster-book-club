const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputFile = path.join(projectRoot, 'js', 'chapters-data.js');

const CHAPTER_CONFIG = [
  {
    number: '01',
    title: 'Battle of the Books',
    year: '2025/26',
    imageFolder: 'images/battleofthebooks'
  },
  {
    number: '02',
    title: 'Murder Mystery Night',
    year: '2025/26',
    imageFolder: 'images/murdermystery'
  }
];

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
    return {
      ...chapter,
      images: listImageFiles(folderPath)
    };
  });

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
