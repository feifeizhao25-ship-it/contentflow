        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._negative_cache: dict[str, float] = {}
        with self._lock:
            # A new vector can satisfy an earlier semantic miss.
            self._negative_cache.clear()
            self._cache[key] = {
        with self._lock:
            negative_expires = self._negative_cache.get(key)
            if negative_expires is not None:
                if negative_expires > now:
                    self._misses += 1
                    return None
                self._negative_cache.pop(key, None)

            self._misses += 1
            # Repeated identical misses otherwise rescan the entire cache.
            self._negative_cache[key] = now + min(self.default_ttl, 60)
            return None
        self._cache.clear()
        self._negative_cache.clear()