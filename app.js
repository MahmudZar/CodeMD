// Project Opener - Main Application
const notyf = new Notyf({
  duration: 3000,
  position: { x: "right", y: "top" },
});

let fileHandles = []; // {file, path, size}
let markdown = "";

/* ---------- DOM References ---------- */
const picker = document.getElementById("folderPicker");
const selectBtn = document.getElementById("selectBtn");
const dropZone = document.getElementById("dropZone");
const progress = document.getElementById("progress");
const tree = $("#tree");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const preview = document.getElementById("preview");
const previewCode = document.getElementById("previewCode");
const filterTree = document.getElementById("filterTree");
const fileStats = document.getElementById("fileStats");

/* ---------- Theme Management ---------- */
const themeToggle = document.getElementById("themeToggle");

// Initialize theme from localStorage or system preference
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (!savedTheme && systemDark);

  document.documentElement.dataset.theme = isDark ? "dark" : "";
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  themeToggle.innerHTML = `<i class="bi ${
    isDark ? "bi-sun-fill" : "bi-moon-fill"
  }"></i>`;
}

themeToggle.onclick = () => {
  const isDark = document.documentElement.dataset.theme === "dark";
  const newTheme = isDark ? "" : "dark";

  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem("theme", newTheme || "light");
  updateThemeIcon(!isDark);
};

/* ---------- File Input Handling ---------- */
selectBtn.onclick = () => picker.click();
picker.onchange = handleFiles;

/* ---------- Drag & Drop ---------- */
["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag");
  });
});

dropZone.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    handleFiles({ target: { files } });
  }
});

/* ---------- Reset Functionality ---------- */
resetBtn.onclick = () => {
  fileHandles = [];
  markdown = "";
  dropZone.hidden = false;
  document.getElementById("treeContainer").hidden = true;
  preview.hidden = true;
  progress.hidden = true;
  progress.value = 0;
  tree.jstree("destroy");
  filterTree.value = "";
  previewCode.textContent = "";
  notyf.success("Reset complete!");
};

/* ---------- Main File Processing ---------- */
async function handleFiles({ target }) {
  const files = Array.from(target.files);
  if (!files.length) return;

  fileHandles = [];
  const rootName = files[0].webkitRelativePath
    ? files[0].webkitRelativePath.split("/")[0]
    : "Selected Files";

  progress.value = 0;
  progress.hidden = false;
  selectBtn.classList.add("loading");

  const total = files.length;
  let processed = 0;
  let totalSize = 0;

  try {
    for (let i = 0; i < total; i++) {
      const file = files[i];
      const path = file.webkitRelativePath || file.name;

      // Skip hidden files and common ignore patterns
      if (shouldSkipFile(path)) {
        processed++;
        progress.value = (processed / total) * 100;
        continue;
      }

      totalSize += file.size;

      if (isBinary(file.name)) {
        fileHandles.push({
          file,
          path,
          size: file.size,
          isBinary: true,
        });
      } else {
        fileHandles.push({
          file,
          path,
          size: file.size,
          isBinary: false,
        });
      }

      processed++;
      progress.value = (processed / total) * 100;

      // Allow UI to update
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    updateFileStats(fileHandles.length, totalSize);
    await renderTree(rootName);
    await buildMarkdown(rootName);

    progress.hidden = true;
    dropZone.hidden = true;
    document.getElementById("treeContainer").hidden = false;

    notyf.success(`Processed ${fileHandles.length} files successfully!`);
  } catch (error) {
    console.error("Error processing files:", error);
    notyf.error("Error processing files. Please try again.");
  } finally {
    selectBtn.classList.remove("loading");
  }
}

/* ---------- File Filtering ---------- */
function shouldSkipFile(path) {
  const skipPatterns = [
    /\/\.git\//,
    /\/node_modules\//,
    /\/\.vscode\//,
    /\/\.idea\//,
    /\/dist\//,
    /\/build\//,
    /\/coverage\//,
    /\/\.nyc_output\//,
    /\/\.DS_Store$/,
    /\/Thumbs\.db$/,
    /\/\.gitignore$/,
    /\/\.gitkeep$/,
  ];

  return skipPatterns.some((pattern) => pattern.test(path));
}

function isBinary(name) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const binaryExts = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "ico",
    "webp",
    "svg",
    "bmp",
    "tiff",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "bz2",
    "mp3",
    "mp4",
    "avi",
    "mov",
    "wmv",
    "flv",
    "woff",
    "woff2",
    "ttf",
    "eot",
    "otf",
    "exe",
    "dll",
    "so",
    "dylib",
    "class",
    "jar",
    "war",
  ];
  return binaryExts.includes(ext);
}

