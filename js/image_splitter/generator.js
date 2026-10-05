"use strict";

//共通IDに2桁の連番を付けてブロックIDを作る。
function buildBlockIdentifier(baseIdentifier, index) {
  return `${baseIdentifier}_${String(index).padStart(2, "0")}`;
}

//ZIPファイル名を作る。
function buildArchiveName(blockId) {
  const blockName = blockId.split(":")[1] || "image_blocks";
  const safeName = blockName.replace(/[^a-z0-9._-]+/gi, "_");
  return `${safeName}_split_blocks.zip`;
}

//既存アドオンへ追加するBP / RPファイルだけを組み立てる。
async function buildAddonFiles(settings) {
  const [namespace, blockBase] = settings.blockId.split(":");
  const rootFolder = "ImageSplitBlocks";
  const bpFolder = `${rootFolder}/BP`;
  const rpFolder = `${rootFolder}/RP`;
  const files = [];
  const textureData = {};
  const langLines = [];
  const state = window.ImageSplitterState;
  const common = window.ToolCommon;
  const imageApi = window.ImageSplitterImage;

  //各分割画像についてBPのブロック定義とRPのテクスチャを作る。
  for (const tile of state.tiles) {
    const indexText = String(tile.index).padStart(2, "0");
    const identifier = buildBlockIdentifier(settings.blockId, tile.index);
    const textureAlias = `${namespace}_${blockBase}_${indexText}`;
    const texturePath = `textures/blocks/${textureAlias}.png`;
    const textureBlob = await imageApi.createTileBlob(state.image, tile);
    const blockFileName = `${blockBase}_${indexText}.json`;

    files.push({
      path: `${bpFolder}/blocks/${blockFileName}`,
      data: common.jsonBytes({
        format_version: "1.21.80",
        "minecraft:block": {
          description: {
            identifier,
            menu_category: {
              category: "construction"
            }
          },
          components: {
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {
              "*": {
                texture: textureAlias,
                render_method: "opaque"
              }
            },
            "minecraft:item_visual": {
              geometry: "minecraft:geometry.full_block",
              material_instances: {
                "*": {
                  texture: textureAlias,
                  render_method: "opaque"
                }
              }
            }
          }
        }
      })
    });

    files.push({
      path: `${rpFolder}/${texturePath}`,
      data: new Uint8Array(await textureBlob.arrayBuffer())
    });

    //terrain_texture.jsonで使うテクスチャ名とPNGの場所を登録する。
    textureData[textureAlias] = {
      textures: texturePath.replace(/\.png$/i, "")
    };

    //ja_JP.langには生成したブロック名だけを書き込む。
    langLines.push(`tile.${identifier}.name=${common.escapeLangText(`${settings.blockName} ${indexText}`)}`);
  }

  //terrain_texture.jsonでテクスチャ名とPNGを関連付ける。
  files.push({
    path: `${rpFolder}/textures/terrain_texture.json`,
    data: common.jsonBytes({
      texture_name: "atlas.terrain",
      padding: 8,
      num_mip_levels: 4,
      texture_data: textureData
    })
  });

  //日本語のブロック表示名だけを定義する。
  files.push({
    path: `${rpFolder}/texts/ja_JP.lang`,
    data: common.textBytes(`${langLines.join("\n")}\n`)
  });

  return files;
}

//ファイル生成関数を画像分割ツールへ公開する。
window.ImageSplitterGenerator = {
  buildAddonFiles,
  buildArchiveName,
  buildBlockIdentifier
};
