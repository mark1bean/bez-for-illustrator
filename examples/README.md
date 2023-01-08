# Example Scripts

Lightweight scripts that demonstrate some of the functionality of Bez.js for Adobe Illustrator.

## Installation

To get all the example scripts, just download the [latest release](https://github.com/mark1bean/bez-for-illustrator/releases/latest/download/bez-for-illustrator.zip) and you'll have everything you need. Feel free to move the library files wherever you like, but you'll need to adjust the `//@include` paths in the example scripts so that they link up as required.

$~$
***

## Add Path Point At Extrema.js

Select a whole path or just part of a path and run script. Will add extra path points at each extreme of the curve.

<img src="../images/add-point-at-extrema-anim.gif" alt="Add Path Point At Extrema.js demo animation" width="450"/>

$~$
***

## Convert Path To Dashes.js

Select a path item that has a dashed stroke and run script. Converts into actual dashes, each a separate path. The real deal.

<img src="../images/convert-to-dashes-anim.gif" alt="Convert Path To Dashes.js demo animation" width="450"/>

$~$
***

## Convert Path To Polygon.js

Select a path item and run script. Converts into a polygon with straight-line segments. The average distance between points can be set via the script parameter (called 'flatness'). A flatness of 10 means each added path point will be approximately 10 pts from the previous.

<img src="../images/convert-to-polygon-anim.gif" alt="Convert Path To Polygon.js demo animation" width="450"/>

$~$
***

## Find Visual Center.js

Select a path item and run script. It will draw a circle over the item, showing the best calculated position and size of the visual center. It will also put draw a random label and scale it to fit to the visual center.

<img src="../images/find-visual-center-anim.gif" alt="Find Visual Center.js demo animation" width="450"/>

$~$
***

## Interpolate Between Paths.js

Select two compatible (same number of points) path items in Illustrator and run script. The number of steps, and the distribution can be specified.

<img src="../images/interpolate-anim.gif" alt="Interpolate Between Paths.js demo animation" width="450"/>

### Example 1: make 6 new paths, evenly-distributed

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], 6);
```

### Example 2: make a single new path at 20% position (t == 0.2)

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.2]);
```

### Example 3: make 6 new paths given explicit distribution

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.05, 0.15, 0.3, 0.7, 0.85, 0.95]);
```

### Example 4: make 6 new paths distributed by an ease function

```javascript
var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], 6, easeOutQuad);
```

$~$
***

## Please help with testing

Please post any issues you come across.

$~$
***

## System requirements

As of 2022-12-23, tested only on AI version 26.1 (MacOS 12.1), but should work on AI for Windows any version of the last 10 years.

$~$
***

## Acknowledgements

Thanks so much to Hiroyuki Sato, who got me started with his bezier math code from his excellent [Divide (length).js script](https://github.com/Shanfan/Illustrator-Scripts-Archive/blob/master/jsx/Divide%20(length).jsx).

To calculate extrema, I use code from [Timo's answer on stackoverflow](https://stackoverflow.com/questions/2587751/an-algorithm-to-find-bounding-box-of-closed-bezier-curves). Thanks Timo.

To calculate visual center, I ported code from Volodymyr Agafonkin's amazing [PolyLabel](https://github.com/mapbox/polylabel). Thanks so much Volodymyr.

$~$
***

## Support my scripting

It takes a lot of time to put these tools together. If you would like to show your support for my work, please [donate $5](https://paypal.me/mark1bean/USD5) or [another amount](https://paypal.me/mark1bean).
