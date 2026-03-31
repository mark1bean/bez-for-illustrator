if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}
if ('undefined' === typeof Explr) {
    //@include '/Users/mark/Scripting/Indesign/Lib/Explr.js'
}

/**
 * Add Path Points at Extrema of selected path/segments.
 * @author m1b
 * @version 2022-05-23
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument;
    var items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

    for (var i = 0; i < items.length; i++) {

        if (
            items[i].typename == 'PathItem'
            || items[i].typename == 'CompoundPathItem'
        ) {
            var bez = new Bez({ pageItem: items[i] });
            bez.addExtrema({ selectedSegmentsOnly: true });
            bez.select();
        }

    }

})();