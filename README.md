![title-banner](assets/title-banner.png)

[![Maintenance](https://img.shields.io/badge/Maintained-yes-a27ded.svg)](https://GitHub.com/L3-N0X/obsidian-marker/graphs/commit-activity)
[![GitHub issues](https://img.shields.io/github/issues/L3-N0X/obsidian-marker.svg?color=a27ded)](https://github.com/L3-N0X/obsidian-marker/issues)
[![GitHub Release](https://img.shields.io/github/v/release/L3-N0X/obsidian-marker?color=a27ded&link=https%3A%2F%2Fgithub.com%2FL3-N0X%2Fobsidian-marker%2Freleases)](https://github.com/L3-N0X/obsidian-marker/releases)
[![GitHub License](https://img.shields.io/github/license/L3-N0X/obsidian-marker?color=a27ded)](https://github.com/L3-N0X/obsidian-marker/blob/master/LICENSE)

## 🌟 Introduction

Welcome to this Obsidian PDF to Markdown Converter! This plugin brings the power of advanced PDF conversion directly into your Obsidian vault. By leveraging the capabilities of Marker through a self-hosted API, the hosted solution on [datalab.to](https://www.datalab.to/), or the powerful MistralAI OCR capabilities, this plugin offers a seamless way to transform your PDFs into rich, formatted Markdown files, with support for tables, formulas and more!

> [!IMPORTANT]
> This plugin requires a Marker API endpoint, a paid account for datalab, the python api of marker, or a free MistralAI API key to work. Without an endpoint, the application can't convert anything.

You can find the related repositories and services here:

- [Marker Project](https://github.com/VikParuchuri/marker) (AI model for PDF conversion + Simple Python API)
- [datalab.to](https://www.datalab.to/) (Hosted API for the Marker AI model, provided by the developer himself)
- [Marker API Docker Container](https://hub.docker.com/r/wirawan/marker-api) (Container for self-hosting, needs Nvidia GPU)
- [Marker API](https://github.com/adithya-s-k/marker-api) (API for self-hosting the conversion service)
- [MistralAI](https://console.mistral.ai/) (Free OCR API with excellent results)

## 🚀 Features

- **OCR Capabilities**: Convert scanned PDFs to rich markdown
- **Formula Detection**: Accurately captures and converts mathematical formulas
- **Table Extraction**: Preserves table structures in your Markdown output
- **Image Handling**: Extracts and saves images from your PDFs and includes them in the markdown
- **Full Datalab option coverage**: Processing modes (Fast/Balanced/Accurate), extras (track changes, chart understanding, infographics, links, bookmarks), cross-page merging, eval rubrics, bounding boxes and optional HTML output
- **Batch Processing**: Convert multiple PDFs at once by selecting files with Alt + Click (Note: Processing multiple files may take considerable time depending on their size and complexity)
- **Mobile Compatibility**: Works on both desktop and mobile Obsidian apps
- **Flexible Output**: Choose between full content extraction or specific elements (text/images)
- **Smart Folder Integration**: If a folder with the PDF's name already exists, the plugin will ask if you want to integrate the new files into the existing folder
- **Optional CLI Formatting**: Format extracted Markdown with Codex, Claude, Antigravity, Cursor Agent, OpenCode, or Hermes before the completed note appears in your vault

## CLI formatting

On desktop, enable **Format after extraction** in the plugin settings and choose an installed agent. The plugin detects agent executables, including common installations outside Obsidian's desktop PATH. Sign in and select your model using the CLI as usual; the plugin uses that account and the CLI's default model without adding another API key or model setting.

Every extraction provider uses the same formatting step. Each document is staged in its own OS temporary workspace with its attachments. The note is imported and opened after the agent finishes its edits and preservation review. Images-only extraction skips formatting. Optional HTML remains the extraction provider's original output.

The editable prompt starts with the supplied Markdown formatting skill: preserve granular content, improve heading structure, standardize formatting, and remove only truly duplicated footnotes. **Reset prompt** restores the bundled baseline. The host adds the target filename, protected-content rules, review instructions, and completion-report contract. The original skill file does not need to remain installed.

Formatting retries once from the original extraction. If both attempts fail, the plugin imports the untouched extraction and displays a failure notice. The source is kept even when automatic deletion is enabled. Output checks reject missing completion reports, empty documents, changed frontmatter, lost link targets, altered code/math blocks, and disappeared numeric values or unique words. These checks cannot guarantee complete semantic equivalence.

Click the conversion status or run **OCR-AI: Recover conversions / view active jobs** to cancel a job or recover an interrupted conversion. Recovery offers **Retry**, **Import raw**, and **Discard**, and never restarts an agent automatically. Recovered imports keep their source files. Temporary recovery data lives outside the vault and can be removed by OS cleanup.

**Advanced** includes an optional timeout (default `0`, wait until completion) and executable overrides saved only on the current device. Agents receive unattended workspace-edit permissions; global CLI configuration is not rewritten. A temporary working directory is not a security sandbox for every CLI. Extraction remains available on mobile, where subprocess formatting is unavailable.

For development, run `npm test` for isolated fake-CLI tests and `npm run build` for type checking and the production bundle. `npm run test:cli` is an optional real-account smoke test: it uses installed agents and their configured models on a small synthetic document, with a 90-second limit per agent.

## 🛠 Why This Plugin?

1. **Superior Extraction**: Utilizes the Marker project's advanced AI model or MistralAI's powerful OCR for high-quality conversions
2. **Mobile Accessibility**: Unlike many converters, this works seamlessly on mobile devices (when the API is accessible)
3. **Customizable**: Tailor the conversion process to your specific needs
4. **Obsidian Integration**: Converts PDFs directly within your Obsidian environment

## ♥️ Support the Project

If you enjoy this plugin, feel free to star the repository and share it with others!
When you want to support the development, consider buying me a coffee:

<a href="https://www.buymeacoffee.com/l3n0x"><img src="https://img.buymeacoffee.com/button-api/?slug=l3n0x&font_family=Inter&button_colour=FFDD00"></a>

## 📋 Requirements

To use this plugin, you'll need:

1. A working Obsidian installation
2. Access to a Marker API endpoint (self-hosted, paid service, or Python API server) OR a free MistralAI API key

## 🔧 Setup

1. Install the plugin in your Obsidian vault
2. Choose your conversion method:
   - **MistralAI**: Get a free API key from [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys)
   - **Datalab.to**: Sign up for a paid account
   - **Self-hosted Marker API**: Set up Docker on a machine with a solid GPU/CPU
   - **Python Local API**: Run the Python server on the same local machine where Obsidian is running. It passes the absolute local file path to the API.
   - **Python Cloud API**: Run the Python server on a remote server, a separate machine, or in WSL. It uploads the file contents using multipart form data, which is necessary since the API server cannot access the local files directly.
3. Configure your chosen endpoint/API key in the plugin settings

### Which solution should I use?


| Solution                               | Pros                                                                                                | Cons                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **MistralAI (recommended)** | Completely free, excellent results in testing, easy setup with just an API key | Uploads your files to Mistral's servers (stored for at least 24h) |
| **Hosted on datalab.to** | No setup required, fast and reliable, supports the developer and is easily accessible from anywhere | Costs a few dollars                                             |
| **Self-Hosted via Docker**             | Full control over the conversion process, no costs for the API                                      | Requires a powerful machine, Setup can be complex for beginners |
| **Self-Hosted via Python (Local)**     | Easy to set up, no Docker required, runs locally on the same host                                   | Not all features available; requires API server to run on the same machine as Obsidian to access file paths |
| **Self-Hosted via Python (Remote/WSL)**  | Easy to set up, no Docker required, works with WSL or remote servers by uploading file content     | Not all features available; requires uploading files over network or host-WSL boundary |

> [!NOTE]
> **MistralAI Privacy Consideration**: When using the MistralAI endpoint, your PDFs will be uploaded to Mistral's servers for processing. These files are stored for at least 24 hours. If you have sensitive documents, consider using a self-hosted solution instead.

### 🧾 Usage

You can convert PDFs to Markdown in multiple ways:

1. **Single PDF file**: Right-click on a PDF file in the file explorer and select "Convert to MD" from the context menu
2. **Multiple PDF files**: Select multiple PDF files with Alt + Click and right-click to convert them all at once
3. **PDF file in editor**: After opening a PDF file in the editor, click on the three dots in the top right corner and select "Convert to MD"
4. **Use the command palette**: Open the command palette and search for "Convert PDF to MD" (only works if a PDF file is open)

**Folder Integration**: If a folder with the same name as your PDF already exists, the plugin will ask if you want to integrate the new files into this existing folder. This allows you to update or add to already converted documents.

## ⚙️ Settings

### General

| Setting                     | Default          | Description                                                                                                                                                |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API Endpoint**            | 'selfhosted'        | Select the API endpoint to use: 'Datalab', 'Selfhosted', 'Python Local API', 'Python Cloud API', or 'MistralAI'                                                      |
| **Marker API Endpoint**     | 'localhost:8000' | The endpoint to use for the Marker API. Only shown when 'Selfhosted' is selected as the API endpoint.  |
| **Python API Endpoint**     | 'localhost:8001' | The endpoint to use for the Python API. Only shown when 'Python Local API' or 'Python Cloud API' is selected as the API endpoint.                            |
| **Datalab API Key**          | -                | Enter your Datalab API key. Only shown when 'Datalab' is selected as the API endpoint.                                                           |
| **MistralAI API Key**       | -                | Enter your MistralAI API key. Only shown when 'MistralAI' is selected as the API endpoint.                                                     |
| **Languages**               | 'en'             | The languages to use if OCR is needed, separated by commas. Only shown for the Python API endpoints.                                     |
| **Force OCR**               | `false`          | Force OCR (Activate this when auto-detect often fails, make sure to set the correct languages). Only shown for the Python API endpoints. |
| **Paginate**                | `false`          | Add horizontal rules between each page. Available for Datalab, Python API and MistralAI endpoints.                                                         |
| **Image Limit**             | `0`              | Maximum number of images to extract (0 for no limit). Only shown when 'MistralAI' is selected.                                                  |
| **Image Minimum Size**      | `0`              | Minimum height and width of images to extract (0 for no minimum). Only shown when 'MistralAI' is selected.                                     |
| **Move PDF to Folder**      | `false`          | Move the PDF to the folder after conversion.                                                        |
| **Create Asset Subfolder**  | `true`           | Create an asset subfolder for images.                                                                                                                      |
| **Keep Raw Extraction Backup** | `false`       | Save the unformatted extraction as `<name>.md.backup` in the assets folder, so CLI formatting never destroys the raw result (`<name>.md.backup` is ignored by Obsidian). |
| **Extract Content**         | 'all'            | Select the content to extract from the PDF. Options: 'Extract everything', 'Text Only', 'Images Only'.                                                     |
| **Write Metadata**          | `false`          | Write metadata as frontmatter in the Markdown file.                                                                                                        |
| **Delete Original PDF**     | `false`          | Delete the original PDF after conversion.                                                                                                                  |

### Datalab conversion options

These mirror the options of the [Datalab Convert API](https://documentation.datalab.to/docs/recipes/conversion/conversion-api-overview) and are only shown when 'Datalab' is selected as the API endpoint. Prices are the standard Datalab rates and can change.

| Setting                     | Default          | Description                                                                                                                                                |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mode**                    | 'balanced'       | Processing mode: 'Fast' ($4/1k pages), 'Balanced' ($4/1k pages, recommended) or 'Accurate' ($10/1k pages). |
| **Page Range**              | -                | Comma-separated page ranges to process, e.g. `0-2,4` (0-indexed). Overrides maximum pages. For spreadsheets this filters by sheet index. |
| **Maximum Pages**           | -                | Limit the number of pages to convert. Ignored when a page range is set. |
| **Track Changes**           | `false`          | Extract tracked changes and comments from DOCX, PDF and image files (+$6/1k pages). |
| **Chart Understanding**     | `false`          | Extract data from charts and graphs into structured output (+$3/1k pages). |
| **Extract Links**           | `false`          | Preserve hyperlinks in the converted output. |
| **New Block Types**         | `false`          | Use newer block types for improved layout and structure detection. |
| **Extract Bookmarks**       | `false`          | Read the PDF's stored outline into `metadata.pdf_bookmarks` (useful together with 'Write Metadata'). |
| **Infographic**             | `false`          | Reconstruct infographics and diagrams as structured content. |
| **Run Eval**                | `false`          | Run an evaluation rubric after each conversion. |
| **Eval Rubric ID**          | -                | ID of an active eval rubric owned by your Datalab team (created in the Datalab dashboard). |
| **Merge Cross-page Content**| `false`          | Beta. Merge tables, paragraphs and lists split across pages. Adds a variable compute surcharge (~$0.50 per document). |
| **Keep Page Header/Footer in Output** | `false` | Include page headers/footers in the converted output. |
| **Disable Image Extraction**| `false`          | Don't extract images from the document (ignored when 'Extract Content' is set to 'Images Only'). |
| **Disable Image Captions**  | `false`          | Disable synthetic image captions/descriptions in the output. |
| **Add Block IDs**           | `false`          | Add `data-block-id` attributes to HTML elements for citation tracking (HTML output only). |
| **Token-efficient Markdown**| `false`          | Optimize markdown for LLM token usage (compact tables, single-space indents). |
| **Fence Synthetic Captions**| `false`          | Wrap synthetic image captions in HTML comment markers for easy removal. |
| **Save HTML Output**        | `false`          | Also save the converted document as an `.html` file next to the markdown file. Required for block IDs and bounding boxes. |
| **Disable HTML Prettify**   | `false`          | Return compact HTML without added indentation (only applies when saving HTML output). |
| **Word BBoxes**             | `false`          | Inline per-word bounding boxes and confidence scores into HTML output ($3/1k pages). |
| **Table Cell BBoxes**       | `false`          | Add per-cell bounding boxes to tables in HTML output (includes word bboxes, $6/1k pages). |
| **List Item BBoxes**        | `false`          | Add per-item bounding boxes to lists in HTML output (includes word bboxes, $6/1k pages). |
| **Skip Cache**              | `false`          | Force re-conversion and skip using cached results. |
| **Save Checkpoint**         | `false`          | Save a checkpoint after conversion so it can be reused by other Datalab endpoints. |

## 🙏 Acknowledgements

This plugin wouldn't be possible without the incredible work of:

- [Marker Project](https://github.com/VikParuchuri/marker): The AI model powering the conversions
- [Marker API](https://github.com/adithya-s-k/marker-api): The API that enables self-hosting of the conversion service
- [MistralAI](https://mistral.ai/): For providing the free OCR capabilities

A huge thank you to these projects for their contributions to the community!

## 🐛 Troubleshooting

If you encounter issues related to the plugin itself, please open an issue in this repository. For problems with the conversion process or API, please refer to the Marker and Marker API repositories.

> [!NOTE]
> When converting multiple files at once they run in parallel, so several conversions progress at the same time. Large batches may still be limited by the API endpoint or your machine's resources.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/L3-N0X/obsidian-marker/issues).

---

Happy converting! 📚➡️📝

---

<p align="center">
  <a href="https://l3n0x.eu5.org">
    <img src="https://api.star-history.com/svg?repos=l3-n0x/obsidian-marker&type=Date" alt="Star History Chart">
  </a>
</p>
