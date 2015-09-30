# http-keeper

[![NPM](https://nodei.co/npm/http-keeper.png)](https://nodei.co/npm/http-keeper/)

Basic offline keeper with fallback to fetching files via http

# Usage

Almost the same as [offline-keeper](https://github.com/tradle/offline-keeper)

```js
// only difference:
var keeper = new Keeper({
  path: 'storage/dir',
  fallbacks: [
    'http://keeper.somewhere.com',
    'http://keeper.somewhereelse.com'
  ]
})
```
