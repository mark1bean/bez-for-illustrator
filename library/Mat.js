var Mat = {};


/**
 * Returns a 3x3 identity matrix.
 * @returns {Array<Array<Number>>}
 */
Mat.getIdentityMatrix = function getIdentityMatrix() {

    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];

};


/**
 * Returns a translation matrix.
 * @param {Array<Number>} v - the translation vector [tx, ty].
 * @returns {Array<Number>} - 3x3 matrix.
 */
Mat.getTranslationMatrix = function getTranslationMatrix(v) {

    return [
        [1, 0, v[0]],
        [0, 1, v[1]],
        [0, 0, 1],
    ];

};


/**
 * Returns a matrix to scale by `sx` x `sy`.
 * @param {Number} sx - the horizontal scale factor [0..1].
 * @param {Number} sy - the vertical scale factor [0..1].
 * @returns {Array<Number>} - 3x3 matrix.
 */
Mat.getScaleMatrix = function getScaleMatrix(sx, sy) {

    return [
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, 1],
    ];

};


/**
 * Returns a matrix with `angle` rotation.
 * @param {Number} angle - the rotation amount.
 * @param {Boolean} angleIsDegrees - whether the angle unit is degrees (default: radians).
 * @returns {Array<Number>} - 3x3 matrix.
 */
Mat.getRotationMatrix = function getRotationMatrix(angle, angleIsDegrees) {

    if (angleIsDegrees)
        angle *= (Math.PI / 180);

    return [
        [Math.cos(angle), -Math.sin(angle), 0],
        [Math.sin(angle), Math.cos(angle), 0],
        [0, 0, 1],
    ];

};


/**
 * Returns the rotation angle from an unskewed matrix.
 * @param {3x3 matrix|Matrix} matrix - a 3x3 matrix array or Illustrator Matrix.
 * @param {Boolean} inDegrees - whether to return the rotation angle in degrees (default: radians).
 * @returns {Number}
 */
Mat.getRotationFromUnskewedMatrix = function getRotationFromUnskewedMatrix(matrix, inDegrees) {

    var angleRadians;

    if ('Matrix' === matrix.constructor.name)
        angleRadians = Math.atan2(-matrix.mValueB, matrix.mValueA);
    else
        angleRadians = Math.atan2(matrix[0][1], matrix[0][0]);

    return true === inDegrees
        ? asDegrees(angleRadians)
        : angleRadians;

};


/**
 * Multiply two 3x3 matrices.
 * @param {Array<Number>} m1 - a 2D matrix [[a,b,tx], [d,e,ty], [0,0,1]].
 * @param {Array<Number>} m2 - a 2D matrix [[a,b,tx], [d,e,ty], [0,0,1]].
 * @returns {Array<Number>}
 */
Mat.multiplyMatrices = function multiplyMatrices(m1, m2) {

    var rowCount1 = m1.length,
        rowCount2 = m2.length,
        columnCount1 = m1[0].length,
        columnCount2 = m2[0].length,
        m = new Array(rowCount1);

    if (
        rowCount1 !== 3
        || columnCount1 !== 3
    )
        throw Error('Pol.multiplyMatrices: bad `m1` supplied.');

    if (
        rowCount2 !== 3
        || columnCount2 !== 3
    )
        throw Error('Pol.multiplyMatrices: bad `m2` supplied.');

    for (var r = 0; r < rowCount1; ++r) {

        // initialize the current row
        m[r] = new Array(columnCount2);
        for (var c = 0; c < columnCount2; ++c) {

            // initialize the current cell
            m[r][c] = 0;
            for (var i = 0; i < columnCount1; ++i)
                m[r][c] += m1[r][i] * m2[i][c];

        }

    }

    return m;

};


/**
 * Returns an Illustrator Matrix object
 * given a 3x3 array matrix.
 * Illustrator rotation goes opposite
 * to the raw matrices, so we flip the
 * signs of both B and C to match.
 * @param {Array<Array<Number>>} matrix - the matrix to convert.
 * @returns {Matrix}
 */
Mat.getIllustratorMatrix = function getIllustratorMatrix(matrix) {

    var m = app.getIdentityMatrix();
    m.mValueA = matrix[0][0];
    m.mValueB = -matrix[0][1];
    m.mValueC = -matrix[1][0];
    m.mValueD = matrix[1][1];
    m.mValueTX = matrix[0][2];
    m.mValueTY = matrix[1][2];

    return m;

};


/**
 * Returns an 3x3 array matrix, given
 * an Illustrator Matrix object.
 * Illustrator rotation goes opposite
 * to the raw matrices, so we flip the
 * signs of both B and C to match.
 * @param {Matrix} illustratorMatrix - the Illustrator Matrix to convert.
 * @returns {Array<Array<<Number>>} - 3x3 matrix.
 */
Mat.matrixFromIllustratorMatrix = function matrixFromIllustratorMatrix(illustratorMatrix) {

    var matrix = Mat.getIdentityMatrix();
    matrix[0][0] = illustratorMatrix.mValueA;
    matrix[0][1] = -illustratorMatrix.mValueB;
    matrix[1][0] = -illustratorMatrix.mValueC;
    matrix[1][1] = illustratorMatrix.mValueD;
    matrix[0][2] = illustratorMatrix.mValueTX;
    matrix[1][2] = illustratorMatrix.mValueTY;

    return matrix;

};


