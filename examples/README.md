# Example Scripts

Lightweight scripts that demonstrate some of the functionality of Bez.js for Adobe Illustrator.


## Installation

To get all the example scripts, just download the [latest release](https://github.com/mark1bean/bez-for-illustrator/releases/latest/download/bez-for-illustrator.zip) and you'll have everything you need. Feel free to move the library files wherever you like, but you'll need to adjust the `//@include` paths in the example scripts so that they link up as required.

$~$
***


## Add Path Point At Extrema.js

Select a PathItem in Illustrator and run script. You can select just the path segments that you wish to add the anchor points to, or you can select the whole path, or paths.

![Add Path Point At Extrema.js demo animation](images/add-extrema-anim.gif)


## Convert Path To Dashes.js

XXX

![Dasher.js demo animation](images/dasher-anim.gif)


## Convert Path To Polygon.js

XXX

![Dasher.js demo animation](images/dasher-anim.gif)


## Find Visual Center.js

Select a PathItem or CompoundPathItem in Illustrator and run script. You can select just the path segments that you wish to add the anchor points to, or you can select the whole path, or paths.

![Add Path Point At Extrema.js demo animation](images/add-extrema-anim.gif)


## Interpolate Between Paths.js

Select two compatible path items in Illustrator and run script. See variations:

#### Example 1: make 6, evenly-distributed, interpolated paths

```javascript
var doc = app.activeDocument;
var items = doc.selection;
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], 6);
```

#### Example 2: make a single new path at 20% position (t == 0.2)

```javascript
var doc = app.activeDocument;
var items = doc.selection;
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.2]);
```

#### Example 3: make 6 new paths at specific interpolated positions

```javascript
var doc = app.activeDocument;
var items = doc.selection;
var newPaths = Bez.pathItemsFromInterpolation(items[0], items[1], [0.05, 0.15, 0.3, 0.7, 0.85, 0.95]);
```

>Note: path items have the same number of path points.

![Interpolate Between Paths.js demo animation](images/interpolate-paths-anim.gif)


$~$
***

## Why this project?

Someone the adobe community forum asked for a script that added an anchor point at the top extrema of a path. I had recently created Bez.js for [another project](https://github.com/mark1bean/dasher-for-illustrator). It already had some of the logic required for this and so I decided to extend it.

$~$
***

## Please help with testing

As of 2022-03-14, this script is hardly tested at all, and only on my machine. Adobe Illlustrator 2022 (v26), MacOS 12.2.1.

Please post any issues you come across.

$~$
***

## System requirements

As of 2022-01-24, tested only on AI version 26.1 (MacOS 12.1).

$~$
***

## Acknowledgements

Thanks so much to Hiroyuki Sato, for his bezier maths code from his excellent [Divide (length).js script](https://github.com/Shanfan/Illustrator-Scripts-Archive/blob/master/jsx/Divide%20(length).jsx).

To calculate extrema, I use code from [Timo's answer on stackexchange](https://stackoverflow.com/questions/2587751/an-algorithm-to-find-bounding-box-of-closed-bezier-curves). Thanks Timo.
