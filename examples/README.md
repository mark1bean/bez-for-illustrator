# Example Scripts

Lightweight scripts that demonstrate some of the functionality of Bez.js for Adobe Illustrator.

## Installation

To get all the example scripts, just download the [latest release](https://github.com/mark1bean/bez-for-illustrator/releases/latest/download/bez-for-illustrator.zip) and you'll have everything you need. Feel free to move the library files wherever you like, but you'll need to adjust the `//@include` paths in the example scripts so that they link up as required.

$~$
***

## Add Extra Path Points.js

Select a whole path or just part of a path and run script. Will add extra path points according to the script options.

<img src="../images/add-extra-path-points-anim.gif" alt="Add Extra Path Points.js demo animation" width="450"/>


$~$
### Examples:

(1) adds a point approximately every 25 points distance.

```javascript
bez.addExtraPointsBetweenPoints( { distance: 25 } );
```

(2) adds 3 points between every anchor point.

```javascript
bez.addExtraPointsBetweenPoints( { numberOfPoints: 3 } );
```

(3) adds points at 45%, 50% and 55% along each segment.

```javascript
bez.addExtraPointsBetweenPoints( { values: [ 0.45, 0.5, 0.55 ] } );
```

(4) adds points at 25 pts and 50pts from each end of segment.

```javascript
bez.addExtraPointsBetweenPoints( { lengths: [ 25, 50, -25, -50 ] } );
```

(5) adds a point approximately every 15 points distance, but only if the segment is curved.

```javascript
bez.addExtraPointsBetweenPoints(
    {
        distance: 15,
        filterFunction: Bez.isCurvedSegment
    } );
```

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

### Examples:

(1) make 6 new paths, evenly-distributed

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], 6);
```

(2) make a single new path at 20% position (t == 0.2)

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.2]);
```

(3) make 6 new paths given explicit distribution

```javascript
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.05, 0.15, 0.3, 0.7, 0.85, 0.95]);
```

(4) make 6 new paths distributed by an ease function

```javascript
var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], 6, easeOutQuad);
```

$~$
***

## Match Path Items.js

Select a path item and run script. Script will select any other matching path items.

<img src="../images/match-path-items-anim.gif" alt="Match Path Items.js demo animation" width="450"/>

Works by generating hashes from the path items that can be matched against each other. The hashes will be matchable even if the path item is moved, rotated or scaled. The matching parameters can be widened to match different path items with similar properties, eg. rectangles with differing aspect ratios.

The matching system doesn't take appearance into account, only the basic path geometry.

$~$
***

## Please help with testing

Post any issues you come across.

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
