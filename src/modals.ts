import { App, Modal } from 'obsidian';

export class MarkerOkayCancelDialog extends Modal {
  result: boolean;
  title: string;
  message: string;
  onSubmit: (result: boolean) => void;

  constructor(
    app: App,
    title: string,
    message: string,
    onSubmit: (result: boolean) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.title = title;
    this.message = message;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', {
      text: this.message,
    });

    const buttonContainer = contentEl.createEl('div', {
      attr: { class: 'modal-button-container' },
    });
    const yesButton = buttonContainer.createEl('button', {
      text: 'Okay',
      attr: { class: 'mod-cta' },
    });
    yesButton.addEventListener('click', () => {
      this.result = true;
      this.onSubmit(true);
      this.close();
    });
    const noButton = buttonContainer.createEl('button', {
      text: 'Cancel',
    });
    noButton.addEventListener('click', () => {
      this.result = false;
      this.onSubmit(false);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
