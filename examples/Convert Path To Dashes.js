if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}
if ('undefined' === typeof Dasher) {
    //@include '../library/Dasher.js'
}

/**
 * Convert Selected Paths to Dashes
 * @author m1b
 * @version 2022-12-29
 * @requires Bez.js
 * @requires Dasher.js
 */
(function () {

    // make a layer to put the new dash items
    var dashesLayer = makeLayer('dashes');

    // convert to dashes
    convertSelectedDashedStrokes(
        {
            layer: dashesLayer,
            keepOriginal: false
        }
    );

    /**
     * Converts selected path items with
     * dashed strokes into individual dashes.
     * @param {Object} options
     * @param {Layer} [options.layer] - layer to place dashes on.
     * @param {Boolean} [options.keepOriginal] - whether to keep the original path item.
     */
    function convertSelectedDashedStrokes(options) {

        var doc = app.activeDocument,

            // get all the pathItems in the selection
            items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

        for (var i = 0; i < items.length; i++) {

            var item = items[i];

            if (item.typename == 'CompoundPathItem') {

                var dup = item.duplicate();
                doc.selection = null;
                dup.selected = true;

                // uncompound
                app.executeMenuCommand('noCompoundPath');

                // collect the resulting path items
                var pathItemsToRemove = [];
                for (var j = 0; j < doc.selection.length; j++)
                    pathItemsToRemove.push(doc.selection[j]);

                // convert to dashes and remove uncompounded pieces
                for (var j = pathItemsToRemove.length - 1; j >= 0; j--) {
                    convertPathItemToDashes(pathItemsToRemove[j], options);
                    pathItemsToRemove[j].remove();
                }

                if (!options.keepOriginal)
                    item.remove();

            }

            else {

                // normal path item
                convertPathItemToDashes(item, options);

                if (!options.keepOriginal)
                    item.remove();

            }

        }

    };


    /**
     * Convert one path item to dashes.
     * @param {PathItem} item - an Illustrator PathItem.
     * @param {Object} options - the same options as Bez.convertPathItemToDashes.
     */
    function convertPathItemToDashes(item, options) {

        Bez.convertPathItemToDashes({
            pathItem: item,
            container: options.layer,
        });

    };


    /**
     * Makes a new Layer in doc, unless
     * that layer already exists.
     * @param {String} name - the name of the Layer.
     * @param {Document} [doc] - the Illustrator Document (default: active document).
     * @returns {Layer}
     */
    function makeLayer(name, doc) {

        doc = doc || app.activeDocument;

        var newLayer;

        for (var i = doc.layers.length - 1; i >= 0; i--) {

            if (doc.layers[i].name == name) {
                newLayer = doc.layers[i];
                break;
            }

        }

        if (newLayer == undefined) {
            newLayer = app.activeDocument.layers.add();
            newLayer.name = name;
        }

        return newLayer;

    };


})();
