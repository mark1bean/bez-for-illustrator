if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}

/**
 * Add path points to selected path items.
 * @author m1b
 * @version 2023-01-18
 * @requires Bez.js
 */
(function () {

    var AddPointsTo = {
        ENTIRE_PATH: 'Entire Path',
        EACH_SEGMENT: 'Each Segment',
    };

    var AddPointsAt = {
        POINT_COUNT: { type: 'Point count', description: 'Add N points' },
        PERCENTAGES: { type: 'Percentages', description: 'Add points at specified percentages' },
        POSITIONS: { type: 'Positions', description: 'Add points at specified distances' },
        INTERVALS: { type: 'Pattern', description: 'Add points at specified intervals' },
        APPROXIMATE_DISTANCE: { type: 'Spaced', description: 'Add a point approximately every N apart' },
    };

    var settings = {
        target: AddPointsTo.ENTIRE_PATH,
        operation: AddPointsAt.PROP,
        value: '2',
        unit: 'mm', // 'cm' // 'in' // 'pt'
        showUI: false,
    };

    var testCases = [
        {
            target: AddPointsTo.ENTIRE_PATH,
            operation: AddPointsAt.POINT_COUNT,
            value: '2',
            unit: 'mm', // 'cm' // 'in' // 'pt'
            showUI: false,
        },
        {
            target: AddPointsTo.ENTIRE_PATH,
            operation: AddPointsAt.PERCENTAGES,
            value: '20,50,60',
            showUI: false,
        },
        {
            target: AddPointsTo.ENTIRE_PATH,
            operation: AddPointsAt.POSITIONS,
            value: '2,3,5,6',
            unit: 'mm', // 'cm' // 'in' // 'pt'
            showUI: false,
        },
        {
            target: AddPointsTo.ENTIRE_PATH,
            operation: AddPointsAt.INTERVALS,
            value: '10,2,10,5',
            unit: 'pt', // mm cm in pt
            showUI: false,
        },
        {
            target: AddPointsTo.ENTIRE_PATH,
            operation: AddPointsAt.APPROXIMATE_DISTANCE,
            value: '20',
            unit: 'pt', // mm cm in pt
            showUI: false,
        }
    ];

    settings = testCases[4];

    if (settings.showUI) {

        var result = showUI(settings);

        if (result == 2)
            // user cancelled
            return;

    }

    // compute unitScale when not using UI
    if (settings.unitScale == undefined)
        settings.unitScale = { pt: 1, mm: 2.834645, cm: 28.34645, 'in': 72 }[settings.unit] || 1;

    // convert values into array of numbers
    var values = parseValues(settings.value, settings.unitScale);

    var divideEachSegment = settings.target === AddPointsTo.EACH_SEGMENT;

    var doc = app.activeDocument;
    var bezs = Bez.fromItems(doc.selection);
    var allPathItems = [];

    itemsLoop:
    for (var i = bezs.length - 1; i >= 0; i--) {

        var bez = bezs[i];

        switch (settings.operation) {

            case AddPointsAt.POINT_COUNT:
                bez.addExtraPointsBetweenPoints({ numberOfPoints: values[0] });
                break;

            case AddPointsAt.PERCENTAGES:
                for (var v = 0; v < values.length; v++)
                    // convert from percentage to 0..1 range
                    values[v] /= 100;
                bez.addExtraPointsBetweenPoints({ values: values });
                break;

            case AddPointsAt.APPROXIMATE_DISTANCE:
                bez.addExtraPointsBetweenPoints({ distance: values[0] });
                break;

            case AddPointsAt.INTERVALS:
                // convert intervals to cumulative positions (absolute from segment start)
                bez.addExtraPointsBetweenPoints({ lengths: convertIntervalsToCumulativePositions(values) });
                break;

            case AddPointsAt.POSITIONS:
                // lengths expects absolute positions from segment start
                bez.addExtraPointsBetweenPoints({ lengths: values });
                break;

            default:
                break;

        }

        allPathItems.push(bez.pageItem);

    } // end itemsLoop

    if (allPathItems.length > 0)
        doc.selection = allPathItems;

    // finished


    /**
     * Converts comma separated string
     * into array of numbers.
     * @param {String} v - the string of values, eg '10,20'.
     * @param {Number} [s] - the scaleFactor (default: no scale).
     * @returns {Array<Number>}
     */
    function parseValues(v, s) {
        s = s || 1;
        var values = [];
        v = v.split(',');
        for (var i = 0; i < v.length; i++) {
            var n = Number(v[i])
            if (n === n)
                values.push(n * s);
        }
        return values;
    };

    /**
     * Converts intervals to cumulative positions from start.
     * For example intervals [10,5,15]
     * would convert to [10,15,30].
     * @param {Array<Number>} intervals - the intervals between points.
     * @returns {Array<Number>} - cumulative positions from segment start.
     */
    function convertIntervalsToCumulativePositions(intervals) {

        var positions = [],
            pos = 0;

        for (var i = 0; i < intervals.length; i++) {
            pos += intervals[i];
            positions.push(pos);
        }

        return positions;

    };


})();

