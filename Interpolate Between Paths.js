/*
    Interpolate Between Paths
    For Adobe Illustrator 2022

    v2022-05-22
    by m1b

    Function:
    Creates new paths by interpolating the two selected paths.

    Usage:
    1. Select two compatible path items (same number of path points)
    2. Run this script

    Dependencies (keep in same folder as this script):
    • Bez.js      https://github.com/mark1bean/bez-for-illustrator

    // example 1: make 6 interpolated paths
    var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], 6);

    // example 2: make a single new path interpolated at t == 20%
    var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], undefined, 0.2);

*/
//@include './Bez.js'

if (Bez == undefined)
    throw 'Must have Bez.js in same folder as this script.';

var doc = app.activeDocument,
    items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], 5);
