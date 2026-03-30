//@include '../library/Bez.js'


/**
 * Example using Bez `makeHash`
 * and `doesMatchItem` method,
 * to select all path items that
 * match the selected item.
 * @author m1b
 * @version 2023-01-17
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument,
        item = doc.selection[0];

    if (
        doc.selection.length == 0
        || item == undefined
        || (
            item.typename != 'PathItem'
            && item.typename != 'CompoundPathItem'
        )
    ) {
        alert('Please select a Path Item to match and try again.');
        return;
    }

    // find matching path items
    var found = getPathItemsMatchingPathItem(item, doc.pageItems, 0.1, 0.1);

    // example usage: select the found items
    found.push(item);
    doc.selection = found;


    /**
     * Return any `items` that match `item`
     * according a comparison of bez hashes;
     * @param {(PathItem|CompoundPathItem)} item - the path item to match to.
     * @param {Array<(PathItem|CompoundPathItem)>} items - array/collection of path items to match.
     * @returns
     */
    function getPathItemsMatchingPathItem(item, items, angleTolerance, lengthRatioTolerance) {

        items = itemsInsideGroupItems(items, ['PathItem', 'CompoundPathItem']);
        // items = Mittens.getItems({from: items});

        var bez = new Bez({ pageItem: item }),
            hash = bez.makeHash(),
            found = [];

        for (var i = 0; i < items.length; i++) {

            if (item.uuid === items[i].uuid)
                continue;

            debugger; // 2024-09-02

            if (bez.doesMatchItem({
                pageItem: items[i],
                angleTolerance: angleTolerance,
                lengthRatioTolerance: lengthRatioTolerance,
            }))
                found.push(items[i]);

        }

        return found;

    };


})();