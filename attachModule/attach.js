/*

TEST INTERFACE : MODULE CUSTOMIZATION
Detecting existing modules, customizing modules

*/

// CANVAS
var debugcanvas = document.getElementById('canvas');
var paperW = debugcanvas.width;//window.innerWidth;
var paperH = debugcanvas.height;//window.innerHeight;
var paper = Raphael(0, 0, paperW, paperH);


var gd = 100; // grid size

var holder = paper.set(); // 1st set
var holdergrid = paper.set(); // 2nd set
var mothermodule = {};
var circles = [];
var gridface = false;
var module;
var shipsize = 50;

init();

function init(){
	
	module = paper.circle(200, 200, shipsize);
	module.attr("fill", "#BADA55")

	holder.push(module);

  mothermodule.parentW = module.getBBox(true).cx;
	mothermodule.parentH = module.getBBox(true).cy;
	mothermodule.parentX = module.getBBox(true).x;
	mothermodule.parentY = module.getBBox(true).y;
	mothermodule.boxW = mothermodule.parentX * 2;
	mothermodule.boxH = mothermodule.parentY * 2;

	module.dblclick(function(){
    draw_grid(module.getBBox(true).x, module.getBBox(true).y);
  });

  var start = function () {
    this.ox = this.attr("cx");
    this.oy = this.attr("cy");  
  },
  move = function (dx, dy) {
    this.attr({cx: this.ox + dx, cy: this.oy + dy});
  };
  paper.set(module).drag(move, start);

}

function draw_grid(modx, mody) { 

  // only run once ?
  if (gridface === false){

    var i = 0; 

    for (var y = 0; y < mothermodule.boxH; y += gd) { 
      for (var x = 0; x < mothermodule.boxW; x += gd) { 

        // push grid rects to circles array
        circles.push(
          paper.rect(x, y, gd, gd).attr({fill: '#333', opacity: 0.4}).click(function (event) {
            var newmod = this;
              newmod.attr({fill:'#666'});
              paper.circle((newmod.attrs.x + modPos().x) - shipsize, (newmod.attrs.y + modPos().y) - shipsize, shipsize).attr( {fill: "hsb(0, 1, 1)", stroke: "none", opacity: .5} );
              console.log("New module added at X", (newmod.attrs.x + modPos().x) - shipsize, " Y",(newmod.attrs.y + modPos().y) - shipsize );
          }));
        i++; 
      } 
    } 

    // push circles array to holdergrid set
    for (var j = 0; j < circles.length; j++){
      holdergrid.push( circles[j] );
    }

    // translate boundingbox - gridsize
    holdergrid.translate(modx-gd,mody-gd);

    // setup done
    gridface = true;

  }
  console.log('draw_grid(), gridface: ', gridface);
} 

function modPos(){
  // return current ship position
  var o = {
    x: Math.round(module.getBBox(true).x),
    y: Math.round(module.getBBox(true).y)
  }
  console.log(o)
  return o;
}