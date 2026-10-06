import { App, Notice, TFile, TFolder, base64ToArrayBuffer } from 'obsidian';
import { MarkerSettings } from '../settings';
import { MarkerOkayCancelDialog } from '../modals';

export async function getConversionFolderPath(
  file: TFile,
  existingPath?: string
): Promise<string> {
  // If a path is provided, use it directly
  const folderPath = existingPath || calculateFolderPath(file);

  return folderPath;
}

// Helper function to calculate the folder path. Every converted document gets
// its own subfolder next to the original file, regardless of its file type.
function calculateFolderPath(file: TFile): string {
  const folderName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/\./g, '-');

  if (!folderName) {
    return '';
  }

  return file.path.replace(/[^/]+$/, `${folderName}/`);
}

export async function createConversionFolder(
  app: App,
  folderPath: string
): Promise<string> {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    await app.vault.createFolder(folderPath);
  }
  return folderPath;
}

export async function checkForExistingFiles(
  app: App,
  folderPath: string
): Promise<boolean> {
  const existingFiles = app.vault
    .getFiles()
    .filter((file: { path: string }) => file.path.startsWith(folderPath));
  if (existingFiles.length > 0) {
    return new Promise((resolve) => {
      new MarkerOkayCancelDialog(
        app,
        'Existing files found',
        'Some files already exist in the target folder. Do you want to overwrite them / integrate the new files into this folder?',
        resolve
      ).open();
    });
  }
  return true;
}

export async function createImageFiles(
  app: App,
  settings: MarkerSettings,
  images: { [key: string]: string },
  folderPath: string,
  originalFile: TFile
) {
  const totalImages = Object.keys(images).length;
  let processedImages = 0;

  for (const [imageName, imageBase64] of Object.entries(images)) {
    try {
      let newImageName = imageName;
      if (settings.createAssetSubfolder) {
        newImageName = getImagePrefix(originalFile) + imageName;
      }
      const imageArrayBuffer = base64ToArrayBuffer(imageBase64);
      // check if image already exists, if so, overwrite it
      if (
        app.vault.getAbstractFileByPath(folderPath + newImageName) instanceof
        TFile
      ) {
        const file = app.vault.getAbstractFileByPath(folderPath + newImageName);
        if (!(file instanceof TFile)) {
          console.error(
            `Invalid file reference for image: ${newImageName}`,
            file
          );
          continue;
        }
        await app.vault.modifyBinary(file, imageArrayBuffer);
      } else {
        await app.vault.createBinary(
          folderPath + newImageName,
          imageArrayBuffer
        );
      }
      processedImages++;
    } catch (error) {
      console.error(
        `Failed to process image ${imageName}:`,
        error.message,
        error.stack
      );
    }
  }

  if (processedImages === totalImages) {
    new Notice(`${totalImages} image files created successfully`);
  } else {
    new Notice(
      `${processedImages} of ${totalImages} image files created (some failed)`
    );
  }
}

export async function createMarkdownFile(
  app: App,
  settings: MarkerSettings,
  markdown: string,
  folderPath: string,
  originalFile: TFile
) {
  const fileName = originalFile.basename + '.md';
  const filePath = folderPath + fileName;
  let file: TFile;

  // change markdown image links when asset subfolder is created
  if (settings.createAssetSubfolder) {
    const cleanImagePath = getCleanImagePath(originalFile);

    markdown = markdown.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      `![$1](assets/${cleanImagePath}$2)`
    );
  }
  // remove images when only text is extracted or image extraction is disabled
  if (settings.extractContent === 'text' || settings.disableImageExtraction) {
    markdown = markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  }

  const existingFile = app.vault.getAbstractFileByPath(filePath);
  if (existingFile instanceof TFile) {
    file = existingFile;
    await app.vault.modify(file, markdown);
  } else {
    file = await app.vault.create(filePath, markdown);
  }
  new Notice(`Markdown file created: ${fileName}`);
  app.workspace.openLinkText(file.path, '', true);
}

export async function createHtmlFile(
  app: App,
  settings: MarkerSettings,
  html: string,
  folderPath: string,
  originalFile: TFile
) {
  const fileName = originalFile.basename + '.html';
  const filePath = folderPath + fileName;

  // change image links when asset subfolder is created
  if (settings.createAssetSubfolder) {
    const cleanImagePath = getCleanImagePath(originalFile);
    html = html.replace(
      /(<img[^>]+src=["'])([^"']+)(["'])/g,
      (match, prefix: string, src: string, suffix: string) => {
        if (/^(https?:|data:)/i.test(src)) return match;
        return `${prefix}assets/${cleanImagePath}${src}${suffix}`;
      }
    );
  }

  // remove images when only text is extracted or image extraction is disabled
  if (settings.extractContent === 'text' || settings.disableImageExtraction) {
    html = html.replace(/<img[^>]*>/gi, '');
  }

  const existingFile = app.vault.getAbstractFileByPath(filePath);
  if (existingFile instanceof TFile) {
    await app.vault.modify(existingFile, html);
  } else {
    await app.vault.create(filePath, html);
  }
  new Notice(`HTML file created: ${fileName}`);
}

function getImagePrefix(originalFile: TFile): string {
  return originalFile.basename + '_';
}

function getCleanImagePath(originalFile: TFile): string {
  return getImagePrefix(originalFile).replace(/\s+/g, '%20');
}

export async function addMetadataToMarkdownFile(
  app: App,
  metadata: { [key: string]: any },
  folderPath: string,
  originalFile: TFile
) {
  const fileName = originalFile.basename + '.md';
  const filePath = folderPath + fileName;
  const file = app.vault.getAbstractFileByPath(filePath);
  if (file instanceof TFile) {
    // use the processFrontMatter function to add the metadata to the markdown file
    const frontmatter = generateFrontmatter(metadata);
    await app.fileManager
      .processFrontMatter(file, (fm: any) => {
        return frontmatter + fm;
      })
      .catch((error: any) => {
        console.error('Error adding metadata to markdown file:', error);
      });
  }
}

function generateFrontmatter(metadata: { [key: string]: any }): string {
  let frontmatter = '---\n';
  const frontmatterKeys = [
    'languages',
    'filetype',
    'ocr_stats',
    'block_stats',
    'failed_pages',
    'pdf_bookmarks',
    'pdf_bookmarks_truncated',
  ];
  for (const [key, value] of Object.entries(metadata)) {
    if (frontmatterKeys.includes(key)) {
      if (key === 'ocr_stats' || key === 'block_stats') {
        for (const [k, v] of Object.entries(value)) {
          frontmatter += `${k}: ${
            k === 'equations'
              ? JSON.stringify(v).slice(1, -1).replace(/"/g, '')
              : v
          }\n`;
        }
      } else if (value !== null && typeof value === 'object') {
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      } else {
        frontmatter += `${key}: ${value}\n`;
      }
    }
  }
  frontmatter += '---\n';
  return frontmatter;
}

export async function deleteOriginalFile(app: App, file: TFile) {
  try {
    await app.fileManager.trashFile(file);
    new Notice('Original file deleted');
  } catch (error) {
    console.error('Error deleting original file:', error);
  }
}
