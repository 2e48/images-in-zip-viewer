"use strict";

// Supported image file extensions
const imageTypes = ["png", "jpg", "jpeg", "gif", "bmp", "tiff", "webp"];

// DOM elements
const fileInput = document.getElementById("file");
const resultContainer = document.getElementById("result");

// Listen for file input changes
fileInput.addEventListener("change", async (evt) => {
  resultContainer.innerHTML = ""; // Clear previous results

  const files = evt.target.files;
  for (let i = 0; i < files.length; i++) {
    await handleFile(files[i]); // Process each file
  }
});

/**
 * Process a single uploaded file
 * @param {File} file - The uploaded file
 */
async function handleFile(file) {
  // If not a ZIP file, show error in accordion
  if (!file.name.endsWith(".zip")) {
    const accordion = accordionCreator(
      file.name,
      `${file.name} is not a zip file!`,
    );
    resultContainer.appendChild(accordion);
    return;
  }

  // Create a container for the images inside the ZIP
  const imageContainer = createElement({
    element: "div",
    className: "image-grid",
  });

  // Create an accordion for the ZIP file
  const accordion = accordionCreator(file.name, imageContainer);
  resultContainer.appendChild(accordion);

  try {
    // Load the ZIP file
    const zip = await JSZip.loadAsync(file);

    // Loop through each file in the ZIP
    zip.forEach(async (relativePath, zipEntry) => {
      const itemName = zipEntry.name;

      // Check if the file is an image
      if (imageTypes.some((ext) => itemName.toLowerCase().endsWith(ext))) {
        try {
          // Get the image data as a Blob
          const data = await zipEntry.async("blob");
          const imageUrl = URL.createObjectURL(data);

          // Create image element
          const image = new Image();
          image.src = imageUrl;
          image.title = itemName;
          image.className = "grid-image";

          // Parse the metadata up front so the modal reads it directly. Storing
          // it on the element (previously a data-* attribute) meant copying a
          // 130 KB base64 vibe blob into the DOM for every image.
          const parsed = await exifr.parse(imageUrl);
          const meta = {
            exif: parsed || null,
            parameters: parseComment(parsed),
          };

          image.onclick = () => openImageModal(imageUrl, itemName, data, meta);

          // Create a container for the image and its metadata
          const imageHolder = createElement({
            element: "div",
            className: "image-holder",
          });
          imageHolder.appendChild(image);

          imageContainer.appendChild(imageHolder);
        } catch (err) {
          console.error("Error processing image:", itemName, err);
        }
      }
    });
  } catch (err) {
    console.error("Failed to load ZIP file:", err);
    const errorMsg = createElement({
      element: "div",
      content: `Error reading ZIP: ${err.message}`,
    });
    imageContainer.appendChild(errorMsg);
  }
}

/**
 * Utility to create DOM elements with optional attributes and content
 * @param {Object} options - Element options
 * @returns {HTMLElement}
 */
function createElement({
  element = "div",
  className = "",
  id = "",
  content = "",
}) {
  const elem = document.createElement(element);
  if (className) elem.className = className;
  if (id) elem.id = id;

  if (content instanceof HTMLElement) {
    elem.appendChild(content);
  } else {
    elem.innerHTML = content;
  }

  return elem;
}

/**
 * Generates a unique, DOM-safe identifier for an accordion item.
 *
 * This used to be a hash of the file name, which produced duplicate IDs when
 * two uploads shared a name, and required patching String.prototype to work.
 * A timestamp plus a monotonic counter stays unique even when several items
 * are created within the same millisecond.
 *
 * @returns {string}
 */
let accordionSequence = 0;
function nextAccordionId() {
  accordionSequence += 1;
  return `${Date.now().toString(36)}-${accordionSequence}`;
}

/**
 * Creates a Bootstrap-style accordion item
 * @param {string} headerText - Text for the accordion header
 * @param {string|HTMLElement} content - Content inside the accordion body
 * @returns {HTMLElement}
 */
