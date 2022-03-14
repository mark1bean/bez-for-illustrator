/*
    Add Path Point at Extrema
    For Adobe Illustrator 2022

    v2022-03-14

    by m1b:
    https://community.adobe.com/t5/user/viewprofilepage/user-id/13791991

    Usage:
    1. Make selection that includes path items
    2. Run this script

    Function:
    Add anchor points at extreme points (horizontal/vertical)
    of selected curve segments.

    Dependencies (keep in same folder as this script):
    1. Bez.js      path-related logic

*/
//@include './Bez.js'

if (Bez == undefined)
    throw 'Must have Bez.js in same folder as this script.';

var doc = app.activeDocument,
    items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

for (var i = 0; i < items.length; i++) {
    if (
        items[i].typename == 'PathItem'
        || items[i].typename == 'CompoundPathItem'
    ) {
        var bez = new Bez({ pathItem: items[i] });
        bez.addPathPointAtExtrema(true);
        bez.select();
    }
}
