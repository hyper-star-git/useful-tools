"use strict";

//このツールで使用するDOM要素をまとめる.
const elements = {
  imageInput: document.getElementById("imageInput"),
  dropZone: document.getElementById("dropZone"),
  imageList: document.getElementById("imageList"),
  imageStatus: document.getElementById("imageStatus"),
  uploadValidationMessage: document.getElementById("uploadValidationMessage"),
  imageInfo: document.getElementById("imageInfo"),
  sourcePreview: document.getElementById("sourcePreview"),
  fileName: document.getElementById("fileName"),
  imageSize: document.getElementById("imageSize"),
  removeImageButton: document.getElementById("removeImageButton"),
  namespaceInput: document.getElementById("namespaceInput"),
  blockIdInput: document.getElementById("blockIdInput"),
  blockNameInput: document.getElementById("blockNameInput"),
  itemCatalogIdInput: document.getElementById("itemCatalogIdInput"),
  itemCatalogNameInput: document.getElementById("itemCatalogNameInput"),
  columnsInput: document.getElementById("columnsInput"),
  rowsInput: document.getElementById("rowsInput"),
  ratioWarning: document.getElementById("ratioWarning"),
  imageValidationMessage: document.getElementById("imageValidationMessage"),
  validationMessage: document.getElementById("validationMessage"),
  emptyPreview: document.getElementById("emptyPreview"),
  previewWrap: document.querySelector(".preview-wrap"),
  previewCanvasWrap: document.getElementById("previewCanvasWrap"),
  previewCanvas: document.getElementById("previewCanvas"),
  tileList: document.getElementById("tileList"),
  outputSummary: document.getElementById("outputSummary"),
  downloadButton: document.getElementById("downloadButton"),
  downloadMessage: document.getElementById("downloadMessage")
};

//DOMの準備状態に合わせてイベントを登録する.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

function init() {
  //複数ファイルの選択とドラッグ＆ドロップに対応する.
  elements.imageInput.addEventListener("change", handleFileInput);
  elements.dropZone.addEventListener("click", openFileDialog);
  elements.dropZone.addEventListener("keydown", handleDropZoneKeydown);
  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragOver);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleDrop);
  elements.imageList.addEventListener("click", handleImageListClick);
  document.addEventListener("dragover", preventPageDefault);
  document.addEventListener("drop", preventPageDefault);

  //画像別設定と共通設定で、保存処理を分ける.
  elements.removeImageButton.addEventListener("click", removeActiveImage);
  [elements.blockIdInput, elements.blockNameInput, elements.columnsInput, elements.rowsInput]
    .forEach((input) => input.addEventListener("input", handleImageSettingsInput));
  [elements.namespaceInput, elements.itemCatalogIdInput, elements.itemCatalogNameInput]
    .forEach((input) => input.addEventListener("input", handleCommonSettingsInput));
  elements.downloadButton.addEventListener("click", downloadFiles);

  //初期値を共通設定へ保存し、登録前の画面を描画する.
  saveCommonSettings();
  updateUI();
}

//ページ上へ画像をドロップしたときの既定動作を止める.
function preventPageDefault(event) {
  event.preventDefault();
}

//ファイル選択ダイアログから複数の画像を登録する.
function handleFileInput(event) {
  const files = [...(event.target.files ?? [])];
  event.target.value = "";
  registerImages(files);
}

//ドロップゾーンをクリックしたときだけファイル選択を開く.
function openFileDialog(event) {
  if (event.target === elements.imageInput) {
    return;
  }

  elements.imageInput.click();
}

//キーボード操作でもファイル選択を開けるようにする.
function handleDropZoneKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.imageInput.click();
  }
}

//画像をドロップゾーンへ持ってきたときの表示を更新する.
function handleDragEnter(event) {
  event.preventDefault();
  elements.dropZone.classList.add("is-dragover");
}

