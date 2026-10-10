"use strict";

//画像を行・列ごとのタイル情報へ分割する。
function createTiles(image, columns, rows) {
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * image.naturalHeight) / rows);
    const y1 = Math.floor(((row + 1) * image.naturalHeight) / rows);

    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.floor((column * image.naturalWidth) / columns);
      const x1 = Math.floor(((column + 1) * image.naturalWidth) / columns);

      tiles.push({
        index: row * columns + column + 1,
        row,
        column,
        sourceX: x0,
        sourceY: y0,
        sourceWidth: Math.max(1, x1 - x0),
        sourceHeight: Math.max(1, y1 - y0)
      });
    }
  }

  return tiles;
}

//分割位置と番号を重ねたプレビューを描画する。
function drawPreview(canvas, previewWrap, image, tiles) {
  const maxWidth = Math.min(900, Math.max(240, previewWrap.clientWidth - 20));
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  context.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 350));
  context.font = `${Math.max(11, Math.round(Math.min(width, height) / 28))}px system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const tile of tiles) {
    const x = tile.sourceX * scale;
    const y = tile.sourceY * scale;
    const tileWidth = tile.sourceWidth * scale;
    const tileHeight = tile.sourceHeight * scale;
    const radius = Math.max(10, Math.min(tileWidth, tileHeight) * 0.12);

    context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    context.strokeRect(x, y, tileWidth, tileHeight);

    context.fillStyle = "rgba(0, 0, 0, 0.62)";
    context.beginPath();
    context.arc(x + tileWidth / 2, y + tileHeight / 2, radius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff";
    context.fillText(String(tile.index).padStart(2, "0"), x + tileWidth / 2, y + tileHeight / 2);
  }
}

//分割した各画像と対応するブロックIDを一覧表示する。
function renderTileList(container, image, tiles, buildBlockIdentifier) {
  const fragment = document.createDocumentFragment();

  for (const tile of tiles) {
    const card = document.createElement("article");
    card.className = "tile-card";

    const tileImage = document.createElement("img");
    tileImage.alt = `分割画像 ${tile.index}`;
    tileImage.src = createTileDataUrl(image, tile);

    const id = document.createElement("div");
    id.className = "tile-id";
    id.textContent = buildBlockIdentifier(tile.index);

    card.append(tileImage, id);
    fragment.append(card);
  }

  container.replaceChildren(fragment);
}

//分割した1枚をプレビュー表示用のData URLへ変換する。
function createTileDataUrl(image, tile) {
  const canvas = document.createElement("canvas");
  canvas.width = tile.sourceWidth;
  canvas.height = tile.sourceHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  context.drawImage(
    image,
    tile.sourceX,
    tile.sourceY,
    tile.sourceWidth,
    tile.sourceHeight,
    0,
    0,
    tile.sourceWidth,
    tile.sourceHeight
  );

  return canvas.toDataURL("image/png");
}

//プレビュー関数を画像分割ツールへ公開する。
window.PhotoPanelMakerPreview = {
  createTiles,
  drawPreview,
  renderTileList
};
