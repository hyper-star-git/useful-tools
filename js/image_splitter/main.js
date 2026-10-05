"use strict";

//このツールで使用するDOM要素をまとめる。
const elements = {
  imageInput: document.getElementById("imageInput"),
  dropZone: document.getElementById("dropZone"),
  imageStatus: document.getElementById("imageStatus"),
  imageInfo: document.getElementById("imageInfo"),
  sourcePreview: document.getElementById("sourcePreview"),
  fileName: document.getElementById("fileName"),
  imageSize: document.getElementById("imageSize"),
  removeImageButton: document.getElementById("removeImageButton"),
  blockIdInput: document.getElementById("blockIdInput"),
  blockNameInput: document.getElementById("blockNameInput"),
  columnsInput: document.getElementById("columnsInput"),
  rowsInput: document.getElementById("rowsInput"),
  ratioWarning: document.getElementById("ratioWarning"),
  validationMessage: document.getElementById("validationMessage"),
  emptyPreview: document.getElementById("emptyPreview"),
  previewWrap: document.querySelector(".preview-wrap"),
  previewCanvasWrap: document.getElementById("previewCanvasWrap"),
  previewCanvas: document.getElementById("previewCanvas"),
  tileList: document.getElementById("tileList"),
  blockCount: document.getElementById("blockCount"),
  downloadButton: document.getElementById("downloadButton"),
  downloadMessage: document.getElementById("downloadMessage")
};

//DOMの準備状態に合わせてイベントを登録する。
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

function init() {
  //クリックによるファイル選択を登録する。
  elements.imageInput.addEventListener("change", handleFileInput);
  elements.dropZone.addEventListener("click", openFileDialog);
  elements.dropZone.addEventListener("keydown", handleDropZoneKeydown);

  //ドロップゾーンだけでドラッグ状態を処理する。
  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragOver);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleDrop);

  //ページ外へ落とした画像がブラウザで開くのを防ぐ。
  document.addEventListener("dragover", preventPageDefault);
  document.addEventListener("drop", preventPageDefault);

  elements.removeImageButton.addEventListener("click", clearImage);
  elements.blockIdInput.addEventListener("input", updateUI);
  elements.blockNameInput.addEventListener("input", updateUI);
  elements.columnsInput.addEventListener("input", updateUI);
  elements.rowsInput.addEventListener("input", updateUI);
  elements.downloadButton.addEventListener("click", downloadFiles);
}

//ページ上のドロップに対するブラウザの既定動作を止める。
function preventPageDefault(event) {
  event.preventDefault();
}

//ファイル選択ダイアログから画像を登録する。
function handleFileInput(event) {
  const [file] = event.target.files;

  if (file) {
    registerImage(file);
  }
}

//ドロップゾーンをクリックしたときだけファイル選択を開く。
function openFileDialog(event) {
  if (event.target === elements.imageInput) {
    return;
  }

  elements.imageInput.click();
}

//キーボード操作でもファイル選択を開けるようにする。
function handleDropZoneKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openFileDialog(event);
  }
}

//画像をドロップゾーンへ持ってきたときの表示を更新する。
function handleDragEnter(event) {
  event.preventDefault();
  elements.dropZone.classList.add("is-dragover");
}

//ドロップ中も既定動作を止め、ドロップ可能な状態を維持する。
function handleDragOver(event) {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }

  elements.dropZone.classList.add("is-dragover");
}

//ドロップゾーンからカーソルが離れたときに強調を解除する。
function handleDragLeave(event) {
  if (event.relatedTarget && elements.dropZone.contains(event.relatedTarget)) {
    return;
  }

  elements.dropZone.classList.remove("is-dragover");
}

//ドロップされた最初の画像ファイルを登録する。
function handleDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("is-dragover");

  const file = [...(event.dataTransfer?.files ?? [])].find((item) => item.type.startsWith("image/"));

  if (!file) {
    showValidation("画像ファイルをドロップしてください。");
    return;
  }

  registerImage(file);
}

//画像を読み込み、登録情報とプレビューを更新する。
async function registerImage(file) {
  try {
    const imageApi = window.ImageSplitterImage;
    const image = await imageApi.loadImageFile(file);

    elements.fileName.textContent = file.name;
    elements.imageSize.textContent = `${image.naturalWidth} × ${image.naturalHeight}px`;
    setSourcePreview(file);
    elements.imageInfo.classList.remove("hidden");
    elements.imageStatus.classList.add("hidden");

    updateUI();
  } catch (error) {
    showValidation(error.message);
  }
}

//登録した画像全体を表示するためのURLを設定する。
function setSourcePreview(file) {
  const imageApi = window.ImageSplitterImage;
  const url = imageApi.createObjectUrl(file);
  const previousUrl = elements.sourcePreview.dataset.objectUrl;

  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }

  elements.sourcePreview.dataset.objectUrl = url;
  elements.sourcePreview.src = url;
}

//現在の画像を削除してツールを初期状態へ戻す。
function clearImage() {
  const previewUrl = elements.sourcePreview.dataset.objectUrl;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  const state = window.ImageSplitterState;
  state.image = null;
  state.tiles = [];

  elements.imageInput.value = "";
  elements.sourcePreview.removeAttribute("src");
  elements.sourcePreview.removeAttribute("data-object-url");
  elements.imageInfo.classList.add("hidden");
  elements.imageStatus.textContent = "未登録";
  elements.imageStatus.classList.remove("hidden");
  elements.emptyPreview.classList.remove("hidden");
  elements.previewCanvasWrap.classList.add("hidden");
  elements.tileList.replaceChildren();
  elements.blockCount.textContent = "0";
  elements.downloadButton.disabled = true;
  elements.downloadMessage.textContent = "画像を登録するとZIPを生成できます。";
  hideValidation();
  elements.ratioWarning.classList.add("hidden");
}

