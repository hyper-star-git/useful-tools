"use strict";

//フォトパネルのブロックIDを作る.
function buildBlockIdentifier(namespace, blockBase, index) {
  return `${namespace}:${blockBase}_${String(index).padStart(2, "0")}`;
}

//共通の名前空間と各画像のIDをつなげてZIPファイル名を作る.
function buildArchiveBaseName(imageEntries, commonSettings) {
  const parts = [...new Set(imageEntries.map((entry) => `${commonSettings.namespace}_${entry.settings.blockId}`))];
  let safeName = parts.join(" + ").replace(/[^a-z0-9._+ -]+/gi, "_").trim();

  //大量の画像でもファイル名が長くなりすぎないようにする.
  if (safeName.length > 170) {
    safeName = `${safeName.slice(0, 145)}_and_${parts.length}_images`;
  }

  return `[photo panels] ${safeName}`;
}

//ZIPファイル名を作る.
function buildArchiveName(imageEntries, commonSettings) {
  return `${buildArchiveBaseName(imageEntries, commonSettings)}.zip`;
}

//全ブロックで共有するフォトパネル用モデルを定義する.
function buildPhotoPanelGeometry() {
  return {
    format_version: "1.21.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: "geometry.photo_panel",
          texture_width: 16,
          texture_height: 16,
          visible_bounds_width: 1,
          visible_bounds_height: 1,
          visible_bounds_offset: [0, 0.5, 0]
        },
        bones: [
          {
            name: "root",
            pivot: [0, 8, 0],
            cubes: [
              {
                origin: [-8, 0, -8],
                size: [16, 16, 1],
                uv: {
                  south: {
                    uv: [0, 0],
                    uv_size: [16, 16],
                    material_instance: "photo_panel"
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

//複数画像分のBP / RPファイルをまとめて組み立てる.
async function buildAddonFiles(imageEntries, commonSettings) {
  const files = [];
  const textureData = {};
  const langLines = [];
  const common = window.ToolCommon;
  const imageApi = window.PhotoPanelMakerImage;
  const catalogGroups = new Map();
  const bpFolder = "BP";
  const rpFolder = "RP";

  //画像ごとの分割データを順番にZIP内へ追加する.
  for (const entry of imageEntries) {
    //名前空間とItem Catalogは全画像で共有し、IDや分割数は画像別設定を使う.
    const settings = { ...commonSettings, ...entry.settings };
    const namespace = commonSettings.namespace;
    const blockBase = `photo_panel_${settings.blockId}`;
    const catalogIdentifier = `${namespace}:${commonSettings.itemCatalogId}`;
    const catalogTranslationKey = `itemGroup.${catalogIdentifier}.name`;
    const tiles = entry.tiles;

    //Item Catalogは同じ翻訳キーのグループへまとめる.
    if (!catalogGroups.has(catalogTranslationKey)) {
      catalogGroups.set(catalogTranslationKey, {
        icon: null,
        items: [],
        name: commonSettings.itemCatalogName
      });
    }
    const catalogGroup = catalogGroups.get(catalogTranslationKey);

    //分割された画像ごとにブロックJSONとPNGを生成する.
    for (const tile of tiles) {
      const indexText = String(tile.index).padStart(2, "0");
      const identifier = buildBlockIdentifier(namespace, blockBase, tile.index);
      const blockIdWithoutNamespace = `${blockBase}_${indexText}`;
      const textureAlias = blockIdWithoutNamespace;
      const texturePath = `textures/blocks/photo_panels/${textureAlias}.png`;
      const textureBlob = await imageApi.createTileBlob(entry.image, tile);
      const blockFileName = `${blockIdWithoutNamespace}.json`;

      files.push({
        path: `${bpFolder}/blocks/photo_panels/${blockFileName}`,
        data: common.jsonBytes({
          format_version: "1.21.80",
          "minecraft:block": {
            description: {
              identifier,
              menu_category: {
                category: "construction"
              },
              traits: {
                "minecraft:placement_position": {
                  enabled_states: ["minecraft:block_face"]
                }
              }
            },
            components: {
              "minecraft:collision_box": false,
              "minecraft:selection_box": {
                origin: [-8, 0, -8],
                size: [16, 16, 1]
              },
              "minecraft:geometry": "geometry.photo_panel",
              "minecraft:material_instances": {
                "*": {
                  texture: textureAlias,
                  render_method: "opaque"
                },
                photo_panel: {
                  texture: textureAlias,
                  render_method: "opaque"
                }
              },
              "minecraft:placement_filter": {
                conditions: [
                  {
                    allowed_faces: ["north", "south", "east", "west"]
                  }
                ]
              },
              "minecraft:item_visual": {
                geometry: "geometry.photo_panel",
                material_instances: {
                  "*": {
                    texture: textureAlias,
                    render_method: "opaque"
                  },
                  photo_panel: {
                    texture: textureAlias,
                    render_method: "opaque"
                  }
                }
              }
            },
            permutations: [
              {
                condition: "query.block_state('minecraft:block_face') == 'north'",
                components: {
                  "minecraft:transformation": {
                    rotation: [0, -180, 0]
                  }
                }
              },
              {
                condition: "query.block_state('minecraft:block_face') == 'west'",
                components: {
                  "minecraft:transformation": {
                    rotation: [0, -90, 0]
                  }
                }
              },
              {
                condition: "query.block_state('minecraft:block_face') == 'south'",
                components: {
                  "minecraft:transformation": {
                    rotation: [0, 0, 0]
                  }
                }
              },
              {
                condition: "query.block_state('minecraft:block_face') == 'east'",
                components: {
                  "minecraft:transformation": {
                    rotation: [0, 90, 0]
                  }
                }
              }
            ]
          }
        })
      });

      files.push({
        path: `${rpFolder}/${texturePath}`,
        data: new Uint8Array(await textureBlob.arrayBuffer())
      });

      //terrain_texture.jsonでテクスチャ名とPNGを関連付ける.
      textureData[textureAlias] = {
        textures: texturePath.replace(/\.png$/i, "")
      };

      //各ブロックの表示名を翻訳ファイルへ追加する.
      langLines.push(`tile.${identifier}.name=${common.escapeLangText(`${settings.blockName} ${indexText}`)}`);

      //同じCatalogグループに画像のブロックをまとめる.
      if (catalogGroup.icon === null) {
        catalogGroup.icon = identifier;
      }
      catalogGroup.items.push(identifier);
    }
  }

  //すべてのフォトパネルで共有するモデルを1つだけ出力する.
  files.push({
    path: `${rpFolder}/models/blocks/photo_panel.geo.json`,
    data: common.jsonBytes(buildPhotoPanelGeometry())
  });

  //全画像分のテクスチャをterrain_texture.jsonへまとめる.
  files.push({
    path: `${rpFolder}/textures/terrain_texture.json`,
    data: common.jsonBytes({
      texture_name: "atlas.terrain",
      padding: 8,
      num_mip_levels: 4,
      texture_data: textureData
    })
  });

  //各Item Catalogグループを1つのファイルへまとめる.
  const groups = [...catalogGroups.entries()].map(([name, group]) => ({
    group_identifier: {
      icon: group.icon,
      name
    },
    items: group.items
  }));

  files.push({
    path: `${bpFolder}/item_catalog/crafting_item_catalog.json`,
    data: common.jsonBytes({
      format_version: "1.21.60",
      "minecraft:crafting_items_catalog": {
        categories: [
          {
            category_name: "construction",
            groups
          }
        ]
      }
    })
  });

  //全画像のブロック名とCatalog名をja_JP.langへまとめる.
  for (const [translationKey, group] of catalogGroups.entries()) {
    langLines.push(`${translationKey}=${common.escapeLangText(group.name)}`);
  }

  files.push({
    path: `${rpFolder}/texts/ja_JP.lang`,
    data: common.textBytes(`${langLines.join("\n")}\n`)
  });

  return files;
}

//生成処理をツール画面から利用できるように公開する.
window.PhotoPanelMakerGenerator = {
  buildAddonFiles,
  buildArchiveBaseName,
  buildArchiveName,
  buildBlockIdentifier,
  buildPhotoPanelGeometry
};
