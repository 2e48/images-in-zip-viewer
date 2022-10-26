"use strict"

// removed jquery but code from https://stuk.github.io/jszip/documentation/examples/read-local-file-api.html

const imageTypes = ["png", "jpg", "jpeg", "gif", "bmp", "tiff"];
const fileInput = document.getElementById("file");
const resultContainer = document.getElementById("result");

fileInput.addEventListener("change", evt => {
  resultContainer.innerHTML = "";

  function handleFile(file) {
    const title = document.createElement("h4");
    title.textContent = file.name;
    resultContainer.appendChild(title);

    if (!file.name.endsWith("zip")) {
      title.innerHTML += " <b>is not a zip file!</b>";
      return;
    }

    const titleSpan = document.createElement("span");
    title.appendChild(titleSpan);

    const titleFiles = document.createElement("div");
    title.appendChild(titleFiles);

    let dateBefore = new Date();

    JSZip.loadAsync(file).then(
      zip => {
        let dateAfter = new Date();
        titleSpan.innerHTML = `(loaded in ${dateAfter - dateBefore}ms)`;

        let readTimeBefore = new Date();
        zip.forEach((relativePath, zipEntry) => {
          const data = zipEntry._data.compressedContent;
          const dataBlob = new Blob([data]);

          const itemName = zipEntry.name
          if (imageTypes.some(ext => itemName.endsWith(ext))) {
            const image = new Image();
            image.src = URL.createObjectURL(dataBlob);
            image.title = itemName;
            image.onclick = function () {
              window.open(image.src);
            };

            titleFiles.appendChild(image);
          }
        });
        let readTimeAfter = new Date();
        titleSpan.innerHTML += `(zip fully scanned in ${readTimeAfter - readTimeBefore}ms)`;

      }, e => {
        titleSpan.innerHTML = ` Cant read ${file.name}:, ${e.message}`;
      });
  }

  let files = evt.target.files;
  for (let i = 0; i < files.length; i++) {
    handleFile(files[i]);
  }
});