//ドロップ中も既定動作を止め、ドロップ可能な状態を維持する.
function handleDragOver(event) {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }

  elements.dropZone.classList.add("is-dragover");
}

//ドロップゾーンからカーソルが離れたときに強調を解除する.
function handleDragLeave(event) {
  if (event.relatedTarget && elements.dropZone.contains(event.relatedTarget)) {
    return;
  }

  elements.dropZone.classList.remove("is-dragover");
}

//ドロップされた画像をすべて登録する.
function handleDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("is-dragover");

  const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));

  if (files.length === 0) {
    showValidation("画像ファイルをドロップしてください.", elements.uploadValidationMessage);
    return;
  }

  registerImages(files);
}

//画像を読み込み、画像別設定とともに登録する.
async function registerImages(files) {
  if (files.length === 0) {
    return;
  }

  saveActiveSettings();
  saveCommonSettings();
  const state = window.PhotoPanelMakerState;
  const imageApi = window.PhotoPanelMakerImage;
  const baseSettings = getImageSettings();
  let firstAddedId = null;
  let addedCount = 0;

  elements.downloadButton.disabled = true;
  hideValidation(elements.uploadValidationMessage);
  elements.downloadMessage.textContent = "画像を読み込んでいます…";

  for (const file of files) {
    try {
      const image = await imageApi.loadImageFile(file);
      //すべての画像で、拡張子を除いたファイル名を初期IDにする.
      //ブロック名は画像ごとに入力するため、初期値を空欄にする.
      const settings = {
        ...baseSettings,
        blockId: createUniqueBlockId(file.name, state.images),
        blockName: ""
      };

      const imageId = state.nextImageId++;
      const entry = {
        id: imageId,
        file,
        image,
        objectUrl: imageApi.createObjectUrl(file),
        settings,
        tiles: []
      };

      state.images.push(entry);
      if (firstAddedId === null) {
        firstAddedId = imageId;
      }
      addedCount += 1;
    } catch (error) {
      showValidation(`${file.name}: ${error.message}`, elements.uploadValidationMessage);
    }
  }

  //新規追加した最初の画像を選択し、その画像別設定を表示する.
  if (firstAddedId !== null) {
    state.activeImageId = firstAddedId;
    loadActiveImageSettings();
  }

  updateUI();
  if (addedCount > 0) {
    elements.downloadMessage.textContent = `${addedCount}枚の画像を追加しました.画像別設定で画像ごとの値を変更できます.`;
  }
}

//画像ファイル名からBedrockで使いやすい初期IDを作成する.
function createUniqueBlockId(fileName, images) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  let base = withoutExtension.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "");

  if (!base) {
    base = "picture";
  }

  const usedIds = new Set(images.map((entry) => entry.settings.blockId.toLowerCase()));
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

//画像一覧のクリックから選択画像を切り替える.
function handleImageListClick(event) {
  const button = event.target.closest("button[data-image-id]");

  if (!button) {
    return;
  }

  const imageId = Number(button.dataset.imageId);
  const state = window.PhotoPanelMakerState;

  if (imageId === state.activeImageId) {
    return;
  }

  saveActiveSettings();
  state.activeImageId = imageId;
  loadActiveImageSettings();
  updateUI();
}

//画像別設定を保存して画面を更新する.
function handleImageSettingsInput() {
  saveActiveSettings();
  updateUI();
}

//共通設定を保存して、すべての画像の結果へ反映する.
function handleCommonSettingsInput() {
  saveCommonSettings();
  updateUI();
}

//現在の画像別入力欄を、選択中画像の設定として保存する.
function saveActiveSettings() {
  const activeImage = getActiveImage();

  if (activeImage) {
    activeImage.settings = getImageSettings();
  }
}

//共通設定は画像別設定とは独立して全体状態へ保存する.
function saveCommonSettings() {
  window.PhotoPanelMakerState.commonSettings = getCommonSettings();
}

