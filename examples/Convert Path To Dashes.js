/*
    Convert Selected Dashed Strokes
    For Adobe Illustrator

    v2022-03-14

    by m1b
    https://community.adobe.com/t5/user/viewprofilepage/user-id/13791991

    Function:
    To convert dashed stroke into actual dashes, ie. to create pathItems
    corresponding to the visible stroke dashes of selected pathItems.

    Usage:
    1. Make selection that includes path items with dashed strokes
    2. Run this script

    Dependencies (keep in same folder as this script):
    1. Bez.js      path-related logic
    2. Dasher.js   dash pattern logic

*/
//@include '../library/Bez.js'
//@include '../library/Dasher.js'



var dashesLayer = makeLayer('dashes');
convertSelectedDashedStrokes({ layer: dashesLayer });


function convertSelectedDashedStrokes(options) {
    /*  options same as Bez.convertToDashes:
            pattern: Array of dash|gap lengths
            alignDashes: Boolean align dashes to corners and path ends
            layer: Layer to place dashes
            strokeCap: StrokeCap type of line capping
            strokeColor: Swatch or Color or Number to color dashes
            strokeJoin: StrokeJoin type of joints
            strokeMiterLimit: Number mitre limit
            strokeWidth: Number width of stroke in pts

        All parameters are optional; if not supplied,
        script will use path item's own properties.
    */

    // get all the pathItems in the selection
    // even inside groups
    var doc = app.activeDocument,
        items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

    for (var i = 0; i < items.length; i++) {
        var item = items[i];

        if (item.typename == 'CompoundPathItem') {
            // special handling of
            // compound path items

            // duplicate
            var dup = item.duplicate();
            doc.selection = null;
            dup.selected = true;
            // uncompound
            app.executeMenuCommand('noCompoundPath');
            // collect the resulting path items
            var pathItemsToRemove = [];
            for (var j = 0; j < doc.selection.length; j++) {
                pathItemsToRemove.push(doc.selection[j]);
            }
            // convert to dashes and remove duplicate
            for (var j = pathItemsToRemove.length - 1; j >= 0; j--) {
                convertPathItemToDashes(pathItemsToRemove[j], options)
                pathItemsToRemove[j].remove();
            }
        } else {
            // normal path item
            convertPathItemToDashes(item, options);
        }
    }

}


function convertPathItemToDashes(item, options) {
    // convert one path item
    var bez = new Bez({ pathItem: item });
    bez.convertToDashes(options);
}


function itemsInsideGroupItems(items, typenames, level) {
    // returns an array containing items, including items found inside GroupItems
    // typename can be a string, or an array of strings, eg. ['PathItem','CompoundPathItem']
    try {
        if (level == undefined) level = 0;
        var found = [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.uuid != undefined) {
                if (item.typename == 'GroupItem') {
                    found = found.concat(itemsInsideGroupItems(item.pageItems, typenames, level + 1));
                } else if (typenames === undefined || itemIsType(item, typenames)) {
                    found.push(item);
                }
            }
        }
        return found;
    } catch (err) {
        alert('itemsInsideGroupItems: ' + err)
    }
}

function itemIsType(item, typenames) {
    // returns true if item.typename matches any of the typenames
    if (item === undefined) throw 'itemIsType: No item supplied.';
    if (typenames === undefined) throw 'itemIsType: No typenames supplied.';
    if (!typenames.constructor.name == 'Array') typenames = [typenames];
    var matched = false;
    for (var i = 0; i < typenames.length; i++) {
        if (typenames[i] == item.typename) {
            matched = true;
            break;
        }
    }
    return matched;
}

function makeLayer(name, doc) {
    // makes a new layout in active document, if not present
    doc = doc || app.activeDocument;
    var newLayer;
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        if (doc.layers[i].name == name) {
            newLayer = doc.layers[i];
            break;
        }
    }
    if (newLayer == undefined) {
        newLayer = app.activeDocument.layers.add()
        newLayer.name = name;
    }
    return newLayer;
}