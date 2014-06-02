
import {Gradient} from '../st-api/Util/Gradient';
import {Raster} from './Util';
import {StripeScan} from './StripeScan';
import {ImageLoader} from './Util';



/* Computes a projector-camera correspondence and can paint it on a canvas */
export class Correspondence {
    constructor() {

        this.stripeScan = new StripeScan();
        this.imageLoader = new ImageLoader();
        /* All the data will be 128x128 in size. This is in tight inter-dependence
           with the fact that StripeScan will project 7 frames (meaning 128 stripes)
           on the last frame.

           TODO: The dependency between raster size and the number of frames
           projected by StripeScan needs to be made explicit. */
        this.dataSize = 128;
        this.flatData = new Raster(this.dataSize, this.dataSize, {x:0, y:0});
        this.moundData = new Raster(this.dataSize, this.dataSize, {x:0, y:0});
        this.diffData = new Raster(this.dataSize, this.dataSize, {x:0, y:0});
    }

    /* Perform a "before" scan */
    flatScan(screenCanvas, callback) {
        this.findMarkers();
        this.doScan(screenCanvas, this.flatData.data, callback);
    }

    /* Perform an "after" scan -- after say, the sand has changed, or a new
       object has been introduced into the projected frame. */
    moundScan(screenCanvas, callback) {
        this.doScan(screenCanvas, this.moundData.data, () => {
            /* Just paint and show the canvas for now.
               TODO: invoke callback instead. */
            this.doDiff();
            this.paintDiff(screenCanvas);

            var patchWidth = screenCanvas.width / 128;
            var patchHeight = screenCanvas.height / 128;

            // TODO: temporary poor-man "patch inspector"
            $(screenCanvas).on('click', (e) => {
                var x = Math.floor(e.clientX / patchWidth);
                var y = Math.floor(e.clientY / patchHeight);
                console.log('flat', this.flatData.data[x][y].x, this.flatData.data[x][y].y);
                console.log('mound', this.moundData.data[x][y].x, this.moundData.data[x][y].y);
                console.log('diff', this.diffData.data[x][y].x, this.diffData.data[x][y].y);
            });
            //callback();
        });
    }

    /* Compute the before/after differences. */
    doDiff() {
        for (var x = 0; x < this.dataSize; ++x) {
            for (var y = 0; y < this.dataSize; ++y) {
                var moundData = this.moundData.data[x][y],
                    flatData = this.flatData.data[x][y],
                    diffData = this.diffData.data[x][y];

                var diffX = moundData.x - flatData.x;
                var diffY = moundData.y - flatData.y;

                /* Simply chop off differences bigger than 120 pixels
                   on any axis. For our current experiments, these are extreme
                   enough differences, and indicate errors.
                   TODO: fixed heuristic; make it dynamic. */
                if (Math.abs(diffY) + Math.abs(diffX) > 80) {
                    diffX = 0;
                    diffY = 0;
                }

                diffData.x = diffX;
                diffData.y = diffY;
            }
        }

        /* Now that we chopped off the extreme differences (set the diffs to 0)
           we fill them back in using an average of the neighboring patches. */
        for (var x = 0; x < this.dataSize; ++x) {
            for (var y = 0; y < this.dataSize; ++y) {
                var diffData = this.diffData.data[x][y];

                if (diffData.x === 0 && diffData.y === 0) {
                    var n = this.diffData.neighbors(x,y);
                    var num = 0, xSum = 0, ySum = 0;

                    for (var i = 0; i < n.length; ++i) {
                        /* We only count neighbor patches that have non-zero diffs. */
                        if (n[i].x !== 0 && n[i].y !== 0) {
                            xSum += n[i].x;
                            ySum += n[i].y;
                            num++;
                        }
                    }

                    /* And we set the current patch to the avg of the neighbors
                       only when there are "enough" neighbors -- |n|/2 in this case. */
                    if (num > n.length/2) {
                        diffData.x = Math.floor(xSum / num);
                        diffData.y = Math.floor(ySum / num);
                    }
                }
            }
        }
    }


   


