const {
  DEFAULT_SEARCH_CACHE_PATH,
  JsonLegalCacheStore,
} = require("./legal-cache-store");

class SearchIndex extends JsonLegalCacheStore {}

module.exports = {
  DEFAULT_SEARCH_CACHE_PATH,
  JsonLegalCacheStore,
  SearchIndex,
};
