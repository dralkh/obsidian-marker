class TFile {
  constructor(path) {
    this.path = path; this.name = path.split('/').pop(); this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.split('.').pop(); this.stat = { mtime: 1, size: 10 };
  }
}
class TFolder {}
class Notice { constructor(message) { this.message = message; } }
class Modal { constructor(app) { this.app = app; } }
class Plugin {
  async loadData() { return {}; }
  async saveData() {}
  addCommand() {}
  addSettingTab() {}
  registerEvent() {}
  addStatusBarItem() { throw new Error('Desktop status bar must not be requested on mobile'); }
}
module.exports = {
  TFile, TFolder, Notice, Modal, Plugin, PluginSettingTab: class {}, Setting: class {}, Platform: { isDesktopApp: false },
  parseYaml: JSON.parse, stringifyYaml: JSON.stringify,
  base64ToArrayBuffer(text) { const buffer = Buffer.from(text, 'base64'); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length); },
  arrayBufferToBase64(buffer) { return Buffer.from(buffer).toString('base64'); },
  requestUrl() { throw new Error('Unexpected network request in isolated tests'); },
};