/* ---------- File Statistics ---------- */
function updateFileStats(fileCount, totalSize) {
  const sizeFormatted = formatBytes(totalSize);
  fileStats.textContent = `${fileCount} files • ${sizeFormatted}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/* ---------- Tree Rendering ---------- */
async function renderTree(rootName) {
  const nodes = buildJsTreeNodes(rootName);

  tree.jstree("destroy");
  tree.jstree({
    core: {
      data: nodes,
      themes: {
        name: "default",
        responsive: true,
      },
    },
    plugins: ["search", "wholerow", "types"],
    types: {
      folder: {
        icon: "bi bi-folder-fill",
      },
      file: {
        icon: "bi bi-file-earmark",
      },
    },
  });

  // Setup search
  filterTree.addEventListener("keyup", () => {
    const searchTerm = filterTree.value.trim();
    tree.jstree(true).search(searchTerm);
  });
}

function buildJsTreeNodes(rootName) {
  const map = new Map();
  const root = {
    id: rootName,
    text: `📁 ${rootName}`,
    children: [],
    state: { opened: true },
    type: "folder",
  };
  map.set(rootName, root);

  // Sort files for consistent ordering
  const sortedFiles = [...fileHandles].sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  sortedFiles.forEach(({ path, size, isBinary }) => {
    const parts = path.split("/");
    let parent = root;

    for (let i = 1; i < parts.length; i++) {
      const subPath = parts.slice(0, i + 1).join("/");

      if (!map.has(subPath)) {
        const isFile = i === parts.length - 1;
        const icon = isFile ? getFileIcon(parts[i]) : "📁";
        const sizeText = isFile && size ? ` (${formatBytes(size)})` : "";
        const binaryText = isFile && isBinary ? " [binary]" : "";

        const node = {
          id: subPath,
          text: `${icon} ${parts[i]}${sizeText}${binaryText}`,
          children: isFile ? undefined : [],
          type: isFile ? "file" : "folder",
        };

        map.set(subPath, node);
        parent.children.push(node);
      }
      parent = map.get(subPath);
    }
  });

  return [root];
}

function getFileIcon(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap = {
    js: "📄",
    ts: "📘",
    jsx: "⚛️",
    tsx: "⚛️",
    html: "🌐",
    css: "🎨",
    scss: "🎨",
    sass: "🎨",
    json: "📋",
    xml: "📋",
    yaml: "📋",
    yml: "📋",
    md: "📝",
    txt: "📄",
    py: "🐍",
    java: "☕",
    cpp: "⚙️",
    c: "⚙️",
    php: "🐘",
    rb: "💎",
    go: "🐹",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    pdf: "📕",
    zip: "📦",
    tar: "📦",
    gz: "📦",
  };
  return iconMap[ext] || "📄";
}

/* ---------- ASCII Tree Generation ---------- */
function renderAsciiTree(root) {
  const lines = [];
  const tree = {};

  // Build tree structure
  fileHandles.forEach(({ path }) => {
    const parts = path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = i === parts.length - 1 ? null : {}; // null for files, {} for folders
      }
      if (current[part] !== null) {
        current = current[part];
      }
    }
  });

  function buildLines(obj, prefix = "", isRoot = true) {
    const entries = Object.entries(obj).sort(([a, aVal], [b, bVal]) => {
      // Folders first, then files
      if ((aVal === null) !== (bVal === null)) {
        return aVal === null ? 1 : -1;
      }
      return a.localeCompare(b);
    });

    entries.forEach(([name, value], index) => {
      const isLast = index === entries.length - 1;
      const isFile = value === null;

      if (isRoot && entries.length === 1) {
        // Root folder
        lines.push(name + "/");
        if (value && Object.keys(value).length > 0) {
          buildLines(value, "", false);
        }
      } else {
        const connector = isLast ? "└── " : "├── ";
        const suffix = isFile ? "" : "/";
        lines.push(prefix + connector + name + suffix);

        if (value && Object.keys(value).length > 0) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          buildLines(value, newPrefix, false);
        }
      }
    });
  }

  buildLines(tree);
  return lines.join("\n");
}

/* ---------- Markdown Generation ---------- */
async function buildMarkdown(rootName) {
  markdown = "";

  // ASCII Tree - Clean format like your specification
  const asciiTree = renderAsciiTree(rootName);
  markdown += `${asciiTree}\n\n`;

  // File Contents with clean separators
  const textFileHandles = fileHandles.filter((f) => !f.isBinary);
  const sortedTextFiles = textFileHandles.sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  for (let i = 0; i < sortedTextFiles.length; i++) {
    const { file, path } = sortedTextFiles[i];

    try {
      // Skip very large files
      if (file.size > 1024 * 1024) {
        // 1MB
        const fileIcon = getFileIcon(path.split("/").pop());
        markdown += `---\n\n### ${fileIcon} \`${path}\`\n\n`;
        markdown += `*File too large (${formatBytes(
          file.size
        )}) - content skipped*\n\n`;
        continue;
      }

      const content = await file.text();
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const lang = mapExtToLang(ext);

      // Clean format with separators like your specification
      const fileIcon = getFileIcon(path.split("/").pop());
      markdown += `---\n\n### ${fileIcon} \`${path}\`\n\n`;
      markdown += `\`\`\`${lang}\n${escapeCode(content)}\n\`\`\`\n\n`;
    } catch (error) {
      console.error(`Error reading file ${path}:`, error);
      const fileIcon = getFileIcon(path.split("/").pop());
      markdown += `---\n\n### ${fileIcon} \`${path}\`\n\n`;
      markdown += `*Error reading file content*\n\n`;
    }

    // Update progress and allow UI updates
    if (i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }

  // List binary files if any
  const binaryFileHandles = fileHandles.filter((f) => f.isBinary);
  if (binaryFileHandles.length > 0) {
    markdown += `---\n\n## 🗂️ Binary Files (Skipped)\n\n`;
    binaryFileHandles.forEach(({ path, size }) => {
      markdown += `- \`${path}\` (${formatBytes(size)})\n`;
    });
    markdown += "\n";
  }

  // Update preview
  previewCode.textContent = markdown;
  if (window.Prism) {
    Prism.highlightElement(previewCode);
  }
  preview.hidden = false;
}

