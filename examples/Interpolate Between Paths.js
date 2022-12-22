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
    var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], [0.2]);

    // example 3: make 6 interpolated paths at specific interpolations
    var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], [0.05, 0.15, 0.3, 0.7, 0.85, 0.95]);

*/
//@include '../library/Bez.js'


if (Bez == undefined)
    throw Error('Cannot find the required script file "Bez.js".');

var doc = app.activeDocument;

var items = Bez.pathItemsFromInterpolation(doc.selection[0], doc.selection[1], 6);