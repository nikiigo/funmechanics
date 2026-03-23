const swfFiles = [
  "swf/barom.swf",
  "swf/defor.swf",
  "swf/difrak.swf",
  "swf/diriz.swf",
  "swf/gidgaf.swf",
  "swf/impuls.swf",
  "swf/nasos.swf",
  "swf/otnos.swf",
  "swf/perem.swf",
  "swf/polet.swf",
  "swf/postup.swf",
  "swf/reakt.swf",
  "swf/shar.swf",
  "swf/shluz.swf",
  "swf/turbin.swf",
  "swf/ustoy.swf",
  "swf/volna.swf"
];

function setActiveBook(filePath) {
  document.querySelectorAll(".djvu-book").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.file === filePath);
  });
}

async function loadDirectoryFiles(directoryPath, extension) {
  const response = await fetch(directoryPath);

  if (!response.ok) {
    throw new Error(`Failed to read ${directoryPath}`);
  }

  const markup = await response.text();
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "text/html");
  const fileSet = new Set();

  documentNode.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");

    if (!href || href.startsWith("?") || href.startsWith("/") || href === "../") {
      return;
    }

    const normalizedHref = decodeURIComponent(href);

    if (normalizedHref.toLowerCase().endsWith(extension.toLowerCase())) {
      fileSet.add(`${directoryPath}${normalizedHref}`);
    }
  });

  return Array.from(fileSet).sort((left, right) => left.localeCompare(right));
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.querySelector("#theme-toggle");
  const swfGallery = document.querySelector("#swf-gallery");
  const djvuLibrary = document.querySelector("#djvu-library");
  const djvuTitle = document.querySelector("#djvu-title");
  const djvuPath = document.querySelector("#djvu-path");
  const djvuViewerHost = document.querySelector("#djvu-viewer");
  const swfCount = document.querySelector("#swf-count");
  const djvuCount = document.querySelector("#djvu-count");

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      document.body.classList.toggle("is-cool");
    });
  }

  if (swfCount) {
    swfCount.textContent = String(swfFiles.length);
  }

  let djvuViewer = null;

  if (djvuViewerHost && window.DjVu?.Viewer) {
    djvuViewer = new window.DjVu.Viewer();
    djvuViewer.render(djvuViewerHost);
  }

  async function openDjvu(filePath) {
    if (!djvuViewer) {
      if (djvuPath) {
        djvuPath.textContent = "DjVu.js viewer failed to initialize.";
      }
      return;
    }

    try {
      await djvuViewer.loadDocumentByUrl(filePath, {
        uiOptions: {
          hideOpenAndCloseButtons: true
        }
      });

      if (djvuTitle) {
        djvuTitle.textContent = filePath.split("/").pop() ?? filePath;
      }
      if (djvuPath) {
        djvuPath.textContent = filePath;
      }
      setActiveBook(filePath);
    } catch (error) {
      if (djvuPath) {
        djvuPath.textContent = `Failed to load ${filePath}. Serve the project over HTTP and check the browser console.`;
      }
    }
  }

  function renderDjvuBooks(djvuFiles) {
    djvuLibrary.innerHTML = "";

    djvuFiles.forEach((filePath) => {
      const button = document.createElement("button");
      button.className = "djvu-book";
      button.type = "button";
      button.dataset.file = filePath;

      const name = document.createElement("span");
      name.className = "djvu-book__name";
      name.textContent = filePath.split("/").pop() ?? filePath;

      const pathText = document.createElement("span");
      pathText.className = "djvu-book__path";
      pathText.textContent = filePath;

      button.append(name, pathText);
      button.addEventListener("click", () => {
        openDjvu(filePath);
      });

      djvuLibrary.append(button);
    });
  }

  async function initializeDjvuLibrary() {
    if (!djvuLibrary) {
      return;
    }

    try {
      const djvuFiles = await loadDirectoryFiles("djvu/", ".djvu");

      if (djvuFiles.length === 0) {
        if (djvuCount) {
          djvuCount.textContent = "0";
        }
        djvuLibrary.textContent = "No DjVu books found.";
        if (djvuPath) {
          djvuPath.textContent = "The djvu/ folder is empty.";
        }
        return;
      }

      if (djvuCount) {
        djvuCount.textContent = String(djvuFiles.length);
      }
      renderDjvuBooks(djvuFiles);
      await openDjvu(djvuFiles[0]);
    } catch (error) {
      if (djvuCount) {
        djvuCount.textContent = "0";
      }
      djvuLibrary.textContent = "Unable to read the djvu/ directory.";
      if (djvuPath) {
        djvuPath.textContent = "Directory listing must be available from the local HTTP server.";
      }
    }
  }

  initializeDjvuLibrary();

  if (swfGallery) {
    const ruffle = window.RufflePlayer?.newest();

    swfFiles.forEach(async (filePath) => {
      const card = document.createElement("article");
      card.className = "swf-card";

      const title = document.createElement("h3");
      title.textContent = filePath.split("/").pop() ?? filePath;

      const pathText = document.createElement("p");
      pathText.textContent = filePath;

      const playerHost = document.createElement("div");
      playerHost.className = "swf-player";

      if (ruffle) {
        const player = ruffle.createPlayer();
        player.style.width = "100%";
        player.style.height = "240px";
        playerHost.append(player);

        card.append(title, pathText, playerHost);
        swfGallery.append(card);

        try {
          await player.load({
            url: filePath
          });
        } catch (error) {
          playerHost.textContent = `Failed to load ${filePath}. Check the browser console.`;
        }
      } else {
        playerHost.textContent = "Ruffle failed to initialize.";
        card.append(title, pathText, playerHost);
        swfGallery.append(card);
      }
    });
  }
});