//画像別の入力値を設定オブジェクトへ整える.
function getImageSettings() {
  return {
    blockId: elements.blockIdInput.value.trim(),
    blockName: elements.blockNameInput.value.trim(),
    columns: window.ToolCommon.clampInteger(elements.columnsInput.value, 1, 32),
    rows: window.ToolCommon.clampInteger(elements.rowsInput.value, 1, 32)
  };
}

//全画像に共通する入力値を設定オブジェクトへ整える.
function getCommonSettings() {
  return {
    namespace: elements.namespaceInput.value.trim(),
    itemCatalogId: elements.itemCatalogIdInput.value.trim(),
    itemCatalogName: elements.itemCatalogNameInput.value.trim()
  };
}

//選択中画像の設定を画像別入力欄へ表示する.
function loadActiveImageSettings() {
  const activeImage = getActiveImage();

  if (!activeImage) {
    return;
  }

  const settings = activeImage.settings;
  elements.blockIdInput.value = settings.blockId;
  elements.blockNameInput.value = settings.blockName;
  elements.columnsInput.value = settings.columns;
  elements.rowsInput.value = settings.rows;
}

//選択画像を一覧から削除し、表示URLも解放する.
function removeActiveImage() {
  const state = window.PhotoPanelMakerState;
  const activeIndex = state.images.findIndex((entry) => entry.id === state.activeImageId);

  if (activeIndex < 0) {
    return;
  }

  const [removedImage] = state.images.splice(activeIndex, 1);
  URL.revokeObjectURL(removedImage.objectUrl);
  state.activeImageId = state.images.length > 0
    ? state.images[Math.min(activeIndex, state.images.length - 1)].id
    : null;

  loadActiveImageSettings();
  updateUI();
}

//選択中の画像情報を取得する.
function getActiveImage() {
  const state = window.PhotoPanelMakerState;
  return state.images.find((entry) => entry.id === state.activeImageId) ?? null;
}

//画像一覧をカード状に描画する.
function renderImageList() {
  const state = window.PhotoPanelMakerState;
  const fragment = document.createDocumentFragment();

  for (const entry of state.images) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-card";
    button.dataset.imageId = String(entry.id);
    button.classList.toggle("is-active", entry.id === state.activeImageId);
    button.setAttribute("aria-pressed", String(entry.id === state.activeImageId));

    const thumbnail = document.createElement("img");
    thumbnail.src = entry.objectUrl;
    thumbnail.alt = "";

    //画像選択カードにはサムネイルとファイル名だけを表示する.
    const details = document.createElement("span");
    details.className = "image-card-details";

    const name = document.createElement("strong");
    name.textContent = entry.file.name;

    details.append(name);
    button.append(thumbnail, details);
    fragment.append(button);
  }

  elements.imageList.replaceChildren(fragment);
  elements.imageList.classList.toggle("hidden", state.images.length === 0);
  elements.imageStatus.classList.toggle("hidden", state.images.length > 0);
  elements.imageStatus.textContent = state.images.length === 0
    ? "画像が登録されていません."
    : `${state.images.length}枚の画像を登録中です.画像を選択すると画像別設定を切り替えられます.`;
}

