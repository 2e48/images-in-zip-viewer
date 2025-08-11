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
  const imageContainer = document.createElement("div");
  imageContainer.className = "text-center";

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
          image.onclick = () => {
            const modalImage = document.getElementById("modalImage");
            modalImage.src = image.src;
            const modal = new bootstrap.Modal(document.getElementById("imageModal"));
            modal.show();
          };

          // Create containers for metadata
          const promptHolder = createElement({ element: "div", className: "image-info prompt" });
          const otherInfo = createElement({ element: "div", className: "image-info config" });

          // Try to parse EXIF data
          const parsed = await exifr.parse(imageUrl);

          if (parsed) {
            let prompt = parsed.Description || "No prompt found";
            let parameters = {};

            try {
              parameters = JSON.parse(parsed.Comment || "{}");
            } catch (e) {
              console.warn("Failed to parse Comment as JSON", e);
            }

            promptHolder.innerHTML = prompt;
            otherInfo.innerHTML = `
              Seed: ${parameters.seed || "N/A"}, 
              Sampler: ${parameters.sampler || "N/A"}, 
              Steps: ${parameters.steps || "N/A"}, 
              Scale: ${parameters.scale || "N/A"}
            `;
          }

          // Create a container for the image and its metadata
          const imageHolder = createElement({ element: "div", className: "image-holder" });
          imageHolder.appendChild(image);
          imageHolder.appendChild(promptHolder);
          imageHolder.appendChild(otherInfo);

          imageContainer.appendChild(imageHolder);

          // Revoke the object URL to free memory after a delay
          image.onload = () => {
            URL.revokeObjectURL(imageUrl);
          };
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
