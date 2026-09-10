# Vendored map geometry

`countries-110m.json` is the Natural Earth 1:110m countries TopoJSON from the
[`world-atlas`](https://github.com/topojson/world-atlas) package (v2.0.2).

Natural Earth data is in the public domain. The `world-atlas` build scripts are
ISC-licensed (Copyright 2013-2019 Michael Bostock). The geometry is vendored so
the map has no runtime network dependency. It is loaded lazily only on the map
view and is excluded from the bundle-size budget.

Country shapes are drawn as context only. Incident markers come exclusively from
each record's `geo` block in the dataset; nothing is geocoded here.