//画像や設定の変更に合わせてプレビューと出力概要を更新する.
function updateUI() {
  const state = window.PhotoPanelMakerState;

  //入力中の値を先に保存してから、全画像の生成可否を判定する.
  saveActiveSettings();
  saveCommonSettings();

  const activeImage = getActiveImage();
  const preview = window.PhotoPanelMakerPreview;
  const allErrors = validateAllImages();
  const commonErrors = validateCommonSettings(state.commonSettings);
  renderValidation(commonErrors, elements.validationMessage);

  //エラーがあっても、分割設定が有効なら出力予定のカードは表示する.
  for (const entry of state.images) {
    entry.tiles = preview.createTiles(entry.image, entry.settings.columns, entry.settings.rows);
  }

  renderImageList();
  renderOutputSummary(allErrors);

  if (!activeImage) {
    elements.imageInfo.classList.add("hidden");
    elements.emptyPreview.classList.remove("hidden");
    elements.emptyPreview.textContent = "画像を登録してください.";
    elements.previewCanvasWrap.classList.add("hidden");
    elements.tileList.replaceChildren();
    elements.ratioWarning.classList.add("hidden");
    renderValidation([], elements.imageValidationMessage);
    elements.downloadButton.disabled = true;
    elements.downloadMessage.textContent = "画像を登録すると生成内容が表示されます.";
    return;
  }

  const validation = allErrors.get(activeImage.id) ?? [];
  const imageErrors = getImageOnlyErrors(activeImage, allErrors);
  renderValidation(imageErrors, elements.imageValidationMessage);
  elements.fileName.textContent = activeImage.file.name;
  elements.imageSize.textContent = `${activeImage.image.naturalWidth} × ${activeImage.image.naturalHeight}px`;
  elements.sourcePreview.src = activeImage.objectUrl;
  elements.imageInfo.classList.remove("hidden");

  if (validation.length === 0) {
    preview.drawPreview(elements.previewCanvas, elements.previewWrap, activeImage.image, activeImage.tiles);
    preview.renderTileList(elements.tileList, activeImage.image, activeImage.tiles, (index) => {
      return window.PhotoPanelMakerGenerator.buildBlockIdentifier(
        state.commonSettings.namespace,
        `photo_panel_${activeImage.settings.blockId}`,
        index
      );
    });
    renderRatioWarning(activeImage);
    elements.emptyPreview.classList.add("hidden");
    elements.previewCanvasWrap.classList.remove("hidden");
  } else {
    elements.emptyPreview.textContent = "設定を確認してください.";
    elements.emptyPreview.classList.remove("hidden");
    elements.previewCanvasWrap.classList.add("hidden");
    elements.tileList.replaceChildren();
    elements.ratioWarning.classList.add("hidden");
  }

  const allValid = state.images.length > 0 && [...allErrors.values()].every((errors) => errors.length === 0);
  elements.downloadButton.disabled = !allValid;
  if (allValid) {
    //正常時の補足文は表示せず、必要なエラー時だけメッセージを出す.
    elements.downloadMessage.textContent = "";
  } else if (state.images.some((entry) => (allErrors.get(entry.id) ?? []).length > 0)) {
    elements.downloadMessage.textContent = "出力できない設定があります.画像一覧を切り替えてエラーを確認してください.";
  }
}

//画像別設定だけを検証する.エラーは「画像別設定」に表示する.
function validateImageSettings(imageSettings) {
  const errors = [];
  const identifierPattern = /^[a-z0-9._-]+$/;

  if (!identifierPattern.test(imageSettings.blockId)) {
    errors.push("IDは小文字の英数字・「.」「_」「-」を使用してください.");
  }
  if (!imageSettings.blockName) {
    errors.push("ブロックの名前を入力してください.");
  }
  if (imageSettings.columns * imageSettings.rows > 1024) {
    errors.push("分割数が多すぎます.1画像あたり1024ブロック以下にしてください.");
  }

  return errors;
}

//共通設定だけを検証する.エラーは「共通設定」に表示する.
function validateCommonSettings(commonSettings) {
  const errors = [];
  const identifierPattern = /^[a-z0-9._-]+$/;

  if (!identifierPattern.test(commonSettings.namespace)) {
    errors.push("名前空間は小文字の英数字・「.」「_」「-」を使用してください.");
  }
  if (!identifierPattern.test(commonSettings.itemCatalogId)) {
    errors.push("Item Catalog IDは小文字の英数字・「.」「_」「-」を使用してください.");
  }
  if (!commonSettings.itemCatalogName) {
    errors.push("Item Catalogの名前を入力してください.");
  }

  return errors;
}