function accordionCreator(headerText, content) {
  const itemId = nextAccordionId();

  const heading = createElement({
    element: "h2",
    className: "accordion-header sticky-top",
    id: `heading${itemId}`,
  });

  const button = createElement({
    element: "button",
    className: "accordion-button collapsed",
    content: headerText,
  });
  button.setAttribute("data-bs-toggle", "collapse");
  button.setAttribute("data-bs-target", `#collapse${itemId}`);

  heading.appendChild(button);

  const bodyContent = createElement({
    element: "div",
    className: "accordion-body",
    content: content,
  });

  const collapseDiv = createElement({
    element: "div",
    className: "accordion-collapse collapse",
    id: `collapse${itemId}`,
  });
  collapseDiv.appendChild(bodyContent);

  const accordionItem = createElement({
    element: "div",
    className: "accordion-item",
  });
  accordionItem.appendChild(heading);
  accordionItem.appendChild(collapseDiv);

  return accordionItem;
}

/**
 * Triggers a download of the given Blob data with the specified filename.
 * @param {Blob} blobData - The binary data of the file.
 * @param {string} filename - The desired name for the downloaded file.
 */
function downloadImage(blobData, filename) {
  if (!blobData || !filename) {
    console.error("Missing blob data or filename for download.");
    return;
  }

  const downloadUrl = URL.createObjectURL(blobData);

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Escapes text for safe insertion into HTML.
 *
 * All metadata is rendered with textContent, so this is not required for the
 * modal. It exists as the single place to harden any future innerHTML path,
 * since prompts and filenames originate outside this application.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reads the NovelAI generation parameters out of parsed EXIF/PNG text data.
 *
 * NovelAI writes a JSON blob into a PNG tEXt chunk named "Comment", which
 * exifr surfaces as `Comment`. WebP exports put the same JSON in an EXIF
 * UserComment instead, so both are accepted.
 *
 * @param {object|null} parsed - Result of exifr.parse()
 * @returns {object} Parsed parameters, or {} when absent/unreadable
 */
function parseComment(parsed) {
  if (!parsed) return {};

  const raw = parsed.Comment || parsed.UserComment;
  if (!raw) return {};

  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch (err) {
    console.warn("Failed to parse generation metadata as JSON", err);
    return {};
  }
}

/** Human-readable names for NovelAI request types. */
const REQUEST_TYPE_LABELS = {
  PromptGenerateRequest: "Text to image",
  Img2ImgRequest: "Image to image",
  InfillRequest: "Inpaint",
};

/**
 * Keys already shown in the curated summary, so they are not repeated under
 * "All fields".
 */
const CURATED_KEYS = new Set([
  "prompt",
  "uc",
  "seed",
  "sampler",
  "steps",
  "scale",
  "width",
  "height",
  "request_type",
  "strength",
  "noise",
  "reference_image_multiple",
  "reference_strength_multiple",
  "director_reference_strengths",
  "model_name",
  "model_hash",
]);

/**
 * Encoded vibe blobs and other opaque payloads are meaningless as text and can
 * be tens of thousands of characters long, so they are collapsed in the raw
 * view. The exact original stays available through "Copy raw JSON".
 */
const ENCODED_VALUE_MIN_LENGTH = 1024;

/**
 * Resolves a display label for the model that produced an image.
 *
 * NovelAI has changed how this is recorded over time:
 *   - V5 images carry `model_name` and `model_hash`.
 *   - V4/V4.5 only carry a `Source` string such as
 *     "NovelAI Diffusion V4.5 4BDE2A90".
 *   - V3-era images report the base model instead, e.g.
 *     "Stable Diffusion XL C1E1DE52".
 *
 * @param {string|undefined} source - The `Source` text chunk
 * @param {object} parameters - Parsed generation parameters
 * @returns {{name: string, hash: string}}
 */
function resolveModel(source, parameters) {
  if (parameters.model_name) {
    return { name: parameters.model_name, hash: parameters.model_hash || "" };
  }

  if (!source) return { name: "Unknown", hash: "" };

  const match = /^(.*?)\s+([0-9A-Fa-f]{8})$/.exec(source);
  if (match) return { name: match[1], hash: match[2] };

  return { name: source, hash: "" };
}

/**
 * Formats a number without a trailing ".0" (NovelAI writes scale as a float).
 * @param {*} value
 * @returns {string}
 */
function formatNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : String(value);
}

/**
 * Replaces long encoded strings with a short, readable placeholder.
 * @param {*} value
 * @returns {*}
 */