function mapExtToLang(ext) {
  const langMap = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "markup",
    htm: "markup",
    xml: "markup",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    cc: "cpp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    r: "r",
    swift: "swift",
    kt: "kotlin",
    dart: "dart",
    scala: "scala",
    clj: "clojure",
  };
  return langMap[ext] || ext;
}

function escapeCode(str) {
  return str.replace(/```/g, "\\`\\`\\`");
}

/* ---------- Export Functions ---------- */
copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(markdown);
    notyf.success("Markdown copied to clipboard!");
  } catch (error) {
    console.error("Copy failed:", error);
    notyf.error("Failed to copy to clipboard");
  }
};

downloadBtn.onclick = () => {
  try {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project-structure.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notyf.success("Markdown file downloaded!");
  } catch (error) {
    console.error("Download failed:", error);
    notyf.error("Failed to download file");
  }
};

/* ---------- Initialize Application ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  // System theme change listener
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        document.documentElement.dataset.theme = e.matches ? "dark" : "";
        updateThemeIcon(e.matches);
      }
    });
});

// Handle browser compatibility
if (!("webkitdirectory" in document.createElement("input"))) {
  console.warn("Directory upload not supported in this browser");
  selectBtn.innerHTML =
    '<i class="bi bi-files"></i> Select Files (Folder upload not supported)';
}