//出力可否の判定では、画像別設定と共通設定の両方を確認する.
function validateSettings(imageSettings, commonSettings) {
  return [
    ...validateImageSettings(imageSettings),
    ...validateCommonSettings(commonSettings)
  ];
}

//全画像の設定を検証し、ブロックIDの重複も確認する.
function validateAllImages() {
  const state = window.PhotoPanelMakerState;
  const errorsByImage = new Map();
  const blockIdOwners = new Map();

  for (const entry of state.images) {
    const errors = validateSettings(entry.settings, state.commonSettings);
    errorsByImage.set(entry.id, errors);
    const blockIdKey = entry.settings.blockId.toLowerCase();

    if (blockIdKey && /^[a-z0-9._-]+$/.test(blockIdKey)) {
      if (!blockIdOwners.has(blockIdKey)) {
        blockIdOwners.set(blockIdKey, []);
      }
      blockIdOwners.get(blockIdKey).push(entry);
    }
  }

  //同一の相対パスへ上書きされないよう、画像別IDの重複を防ぐ.
  for (const owners of blockIdOwners.values()) {
    if (owners.length > 1) {
      for (const entry of owners) {
        errorsByImage.get(entry.id).push(`ID「${entry.settings.blockId}」がほかの画像と重複しています.異なるIDを設定してください.`);
      }
    }
  }

  return errorsByImage;
}

//全体の検証結果から、選択中画像に属するエラーだけを取り出す.
function getImageOnlyErrors(entry, errorsByImage) {
  const state = window.PhotoPanelMakerState;
  const commonErrors = new Set(validateCommonSettings(state.commonSettings));
  const allErrors = errorsByImage.get(entry.id) ?? [];
  return allErrors.filter((message) => !commonErrors.has(message));
}

//生成される各パネルを、小さな画像・ブロック名・ブロックIDで一覧表示する.
function renderOutputSummary(errorsByImage) {
  const state = window.PhotoPanelMakerState;
  const fragment = document.createDocumentFragment();

  if (state.images.length === 0) {
    const empty = document.createElement("p");
    empty.className = "summary-empty";
    empty.textContent = "画像を登録すると、生成されるフォトパネルの一覧がここに表示されます.";
    fragment.append(empty);
    elements.outputSummary.replaceChildren(fragment);
    return;
  }

  const generator = window.PhotoPanelMakerGenerator;

  for (const entry of state.images) {
    const settings = entry.settings;
    const errors = errorsByImage.get(entry.id) ?? [];

    for (const tile of entry.tiles) {
      const indexText = String(tile.index).padStart(2, "0");
      const identifier = generator.buildBlockIdentifier(
        state.commonSettings.namespace,
        `photo_panel_${settings.blockId}`,
        tile.index
      );
      const card = document.createElement("article");
      card.className = "output-summary-card";
      if (errors.length > 0) {
        card.classList.add("has-error");
      }

      //各カードには生成される分割画像そのものを小さく描画する.
      const thumbnail = createOutputThumbnail(entry, tile);
      const details = document.createElement("div");
      details.className = "output-summary-meta";

      const name = document.createElement("strong");
      name.className = "output-summary-name";
      name.textContent = settings.blockName ? `${settings.blockName} ${indexText}` : "（ブロック名未設定）";

      const id = document.createElement("code");
      id.className = "output-summary-id";
      id.textContent = identifier;

      details.append(name, id);
      card.append(thumbnail, details);
      fragment.append(card);
    }
  }

  elements.outputSummary.replaceChildren(fragment);
}

