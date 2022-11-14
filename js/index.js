"use strict"

// removed jquery but code from https://stuk.github.io/jszip/documentation/examples/read-local-file-api.html

const imageTypes = ["png", "jpg", "jpeg", "gif", "bmp", "tiff"];
const fileInput = document.getElementById("file");
const resultContainer = document.getElementById("result");

fileInput.addEventListener("change", evt => {
  resultContainer.innerHTML = "";

  function handleFile(file) {
    // const title = document.createElement("h4");
    // title.textContent = file.name;
    // resultContainer.appendChild(title);
    if (!file.name.endsWith("zip")) {
      const accordion = accordionCreator(file.name, file.name, `${file.name} is not a zip file!`);
      resultContainer.appendChild(accordion);
      return;
    }

    //const titleSpan = document.createElement("span");
    //title.appendChild(titleSpan);

    const titleFiles = document.createElement("div");
    titleFiles.className = "text-center";
    //title.appendChild(titleFiles);

    const accordion = accordionCreator(file.name, file.name, titleFiles);
    resultContainer.appendChild(accordion);

    //const headerText = document.getElementById(`heading${file.name.hashCode()}`);
    //console.log(headerText, `header${file.name.hashCode()}`);

    let dateBefore = new Date();

    JSZip.loadAsync(file).then(
      zip => {
        //let dateAfter = new Date();
        //headerText.textContent += (`(loaded in ${dateAfter - dateBefore}ms)`);

        //let readTimeBefore = new Date();
        zip.forEach((relativePath, zipEntry) => {
          const data = zipEntry._data.compressedContent;
          const dataBlob = new Blob([data]);

          const imageHolder = createElement({
            element: "div", className: "image-holder"
          });

          const promptHolder = createElement({ element: "div", className: "image-info prompt" });
          const otherInfo = createElement({ element: "div", className: "image-info config" });

          const itemName = zipEntry.name
          if (imageTypes.some(ext => itemName.endsWith(ext))) {
            const image = new Image();
            image.src = URL.createObjectURL(dataBlob);
            image.title = itemName;
            image.onclick = function () {
              window.open(image.src);
            };
            image.className = "grid-image";


            exifr.parse(image.src).then(parsed => {
              let parameters = JSON.parse(parsed.Comment);
              let prompt = parsed.Description;

              promptHolder.innerHTML = prompt;
              otherInfo.innerHTML = `Seed: ${parameters.seed}, Sampler: ${parameters.sampler}, Steps: ${parameters.steps}, Scale: ${parameters.scale}`;

              console.log(parameters, prompt);
            });

            imageHolder.appendChild(image);
            imageHolder.appendChild(promptHolder);
            imageHolder.appendChild(otherInfo);
            titleFiles.appendChild(imageHolder);
          }
        });
        //let readTimeAfter = new Date();
        //titleSpan.innerHTML += `(zip fully scanned in ${readTimeAfter - readTimeBefore}ms)`;

      }, e => {
        //titleSpan.innerHTML = ` Cant read ${file.name}:, ${e.message}`;
      });
  }

  let files = evt.target.files;
  for (let i = 0; i < files.length; i++) {
    handleFile(files[i]);
  }
});

function createElement({
  element = "div",
  className = "",
  id = "",
  content = "",
}) {
  const elem = document.createElement(element);
  elem.className = className;
  elem.id = id;

  if (content instanceof HTMLElement) {
    elem.appendChild(content);
  } else {
    elem.innerHTML = content;
  }

  return elem;
}

function accordionCreator(id, headerText, content) {
  function createHeading(id, headerText) {
    const h2 = createElement({
      element: "h2",
      className: "accordion-header sticky-top",
      id: `heading${id}`,
    });

    const button = createElement({
      element: "button",
      className: "accordion-button collapsed",
      content: headerText,
    });
    button.dataset.bsTarget = `#collapse${id}`;
    button.dataset.bsToggle = 'collapse';

    h2.appendChild(button);

    return h2;
  }

  function createBody(id, content) {
    const divContent = createElement({
      element: "div",
      className: "accordion-body",
      content: content,
    });
    const divWrapper = createElement({
      className: "accordion-collapse collapse",
      id: `collapse${id}`,
    });

    divWrapper.appendChild(divContent);

    return divWrapper;
  }

  const div = createElement({
    className: "accordion-item"
  });

  div.appendChild(createHeading(id.hashCode(), headerText));
  div.appendChild(createBody(id.hashCode(), content));

  return div;
}

String.prototype.hashCode = function () {
  var hash = 0,
    i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}