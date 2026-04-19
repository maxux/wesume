"use strict";

const boxes_map = {
    "points": new Float32Array(),
    "colors": new Float32Array(),
    "values": [],
    "boxes": 0,
    "lines": 0,
    "columns": 0,
    "gutter": 5,
    "size": 20,
};

function getRectangleBuffer(x, y, width, height) {
    const x1 = x;
    const x2 = x + width;
    const y1 = y;
    const y2 = y + height;

    return [
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ];
}

function getColorBuffer(red, green, blue, alpha) {
    return [
        red, green, blue, alpha,
        red, green, blue, alpha,
        red, green, blue, alpha,
        red, green, blue, alpha,
        red, green, blue, alpha,
        red, green, blue, alpha
    ];
}

// const alphamax = 0.98;
// const alphamin = 0.88;

function computeBoxes(gl, map) {
    map.lines = parseInt(gl.canvas.height / (map.size + map.gutter)) + 1;
    map.columns = parseInt(gl.canvas.width / (map.size + map.gutter)) + 1;
    map.boxes = (map.lines * map.columns);

    map.points = new Float32Array(map.boxes * 12); // 2 triangles x 3 points x 2 coord
    map.colors = new Float32Array(map.boxes * 24); // 2 triangles x 3 points x rgba
    map.values = [];

    var points_index = 0;
    var colors_index = 0;

    console.log("Computing:", map.lines, "lines", map.columns, "columns", map.boxes, "boxes");

    for(var line = 0; line < map.lines; line++) {
        for(var column = 0; column < map.columns; column++) {
            let points = getRectangleBuffer(
                (column * map.size) + ((column + 1) * map.gutter),
                (line * map.size) + ((line + 1) * map.gutter),
                map.size,
                map.size
            );

            map.points.set(points, points_index);
            points_index += points.length;

            let box = {
                "value": Math.random(),
                // "red": {"val": Math.random(), "min": 33 / 3 / 255, "max": 33 / 255, "dir": 1},
                // "green": {"val": Math.random(), "min": 37 / 3 / 255, "max": 37 / 255, "dir": 1},
                // "blue": {"val": Math.random(), "min": 41 / 3 / 255, "max": 41 / 255, "dir": 1},
                "red": {"val": 33 / 255, "min": 33 / 1.3 / 255, "max": 33 / 255, "dir": 1},
                "green": {"val": 37 / 255, "min": 37 / 1.3 / 255, "max": 37 / 255, "dir": 1},
                "blue": {"val": 41 / 255, "min": 41 / 1.3 / 255, "max": 41 / 255, "dir": 1},
                "alpha": 1.0,
                "ratio": Math.random() / 200,
            };

            map.values.push(box);

            let color = getColorBuffer(box.red.val, box.green.val, box.blue.val, box.alpha);
            map.colors.set(color, colors_index);
            colors_index += color.length;
        }
    }

    return map;
}

function colorizeBoxes(now, map) {
    for(var n = 0; n < map.boxes; n++) {
        const offset = n * 24;
        const box = map.values[n];

        [box.red, box.green, box.blue].forEach((color) => {
            color.val = (color.val * (1 + (color.dir * box.ratio)));

            if(color.dir > 0 && color.val > color.max) {
                color.val = color.max;
                color.dir = -1;
            }

            if(color.dir < 0 && color.val < color.min) {
                color.val = color.min;
                color.dir = 1;
            }
        });

        let newcolor = getColorBuffer(box.red.val, box.green.val, box.blue.val, box.alpha);
        map.colors.set(newcolor, offset);
    }
}

function computeRequired(gl, map) {
    const lines = parseInt(gl.canvas.height / (map.size + map.gutter)) + 1;
    const columns = parseInt(gl.canvas.width / (map.size + map.gutter)) + 1;

    return (lines != map.lines || columns != map.columns)
}

function main() {
    const canvas = document.querySelector("#glcanvas");
    // Initialize the GL context
    const gl = canvas.getContext("webgl");

    // Only continue if WebGL is available and working
    if(gl === null) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    // Use our boilerplate utils to compile the shaders and link into a program
    var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);

    // Binding shaders variables locations
    var positionLocation = gl.getAttribLocation(program, "a_position");
    var colorLocation = gl.getAttribLocation(program, "a_color");
    var resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // Create a buffer for positions and colors
    var positionBuffer = gl.createBuffer();
    var colorBuffer = gl.createBuffer();

    function drawBoxes(now, map) {
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, map.points, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, map.colors, gl.STATIC_DRAW);

        gl.drawArrays(gl.TRIANGLES, 0, (map.points.length / 2));
    }

    function frameRender(now) {
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);

        //
        // Check if computed data are still up-to-date
        //
        if(computeRequired(gl, boxes_map)) {
            computeBoxes(gl, boxes_map);
        }

        //
        // Link Locations
        //
        gl.enableVertexAttribArray(positionLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration (coord)
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer

        gl.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

        //
        // Link Colors
        //
        gl.enableVertexAttribArray(colorLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 4;          // 4 components per iteration (rgba)
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer

        gl.vertexAttribPointer(colorLocation, size, type, normalize, stride, offset);

        // Set the resolution
        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

        //
        // Update and Refresh Square Boxes
        //
        colorizeBoxes(now, boxes_map);
        drawBoxes(now, boxes_map);

        // Schedule next frame
        requestAnimationFrame(frameRender);
    }

    requestAnimationFrame(frameRender);
}

main();