/**
 * Example 1:
 * Ask user to choose distance between added path points.
 */
function example1() {

    var distance = Number(prompt('Enter the distance between added points:', 10));
    if (
        distance == 0
        || isNaN(distance)
    )
        return;

    bez.addExtraPointsBetweenPoints({ distance: distance });

};

/**
 * Example 2:
 * Ask user to choose how many path points to add to each segment, apply to curved segments only.
 */
function example2() {

    var numberOfPoints = Number(prompt('Enter the number of path points to add to each segment:', 3));

    if (
        numberOfPoints == 0
        || isNaN(numberOfPoints)
    )
        return;

    bez.addExtraPointsBetweenPoints(
        {
            numberOfPoints: numberOfPoints,
            // filter: Bez.isCurvedSegment,
        }
    );

};


/**
 * Example 3:
 * Ask user to choose values of path points to add to each segment.
 */
function example3() {

    var values = [],
        userValues = (prompt('Enter position values in range -1..1, separated by commas:', '0.45, 0.5, 0.55') || '').split(/,\s*/g);

    for (var i = 0; i < userValues.length; i++) {

        var v = Number(userValues[i]);

        if (
            isNaN(v)
            || v <= -1
            || v >= 1
        )
            continue;

        values.push(v);

    }

    if (values.length == 0)
        return;

    bez.addExtraPointsBetweenPoints({ values: values });

};


/**
 * Example 4:
 * Ask user to choose lengths of path points to add to each segment.
 */
function example4() {

    var lengths = [],
        userValues = (prompt('Enter lengths, in pts, separated by commas:', '25, 50, -25, -50') || '').split(/,\s*/g);

    for (var i = 0; i < userValues.length; i++) {

        var v = Number(userValues[i]);

        if (!isNaN(v))
            lengths.push(v);

    }

    if (lengths.length == 0)
        return;

    bez.addExtraPointsBetweenPoints({ lengths: lengths });

};


/**
 * Example 5:
 * Add points at set distance, but with easing valueFunction.
 */
function example5() {

    bez.addExtraPointsBetweenPoints(
        {
            distance: 25,
            valueFunction: easeInOutQuad,
        }
    );

};




/**
 * Example custom filter:
 * Returns true only when the segment has control points
 * longer than `curveThreshold`.
 * Note: this function returns a function closure containing
 * the `curveThreshold` parameter. So *call* it (with curveThreshold
 * parameter) when you are passing the filter.
 * @returns {Boolean}
 */
function onlyCurvedSegmentsLargerThan(curveThreshold) {

    return function (p1, p2, segmentLength, distance, numberOfPoints, bounds) {

        var d1 = distanceBetweenPoints(p1.rightDirection, p1.anchor),
            d2 = distanceBetweenPoints(p2.leftDirection, p2.anchor);

        return (
            Math.abs(d1) > curveThreshold
            || Math.abs(d2) > curveThreshold
        );

    };

};


/**
 * Example custom filter:
 * Returns true only when the line p1p2
 * is perfectly horizontal or vertical.
 * @returns {Boolean}
 */
function onlyHorizontalOrVerticalStraightLines(p1, p2, segmentLength, distance, numberOfPoints, bounds) {

    var angle = round(getAngleABC([p1.anchor[0] + 1, p1.anchor[1]], p1.anchor, p2.anchor), 2);

    return (
        Math.abs(angle) % 90 == 0
        && Bez.isStraightLineSegment(p1, p2)
    );

};


/**
 * Example custom valueFunction.
 * See Ease.js for more examples.
 * @param {Number} t - number in range 0..1.
 * @returns {Number}
 */
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : - 1 + (4 - 2 * t) * t;
};





/**
 * Shows UI for the various divide functions.
 * @author m1b
 * @version 2023-04-07
 * @param {Object} settings - the settings associated with the UI.
 */