function summarizeEncodedValues(value) {
  if (typeof value === "string") {
    if (value.length < ENCODED_VALUE_MIN_LENGTH) return value;
    return `[encoded data omitted: ${value.length.toLocaleString()} characters]`;
  }

  if (Array.isArray(value)) return value.map(summarizeEncodedValues);

  if (value && typeof value === "object") {
    const copy = {};
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = summarizeEncodedValues(entry);
    }
    return copy;
  }

  return value;
}

/**
 * Formats a metadata value for the "All fields" list.
 * @param {*} value
 * @returns {string}
 */
function formatMetadataValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "";

  if (typeof value === "string") {
    if (value.length >= ENCODED_VALUE_MIN_LENGTH) {
      return `${value.length.toLocaleString()} characters of encoded data (see raw JSON)`;
    }
    return value;
  }

  if (typeof value === "object") {
    return JSON.stringify(summarizeEncodedValues(value));
  }

  return String(value);
}

/**
 * Builds the curated label/value rows shown without expanding anything.
 * @param {object} parameters
 * @param {object|null} exif
 * @returns {Array<[string, string]>}
 */
function buildCuratedRows(parameters, exif) {
  const rows = [];

  const model = resolveModel(exif ? exif.Source : undefined, parameters);
  const modelLabel = model.hash ? `${model.name} (${model.hash})` : model.name;
  rows.push(["Model", modelLabel]);

  if (parameters.seed !== undefined) {
    rows.push(["Seed", String(parameters.seed)]);
  }
  if (parameters.sampler) {
    rows.push(["Sampler", parameters.sampler]);
  }
  if (parameters.steps !== undefined) {
    rows.push(["Steps", formatNumber(parameters.steps)]);
  }
  if (parameters.scale !== undefined) {
    rows.push(["CFG scale", formatNumber(parameters.scale)]);
  }
  if (parameters.width && parameters.height) {
    rows.push(["Resolution", `${parameters.width} x ${parameters.height} px`]);
  }

  const mode =
    REQUEST_TYPE_LABELS[parameters.request_type] || parameters.request_type;
  if (mode) rows.push(["Mode", mode]);

  if (parameters.strength !== undefined) {
    rows.push(["Strength", formatNumber(parameters.strength)]);
  }
  if (parameters.noise !== undefined) {
    rows.push(["Noise", formatNumber(parameters.noise)]);
  }

  // Vibe Transfer references are stored as encoded blobs, which cannot be
  // decoded back into pictures. The count and strengths are still meaningful.
  const references = parameters.reference_image_multiple;
  if (Array.isArray(references) && references.length) {
    const strengths = Array.isArray(parameters.reference_strength_multiple)
      ? parameters.reference_strength_multiple
      : [];
    const suffix = strengths.length
      ? ` · strength ${strengths.map(formatNumber).join(", ")}`
      : "";
    rows.push(["Vibe references", `${references.length} encoded${suffix}`]);
  }

  const directorStrengths = parameters.director_reference_strengths;
  if (Array.isArray(directorStrengths) && directorStrengths.length) {
    rows.push([
      "Director references",
      `${directorStrengths.length} · strength ${directorStrengths.map(formatNumber).join(", ")}`,
    ]);
  }

  const charCaptions = parameters.v4_prompt?.caption?.char_captions;
  if (Array.isArray(charCaptions) && charCaptions.length) {
    rows.push(["Characters", String(charCaptions.length)]);
  }

  return rows;
}

/**
 * Builds rows for every parameter not already covered by the curated summary.
 * Unknown keys pass straight through, so new NovelAI fields stay visible
 * without a code change.
 * @param {object} parameters
 * @returns {Array<[string, string]>}
 */
function buildOtherRows(parameters) {
  return Object.keys(parameters)
    .filter((key) => !CURATED_KEYS.has(key))
    .map((key) => [key, formatMetadataValue(parameters[key])]);
}

/**
 * Creates a heading plus its content block.
 * @param {string} title
 * @param {Node} content
 * @returns {HTMLElement}
 */
function metadataSection(title, content) {
  const wrapper = document.createElement("div");
  wrapper.className = "meta-section";

  const heading = document.createElement("h6");
  heading.className = "meta-heading";
  heading.textContent = title;

  wrapper.append(heading, content);
  return wrapper;
}

/**
 * Creates a preformatted box for a prompt or negative prompt.
 * @param {string|undefined} text
 * @returns {HTMLElement}
 */
function promptBox(text) {
  const code = document.createElement("code");
  code.className = "prompt-box";
  code.textContent = text || "N/A";
  return code;
}

