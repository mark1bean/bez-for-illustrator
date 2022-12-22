//@include '../library/Bez.js'

if (Bez == undefined)
    throw 'Must have Bez.js in same folder as this script.';


var doc = app.activeDocument,
    item = doc.selection[0],
    bez = new Bez({ pathItem: item });

// convert to polygon with 5pts average distance between path points
bez.convertToPolygon(5);

