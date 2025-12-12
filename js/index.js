"use strict";

// Supported image file extensions
const imageTypes = ["png", "jpg", "jpeg", "gif", "bmp", "tiff"];

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
    const accordion = accordionCreator(file.name, file.name, `${file.name} is not a zip file!`);
    resultContainer.appendChild(accordion);
    return;
  }

  // Create a container for the images inside the ZIP
  const imageContainer = createElement({
    element: "div",
    className: "image-grid"
  });

  // Create an accordion for the ZIP file
  const accordion = accordionCreator(file.name, file.name, imageContainer);
  resultContainer.appendChild(accordion);

  try {
    // Load the ZIP file
    const zip = await JSZip.loadAsync(file);

    // Loop through each file in the ZIP
    zip.forEach(async (relativePath, zipEntry) => {
      const itemName = zipEntry.name;

      // Check if the file is an image
      if (imageTypes.some(ext => itemName.toLowerCase().endsWith(ext))) {
        try {
          // Get the image data as a Blob
          const data = await zipEntry.async("blob");
          const imageUrl = URL.createObjectURL(data);

          // Create image element
          const image = new Image();
          image.src = imageUrl;
          image.title = itemName;
          image.className = "grid-image";

          image.dataset.filename = itemName;
          image.currentBlob = data;

          image.onclick = () => {
            const modalImage = document.getElementById("modalImage");
            const modalMetadata = document.getElementById("modalMetadata");
            const modalFilename = document.getElementById("modalFilename");
            const downloadBtn = document.getElementById("downloadBtn");
            
            modalImage.src = image.src;
            modalFilename.textContent = image.dataset.filename;

            downloadBtn.onclick = () => {
                downloadImage(image.currentBlob, image.dataset.filename);
            };

            let additionalInfo = jsonToString(image.dataset.fullData, ['prompt', 'uc'])

            // Populate metadata
            modalMetadata.innerHTML = `
              <p><strong>Prompt</strong></p>
                <code class="prompt-box">${image.dataset.prompt || "N/A"}</code>
              <p><strong>Negative</strong></p>
                <code class="prompt-box">${image.dataset.uc || "N/A"}</code>
              <details><summary>Other info</summary>
                <p><strong>Model:</strong> ${image.dataset.model || "N/A"}</p>
                <p><strong>Seed:</strong> ${image.dataset.seed || "N/A"}</p>
                <p><strong>Sampler:</strong> ${image.dataset.sampler || "N/A"}</p>
                <p><strong>Steps:</strong> ${image.dataset.steps || "N/A"}</p>
                <p><strong>Scale:</strong> ${image.dataset.scale || "N/A"}</p>
                <hr>
                <code class="prompt-box" style="overflow-x: scroll !important;">${additionalInfo}</code>
              </details>
            `;
            
            const modal = new bootstrap.Modal(document.getElementById("imageModal"));
            modal.show();
          };

          // Try to parse EXIF data
          const parsed = await exifr.parse(imageUrl);

          if (parsed) {
            let parameters = {};

            try {
              parameters = JSON.parse(parsed.Comment || "{}");
            } catch (e) {
              console.warn("Failed to parse Comment as JSON", e);
            }

            image.dataset.model = parsed.Source || "Unknown";
            image.dataset.prompt = parameters.prompt || "N/A";
            image.dataset.uc = parameters.uc || "N/A";
            image.dataset.seed = parameters.seed || "N/A";
            image.dataset.sampler = parameters.sampler || "N/A";
            image.dataset.steps = parameters.steps || "N/A";
            image.dataset.scale = parameters.scale || "N/A";
            image.dataset.fullData = parsed.Comment || "{}";
          }

          // Create a container for the image and its metadata
          const imageHolder = createElement({ element: "div", className: "image-holder" });
          imageHolder.appendChild(image);

          imageContainer.appendChild(imageHolder);
        } catch (err) {
          console.error("Error processing image:", itemName, err);
        }
      }
    });
  } catch (err) {
    console.error("Failed to load ZIP file:", err);
    const errorMsg = createElement({ element: "div", content: `Error reading ZIP: ${err.message}` });
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
 * Creates a Bootstrap-style accordion item
 * @param {string} id - Unique ID for the accordion
 * @param {string} headerText - Text for the accordion header
 * @param {string|HTMLElement} content - Content inside the accordion body
 * @returns {HTMLElement}
 */
function accordionCreator(id, headerText, content) {
  const itemId = String(id).hashCode(); // Generate unique ID

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

  const accordionItem = createElement({ element: "div", className: "accordion-item" });
  accordionItem.appendChild(heading);
  accordionItem.appendChild(collapseDiv);

  return accordionItem;
}

/**
 * Adds a simple hash function to String prototype for generating unique IDs
 * @returns {number}
 */
String.prototype.hashCode = function () {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
};

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
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

function jsonToString(data, ignoreKeys = [], indent = 0, indentChar = '  ') {
  if (data === null || data === undefined) return "";

  let jsonObject;
  try {
    jsonObject = (typeof data === "string") ? JSON.parse(data) : data;
  } catch (err) {
    console.error('Cannot parse data to JSON:', err);
    return "Cannot parse image data to JSON, check console.";
  }

  const currentIndent = indentChar.repeat(indent);
  const nextIndentLevel = indent + 1;
  let htmlString = "";

  Object.keys(jsonObject)
    .filter(key => !ignoreKeys.includes(key))
    .filter(key => key !== null || key !== undefined)
    // .sort((a, b) => a.localeCompare(b))
    .forEach(key => {
      let value = jsonObject[key];
      
      if (Array.isArray(value)) {
        let arrayContent = [];

        value.forEach(item => {
          if (typeof item === "object") {
            arrayContent.push(jsonToString(item, [], nextIndentLevel));
          } else {
            arrayContent.push(item);
          }
        });

        value = `[ ${arrayContent.join(", ")} ]`;
      } else if (typeof value === "object" && Boolean(value)) {
        value = `{\n${jsonToString(value, [], nextIndentLevel)}${currentIndent}}`;
      }

      htmlString += `${currentIndent}${key}: ${value}\n`;
    });
  
  return htmlString;
}