/**
 * Transformation a point with a matrix.
 * @param {Array<Number>} point - a point [x, y].
 * @param {Array<Array<Number>>} matrix - a 3x3 matrix.
 * @returns {Array<Number>} - [tx, ty].
 */
Mat.transformPoint = function transformPoint(point, matrix) {

    // add 1 to the point for homogeneity with the matrix
    var p = Mat.multiplyMatrixVector(matrix, [point[0], point[1], 1]);

    return [p[0], p[1]];

};


/**
 * Transforms a path/points array using a 3x3 matrix.
 * @param {Object} options
 * @param {Array<Array<point>>} options.paths - a path/point array.
 * @param {Array<Array<Number>>} options.matrix - a 3x3 matrix.
 * @param {Array<Number>} [options.netTranslationVector] - described a pre-transform and post-transform translation, which serves to specify the `fulcrum` of the transform.
 * @returns {Array<Array<point>>}
 */
Mat.transformPaths = function transformPaths(options) {

    options = options || {};

    var paths = options.paths.slice(),
        mainTransform = options.matrix,
        netTranslation = options.netTranslationVector;

    pathsLoop:
    for (var i = 0, l = paths.length; i < l; i++) {

        var points = paths[i].slice();

        pointsLoop:
        for (var j = 0, p, len = points.length; j < len; j++) {

            p = points[j].slice();

            // position relative to origin
            if (netTranslation) {
                p[0] -= netTranslation[0];
                p[1] -= netTranslation[1];
            }

            // transform around origin
            p = Mat.transformPoint(p, mainTransform);

            // re-position
            if (netTranslation) {
                p[0] += netTranslation[0];
                p[1] += netTranslation[1];
            }

            paths[i][j] = p;

        }

    }

    return paths;

};


/**
 * Multiplies a matrix by a vector,
 * returning the resulting vector.
 * Note: will throw error if the vector
 * length is less than the number of
 * columns in the matrix.
 * @param {Array<Array<Number>>} matrix - the matrix to multiply.
 * @param {Array<Number>} vector - the vector to multiple.
 * @returns {Array<Number>}
 */
Mat.multiplyMatrixVector = function multiplyMatrixVector(matrix, vector) {

    var result = [];
    for (var i = 0; i < matrix.length; i++) {

        result[i] = 0;
        for (var j = 0; j < vector.length; j++)
            result[i] += matrix[i][j] * vector[j];

    }

    return result;

};



/**
 * Returns an inverted matrix for a given matrix,
 * or null if the determinant is zero.
 * @param {Array<Array<Number>>} matrix - the matrix to invert.
 * @returns {Array<Array<Number>>}
 */
Mat.invertMatrix3x3 = function invertMatrix3x3(matrix) {

    var m = matrix,
        determinant =
            m[0][0] * (m[1][1] * m[2][2] - m[2][1] * m[1][2])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if (determinant === 0)
        // not invertible!
        return null;

    var inverse = [
        [(m[1][1] * m[2][2] - m[2][1] * m[1][2]) / determinant, -(m[0][1] * m[2][2] - m[0][2] * m[2][1]) / determinant, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / determinant],
        [-(m[1][0] * m[2][2] - m[1][2] * m[2][0]) / determinant, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / determinant, -(m[0][0] * m[1][2] - m[0][2] * m[1][0]) / determinant],
        [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / determinant, -(m[0][0] * m[2][1] - m[0][1] * m[2][0]) / determinant, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / determinant]
    ];

    return [inverse[0], inverse[1]];

};


function asRadians(degrees) { return degrees * (Math.PI / 180) };
function asDegrees(radians) { return (radians * 180) / Math.PI };


/**
 * Rotate the item so it's "rotation is zero".
 * Designed to return a TextFrame or PlacedItem
 * to "unrotated" orientation.
 * NOTE: this does not read the BCCAccumRotation tag.
 * @param {TextFrame|PlacedItem|RasterItem} item - any Illustrator page item with a matrix property.
 */
Mat.unRotateUnskewedPageItem = function unRotatePageItem(item) {

    if (
        !item.hasOwnProperty('matrix')
        || 'Matrix' !== item.matrix.constructor.name
    )
        return;

    var rotationDegrees = Mat.getRotationFromUnskewedMatrix(item.matrix, true);

    item.rotate(rotationDegrees);

};




/**
 * Returns [tx, ty], given a move of `distance` on `angle`.
 * @param {Number} angle - the angle of the move.
 * @param {Number} distance - the distance of the move.
 * @returns {Array<Number>} - [tx, ty].
 */
Mat.getTranslationVector = function getTranslationVector(angle, distance) {

    // normalize the angle to the range [-180, 180)
    angle = angle % 360;
    if (angle >= 180)
        angle -= 360;

    const radians = angle * Math.PI / 180;
    const tx = distance * Math.cos(radians);
    const ty = distance * Math.sin(radians);

    return [tx, -ty];

};