//出力一覧に使う小さな分割画像をCanvasへ描画する.
function createOutputThumbnail(entry, tile) {
  const canvas = document.createElement("canvas");
  const canvasWidth = 64;
  const canvasHeight = 64;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.className = "output-summary-thumbnail";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${entry.file.name} の分割画像 ${String(tile.index).padStart(2, "0")}`);
  canvas.title = entry.file.name;

  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  //元画像の縦横比を崩さず、サムネイル枠に収める.
  const scale = Math.min(canvasWidth / tile.sourceWidth, canvasHeight / tile.sourceHeight);
  const drawWidth = tile.sourceWidth * scale;
  const drawHeight = tile.sourceHeight * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = (canvasHeight - drawHeight) / 2;

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(
    entry.image,
    tile.sourceX,
    tile.sourceY,
    tile.sourceWidth,
    tile.sourceHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  return canvas;
}

//指定した設定欄の近くへエラーを表示する.
function renderValidation(errors, target = elements.validationMessage) {
  if (!errors || errors.length === 0) {
    hideValidation(target);
    return;
  }

  target.textContent = errors.join(" ");
  target.classList.remove("hidden");
}

//指定したエラー表示を消す.
function hideValidation(target = elements.validationMessage) {
  target.textContent = "";
  target.classList.add("hidden");
}

//画像比率とブロック配置比率の差が大きい場合に注意を表示する.
function renderRatioWarning(entry) {
  const sourceRatio = entry.image.naturalWidth / entry.image.naturalHeight;
  const blockRatio = entry.settings.columns / entry.settings.rows;
  const difference = Math.abs(sourceRatio - blockRatio) / sourceRatio;

  if (difference < 0.03) {
    elements.ratioWarning.classList.add("hidden");
    return;
  }

  elements.ratioWarning.textContent = `注意：画像比率 ${sourceRatio.toFixed(2)} と分割比率 ${blockRatio.toFixed(2)} が異なります.配置時に画像が横または縦に伸びて見える場合があります.`;
  elements.ratioWarning.classList.remove("hidden");
}

//全画像のファイルを生成し、1つのZIPへまとめてダウンロードする.
async function downloadFiles() {
  saveActiveSettings();
  saveCommonSettings();
  const state = window.PhotoPanelMakerState;
  const generator = window.PhotoPanelMakerGenerator;
  const ZipWriter = window.PhotoPanelMakerZip.ZipWriter;
  const errorsByImage = validateAllImages();
  const invalidImages = state.images.filter((entry) => (errorsByImage.get(entry.id) ?? []).length > 0);

  if (state.images.length === 0) {
    showValidation("画像を登録してください.", elements.uploadValidationMessage);
    return;
  }

  if (invalidImages.length > 0) {
    //共通設定と、現在選択中の画像別設定のエラーをそれぞれの場所に表示する.
    renderValidation(validateCommonSettings(state.commonSettings), elements.validationMessage);
    const activeImage = getActiveImage();
    renderValidation(activeImage ? getImageOnlyErrors(activeImage, errorsByImage) : [], elements.imageValidationMessage);
    elements.downloadMessage.textContent = "出力できない設定があります.画像一覧を切り替えてエラーを確認してください.";
    return;
  }

  elements.downloadButton.disabled = true;
  elements.downloadMessage.textContent = "すべての画像を1つのZIPへまとめています…";

  try {
    const files = await generator.buildAddonFiles(state.images, state.commonSettings);
    const zip = new ZipWriter();

    //生成したファイルを1つずつZIPへ追加する.
    for (const file of files) {
      zip.add(file.path, file.data);
    }

    const blob = zip.toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = generator.buildArchiveName(state.images, state.commonSettings);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    elements.downloadMessage.textContent = `${state.images.length}枚の画像分を1つのZIPにまとめました.`;
  } catch (error) {
    console.error(error);
    elements.downloadMessage.textContent = "生成に失敗しました.画像のサイズを小さくして再試行してください.";
  } finally {
    const finalErrors = validateAllImages();
    elements.downloadButton.disabled = state.images.length === 0
      || [...finalErrors.values()].some((errors) => errors.length > 0);
  }
}

//エラーを指定した領域へ表示する.
function showValidation(message, target = elements.validationMessage) {
  target.textContent = message;
  target.classList.remove("hidden");
}