/**
 * Renders label/value pairs as a responsive definition list.
 * @param {Array<[string, string]>} rows
 * @param {string} [extraClass] - Additional class, e.g. "meta-list-stacked"
 * @returns {HTMLElement}
 */
function definitionList(rows, extraClass = "") {
  const list = document.createElement("dl");
  list.className = extraClass
    ? `meta-list ${extraClass}`
    : "meta-list";

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = value;

    list.append(term, description);
  }

  return list;
}

/**
 * Wraps content in a collapsed <details> block.
 * @param {string} title
 * @param {Node} content
 * @returns {HTMLElement}
 */
function collapsible(title, content) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = title;
  details.append(summary, content);
  return details;
}

/**
 * Copies text to the clipboard, with a fallback for browsers that do not
 * expose the async clipboard API.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (fallbackError) {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }
}

/**
 * Builds the "Raw metadata" block: a bounded, scrollable JSON preview plus a
 * button that copies the untouched original.
 * @param {object} meta
 * @returns {HTMLElement}
 */
function rawMetadataBlock(meta) {
  const wrapper = document.createElement("div");

  const preview = { ...(meta.parameters || {}) };
  delete preview.prompt;
  delete preview.uc;

  const hasData = Object.keys(preview).length > 0;

  const pre = document.createElement("pre");
  pre.className = "raw-json";
  pre.textContent = hasData
    ? JSON.stringify(summarizeEncodedValues(preview), null, 2)
    : "No NovelAI metadata found for this image.";
  wrapper.appendChild(pre);

  const note = document.createElement("p");
  note.className = "meta-note";
  note.textContent =
    "prompt and uc are shown above. Long encoded blobs are collapsed in this preview only; Copy raw JSON gives you the exact original, including them.";
  wrapper.appendChild(note);

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "btn btn-outline-secondary btn-sm";
  copyButton.textContent = "Copy raw JSON";

  copyButton.addEventListener("click", async () => {
    const original =
      meta.exif && (meta.exif.Comment || meta.exif.UserComment)
        ? meta.exif.Comment || meta.exif.UserComment
        : JSON.stringify(meta.parameters || {}, null, 2);

    const copied = await copyText(original);
    copyButton.textContent = copied ? "Copied!" : "Copy failed";
    setTimeout(() => {
      copyButton.textContent = "Copy raw JSON";
    }, 1500);
  });

  wrapper.appendChild(copyButton);
  return wrapper;
}

/**
 * Renders the full metadata panel for one image.
 * @param {object} meta
 * @returns {DocumentFragment}
 */
function renderMetadata(meta) {
  const fragment = document.createDocumentFragment();
  const parameters = meta.parameters || {};

  fragment.appendChild(metadataSection("Prompt", promptBox(parameters.prompt)));
  fragment.appendChild(
    metadataSection("Negative prompt", promptBox(parameters.uc)),
  );

  const curatedRows = buildCuratedRows(parameters, meta.exif);
  if (curatedRows.length) {
    fragment.appendChild(definitionList(curatedRows));
  }

  const otherRows = buildOtherRows(parameters);
  if (otherRows.length) {
    fragment.appendChild(
      collapsible(
        "All fields",
        definitionList(otherRows, "meta-list-stacked"),
      ),
    );
  }

  fragment.appendChild(
    collapsible("Raw metadata (JSON)", rawMetadataBlock(meta)),
  );

  return fragment;
}

/**
 * Populates and shows the image modal.
 * @param {string} imageUrl
 * @param {string} filename
 * @param {Blob} blob
 * @param {object} meta
 */
function openImageModal(imageUrl, filename, blob, meta) {
  const modalElement = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const modalFilename = document.getElementById("modalFilename");
  const downloadBtn = document.getElementById("downloadBtn");
  const metadataHost = document.getElementById("modalMetadata");

  modalImage.src = imageUrl;
  modalFilename.textContent = filename;
  downloadBtn.onclick = () => downloadImage(blob, filename);

  metadataHost.replaceChildren(renderMetadata(meta));

  // Reopening the modal keeps the previous scroll position otherwise, which
  // would drop the reader into the middle of long metadata.
  const scrollHost = modalElement.querySelector(".modal-body");
  if (scrollHost) scrollHost.scrollTop = 0;

  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