    /*Checks for fiducial codes */
    findMarkers() {
        console.log("Calling find markers");        
        var detector = new AR.Detector();
        console.log("Made a detector");
        
        this.grabCameraImage((img) => {
            return console.log("Image loaded");
        });

        /*
        this.grabCameraImage((img) => {
            
            /*
            console.log("Image loaded");

            document.createElement("canvas");
            var context = canvas.getContext('2d');
            context.drawImage(img, 100, 100);
            
            var imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            var markers = detector.detect(imageData);
            console.log("Number of markers: " + markers.length);
            for (var i = 0; i < markers.length; i++ ) {
                console.log("id: " + markers[i].id + ", coordinates: " + markers[i].coordinates);
            }
            
        });
*/
    
       
    }

    grabCameraImage(callback) {
        /* Add a random element to the url to prevent the browser from
           returning a cached image. */
        this.server = "http://192.168.1.147:8080/shot.jpg";
        var serverUrl = this.server  + '?x=' + Math.random();
        setTimeout(() => this.imageLoader.load(serverUrl, (img) => this.invoke(callback, img)), 200);
    }


    /* Paint the differences onto a canvas. */
    paintDiff(canvas) {
        var colors = Gradient.gradient('#3d5a99', '#b03333', 30);
        var ctx = canvas.getContext('2d');

        var patchWidth = canvas.width / this.dataSize;
        var patchHeight = canvas.height / this.dataSize;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        
        var sum = 0;
        for (var x = 0; x < this.dataSize; ++x) {
             for (var y = 0; y < this.dataSize; ++y) {
                var cell = this.diffData.data[x][y];
                var diff = Math.abs(cell.x)+Math.abs(cell.y);
                sum = sum + diff;
             }
        }
        var avgDiff = sum / Math.pow(this.dataSize, 2);
        console.log("average patch diff: " + avgDiff);

        for (var x = 0; x < this.dataSize; ++x) {
            for (var y = 0; y < this.dataSize; ++y) {
                var patch = this.diffData.data[x][y];

                /* For now we just add together the x- and y-differences */
                var idx = Math.abs(patch.x)+Math.abs(patch.y);

                if (idx >= colors.length)
                    idx = colors.length-1;

                ctx.fillStyle = colors[idx];
                ctx.fillRect(
                    x * patchWidth,
                    y * patchHeight,
                    x * patchWidth + patchWidth,
                    y * patchHeight + patchHeight
                );
                
                if (Math.abs(patch.x) + Math.abs(patch.y) > avgDiff) {
                   
                   //Fill patches that have a larger than average diff
                    ctx.fillStyle = 'white';
                    ctx.fillRect(
                    x * patchWidth,
                    y * patchHeight,
                    x * patchWidth + patchWidth,
                    y * patchHeight + patchHeight
                    );

                    //Draw a line between the current and previous location of pixels with a large enough diff 
                    ctx.beginPath();
                    ctx.moveTo((x + patch.x) * patchWidth, (y + patch.y) * patchHeight);
                    ctx.lineTo(x * patchWidth, y * patchHeight);
                    ctx.strokeStyle = "white";
                    ctx.closePath();
                    ctx.stroke();

                }
                
            }
        }
        
    }

    /* Invokes a scan. The stripe frames will be painted in screenCanvas,
       and 'raster' will be populated with {x,y} values, where x is the
       camera x for that raster cell, and y is its camera y. */
    doScan(screenCanvas, raster, callback) {
        this.stripeScan.scan(screenCanvas, (canvas) => {
            var ctx = canvas.getContext('2d'),
                pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            var sctx = screenCanvas.getContext('2d');
            sctx.drawImage(canvas, 0, 0);

            for (var i = 0; i < canvas.width; ++i) {
                for (var j = 0; j < canvas.height; ++j) {
                    var idx = (j * canvas.width + i) * 4;

                    /* If opacity is negative, ignore this pixel. */
                    if (pixels[idx+3]) {
                        /* projector x-value is in the red channel */
                        var x = pixels[idx];
                        /* projector y-value is in the blue channel */
                        var y = pixels[idx+2];
                        /* Store the camera pixel (x,y) in the raster cell. This
                           is super dumb right now. There will be many cam pixels
                           with the same projector (x,y). Currently, the last
                           pixel in the iteration wins.

                           TODO: We need to do something much smarter here. */
                        raster[x][y] = {x:i, y:j};
                    }
                }
            }

            if (typeof callback === 'function') {
                callback();
            }
        });
    }


    
}
