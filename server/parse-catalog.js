const axios = require('axios');
// cheerio загружается лениво (только при реальном парсинге HTML)
let cheerio = null;

/**
 * Парсинг Steam для получения игр
 * ВНИМАНИЕ: Используй только легальные источники!
 * Этот код - заглущка, замените на реальный парсинг нужного сайта
 */
async function parseSteamCatalog() {
  try {
    // Пример парсинга (нужно адаптировать под нужный сайт)
    // const { data } = await axios.get('https://store.steampowered.com/explore/');
    // const $ = cheerio.load(data);
    // const games = [];
    // $('.game_area').each((i, el) => {
    //   games.push({
    //     id: `steam_${i}`,
    //     name: $(el).find('.game_name').text().trim(),
    //     description: '',
    //     cover: $(el).find('img').attr('src'),
    //     sources: {},
    //     size: 0,
    //     genre: ''
    //   });
    // });
    // return games;
    
    // Сейчас возвращаем заглушку - данные из catalog.json
    return getCatalogFromJSON();
  } catch (err) {
    console.error('[Steam Parser] Error:', err.message);
    return getCatalogFromJSON(); // fallback
  }
}

// Чтение локального catalog.json
async function getCatalogFromJSON() {
  const fs = require('fs-extra');
  const path = require('path');
  const catalogPath = path.join(__dirname, '../public/catalog.json');
  
  if (await fs.pathExists(catalogPath)) {
    const content = await fs.readFile(catalogPath, 'utf8');
    return JSON.parse(content);
  }
  return [];
}

module.exports = { parseSteamCatalog };