//画像や設定の変更に合わせて画面を更新する。
function updateUI() {
  const settings = getSettings();
  const validation = validateSettings(settings);
  const state = window.ImageSplitterState;
  const preview = window.ImageSplitterPreview;

  renderValidation(validation);

  if (!state.image || !validation.valid) {
    state.tiles = [];
    elements.emptyPreview.classList.toggle("hidden", Boolean(state.image));
    elements.previewCanvasWrap.classList.add("hidden");
    elements.tileList.replaceChildren();
    elements.blockCount.textContent = "0";
    elements.downloadButton.disabled = true;
    elements.ratioWarning.classList.add("hidden");
    return;
  }

  state.tiles = preview.createTiles(state.image, settings.columns, settings.rows);
  preview.drawPreview(elements.previewCanvas, elements.previewWrap, state.image, state.tiles);
  preview.renderTileList(elements.tileList, state.image, state.tiles, (index) => {
    return window.ImageSplitterGenerator.buildBlockIdentifier(settings.blockId, index);
  });
  renderRatioWarning(settings);

  elements.emptyPreview.classList.add("hidden");
  elements.previewCanvasWrap.classList.remove("hidden");
  elements.blockCount.textContent = String(state.tiles.length);
  elements.downloadButton.disabled = false;
  elements.downloadMessage.textContent = "この内容でZIPを生成できます。";
}

//入力値を読み取り、生成に使う設定へ整える。
function getSettings() {
  return {
    blockId: elements.blockIdInput.value.trim(),
    blockName: elements.blockNameInput.value.trim(),
    columns: window.ToolCommon.clampInteger(elements.columnsInput.value, 1, 32),
    rows: window.ToolCommon.clampInteger(elements.rowsInput.value, 1, 32)
  };
}

//ファイル生成に必要な設定を検証する。
function validateSettings(settings) {
  const errors = [];
  const identifierPattern = /^[a-z0-9._-]+:[a-z0-9._-]+$/;
  const state = window.ImageSplitterState;

  if (!state.image) {
    errors.push("画像を登録してください。");
  }

  if (!identifierPattern.test(settings.blockId)) {
    errors.push("ブロックIDは「namespace:name」の形式で、小文字の英数字・「.」「_」「-」を使用してください。");
  }

  if (!settings.blockName) {
    errors.push("ブロック名を入力してください。");
  }

  if (settings.columns * settings.rows > 1024) {
    errors.push("分割数が多すぎます。合計1024ブロック以下にしてください。");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

//設定エラーを画面へ表示する。
function renderValidation(validation) {
  if (validation.valid) {
    hideValidation();
    return;
  }

  elements.validationMessage.textContent = validation.errors.join(" ");
  elements.validationMessage.classList.remove("hidden");
}

//設定エラー表示を消す。
function hideValidation() {
  elements.validationMessage.textContent = "";
  elements.validationMessage.classList.add("hidden");
}

//画像比率とブロック配置比率の差が大きい場合に注意を表示する。
function renderRatioWarning(settings) {
  const state = window.ImageSplitterState;
  const sourceRatio = state.image.naturalWidth / state.image.naturalHeight;
  const blockRatio = settings.columns / settings.rows;
  const difference = Math.abs(sourceRatio - blockRatio) / sourceRatio;

  if (difference < 0.03) {
    elements.ratioWarning.classList.add("hidden");
    return;
  }

  elements.ratioWarning.textContent = `注意：画像比率 ${sourceRatio.toFixed(2)} と分割比率 ${blockRatio.toFixed(2)} が異なります。配置時に画像が横または縦に伸びて見える場合があります。`;
  elements.ratioWarning.classList.remove("hidden");
}

//生成したファイルをZIPへまとめてブラウザからダウンロードする。
async function downloadFiles() {
  const settings = getSettings();
  const validation = validateSettings(settings);
  const state = window.ImageSplitterState;
  const generator = window.ImageSplitterGenerator;
  const ZipWriter = window.ImageSplitterZip.ZipWriter;

  if (!validation.valid || !state.image) {
    renderValidation(validation);
    return;
  }

  elements.downloadButton.disabled = true;
  elements.downloadMessage.textContent = "ZIPを生成しています…";

  try {
    const files = await generator.buildAddonFiles(settings);
    const zip = new ZipWriter();

    //生成したファイルを1つずつZIPへ追加する。
    for (const file of files) {
      zip.add(file.path, file.data);
    }

    const blob = zip.toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = generator.buildArchiveName(settings.blockId);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    elements.downloadMessage.textContent = `生成完了：${state.tiles.length}個のブロックを含むZIPをダウンロードしました。`;
  } catch (error) {
    console.error(error);
    elements.downloadMessage.textContent = "生成に失敗しました。画像のサイズを小さくして再試行してください。";
  } finally {
    elements.downloadButton.disabled = false;
  }
}

//ファイル読み込みなどのエラーを画面へ表示する。
function showValidation(message) {
  elements.validationMessage.textContent = message;
  elements.validationMessage.classList.remove("hidden");
}