function showUI(settings) {

    if (settings == undefined)
        throw Error('showUI: bad `settings` parameter.');

    var suppressEvents = false;

    var UnitLabels = ['pt', 'mm', 'cm', 'in'];

    var UnitScales = {
        PT: 1,
        MM: 2.834645,
        CM: 28.34645,
        IN: 72,
    };

    // ensure unit is valid
    if (indexOf(settings.unit, UnitLabels) == -1)
        settings.unit = UnitLabels[0];

    settings.unitScale = UnitScales[settings.unit.toUpperCase()];

    // array of elements corresponding to AddPointsHow
    var data = [
        {
            label: 'Points Count',
            example: '3',
            message: 'Enter the number of points to add. Example: "3" will add 3 points.',
            hasUnits: false,
        },
        {
            label: 'Percentages',
            example: '40,50,60',
            message: 'Enter numbers, separated by comma. Example: "40,50,60" will add points at 40%, 50% and 60% of the length.',
            hasUnits: false,
        },
        {
            label: 'Approximate Distance',
            example: '10',
            message: 'Enter the approximate distance between points. Example: "10" will add points approximately 10 units apart.',
            hasUnits: true,
        },
        {
            label: 'Intervals',
            example: '10,5',
            message: 'Enter numbers, separated by comma. Example: "10,5" will add points at 10 units and 15 units.',
            hasUnits: true,
        },
        {
            label: 'Positions',
            example: '10,20',
            message: 'Enter numbers, separated by comma. Example: "10,20" will add points at 10 units and 20 units.',
            hasUnits: true,
        }
    ],

        whatLabels = [
            'Divide Entire Path',
            'Divide Every Segment',
        ],

        howLabels = [
            // will be populated from data
        ],

        unitLabels = [
            'pt',
            'mm',
            'cm',
            'in',
        ],

        columnWidth = 180,

        // flag to override value with example value
        canOverride,

        // set up the window
        w = new Window("dialog { text:'Add Points by m1b', properties:{ resizeable:true } }"),

        // user input view
        dropdowns = w.add("Group { orientation: 'row', alignment: ['fill','fill'] }"),
        whatMenu = dropdowns.add("Dropdownlist {alignment:['right','center'] }"),
        howMenu = dropdowns.add("Dropdownlist {alignment:['right','top'] }"),
        valueField = dropdowns.add("EditText { text:'', alignment:['fill','top'] }"),

        tipGroup = w.add("Group {orientation:'row', alignment:['fill','fill'], margins:[5,0,5,0] }"),
        helpMessage = tipGroup.add("Statictext { text:'', justify:'left', preferredSize:[-1,50], alignment:['fill','top'], properties:{ multiline: true } }"),

        bottomUI = w.add("group {orientation:'row', alignment:['fill','fill'], margins:[0,1,0,0] }"),
        aux = bottomUI.add("group {orientation:'row', alignment:['fill','bottom'], alignChildren:'left', margins:[5,0,5,0] }"),
        unitLabel = aux.add("Statictext { text:'Units:', justify:'left', alignment:['left','center'] }"),
        unitMenu = aux.add("Dropdownlist {alignment:['left','center'] }"),
        buttons = bottomUI.add("group {orientation:'row', alignment:['right','center'], alignChildren:'right' }"),
        cancelButton = buttons.add("Button { text: 'Cancel', properties: {name:'cancel'} }"),
        okayButton = buttons.add("Button { text:'Divide', enabled: true, properties: {name:'ok'} }");

    valueField.preferredSize.width = columnWidth;
    valueField.minimumSize.width = columnWidth;

    for (var i = 0; i < data.length; i++)
        howLabels[i] = data[i].label;

    buildMenu(whatMenu, whatLabels, settings.what);
    whatMenu.preferredSize.width = columnWidth;
    whatMenu.minimumSize.width = columnWidth;

    buildMenu(howMenu, howLabels, settings.how);
    howMenu.preferredSize.width = columnWidth;
    howMenu.minimumSize.width = columnWidth;

    buildMenu(unitMenu, unitLabels, indexOf(settings.unit, UnitLabels));
    unitMenu.preferredSize.width = 50;
    unitMenu.minimumSize.width = 50;

    // event handling
    whatMenu.onChange = updateUI;
    howMenu.onChange = updateUI;
    valueField.addEventListener('change', updateUI);
    unitMenu.onChange = updateUnit;
    okayButton.onClick = function () { w.close(1) };
    cancelButton.onClick = function () { w.close(2) };

    updateUI();

    // show dialog
    w.center();
    return w.show();

    /**
     * Builds dropdown menu items.
     */
    function buildMenu(menu, arr, index) {
        for (var i = 0; i < arr.length; i++)
            menu.add('item', arr[i]);
        menu.selection = [index || 0];
    };


    /**
     * Updates the UI when controls have changed.
     */
    function updateUI() {

        if (suppressEvents)
            return;

        suppressEvents = true;

        var selected = data[Number(howMenu.selection.index)];

        if (this == valueField && valueField.text != '')
            selected.value = valueField.text;
        else
            valueField.text = selected.value || selected.example;

        if (valueField.text == '')
            selected.value = selected.example;

        helpMessage.text = selected.message;

        // enabled
        unitMenu.enabled = selected.hasUnits;

        // update settings;
        settings.what = whatMenu.selection.index;
        settings.how = howMenu.selection.index;
        settings.value = valueField.text;

        if (!selected.hasUnits)
            settings.unitScale = undefined;

        suppressEvents = false;

    };

    /**
     * Updates the units settings from UI.
     */
    function updateUnit() {
        settings.unit = UnitLabels[Number(unitMenu.selection.index)];
        settings.unitScale = UnitScales[settings.unit.toUpperCase()];
    };

};