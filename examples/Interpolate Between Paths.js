//@include '../library/Bez.js'

/**
 * Convert Selected Paths to Polygons
 * @author m1b
 * @version 2022-12-23
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument;

    if (doc.selection.length != 2) {
        alert('Please select two path items and try again.');
        return;
    }

    /**
     * Example 1:
     * Make 6, evenly-distributed, interpolated paths
     */
    function example1() {

        var items = Bez.pathItemsFromInterpolation(
            {
                pathItem1: doc.selection[0],
                pathItem2: doc.selection[1],
                steps: 3
            }
        );

    };

    /**
     * Example 2:
     * Make a single path interpolated at 20%.
     */
    function example2() {

        var items = Bez.pathItemsFromInterpolation(
            {
                pathItem1: doc.selection[0],
                pathItem2: doc.selection[1],
                values: [0.2]
            }
        );

    };


    /**
     * Example 3:
     * Make 6 interpolated paths at specific interpolations.
     */
    function example3() {

        var items = Bez.pathItemsFromInterpolation(
            {
                pathItem1: doc.selection[0],
                pathItem2: doc.selection[1],
                values: [0.05, 0.15, 0.3, 0.7, 0.85, 0.95]
            }
        );

    };


    /**
     * Example 4:
     * Make 6 interpolated paths with a custom value function.
     */
    function example4() {

        var items = Bez.pathItemsFromInterpolation(
            {
                pathItem1: doc.selection[0],
                pathItem2: doc.selection[1],
                steps: 6,
                valueFunction: easeOutQuad
            }
        );

    };


    // example easing function
    // see also Ease.js in ../libary
    function easeOutQuad(t) { return t * (2 - t) };


})();