var paper; // SVG 'canvas'
var playerAvatar; // local player avatar
var missile; // local player missile

var username = "Anonymous user";
var avatars = {}; // connected clients
var socket;

var requestID;
var fps = 25;
var timeout;

var chatconsole = document.createElement("div");
chatconsole.style.position = "absolute";
chatconsole.style.top = 0;

var el = document.getElementById("usernameInput");
var connectBtn = document.getElementById("connectBtn");
connectBtn.onclick = function(){
    username = document.getElementById("usernameInput").value;
    initSocket();
};

function initSocket(){
    socket = io.connect('http://philippesimpson.helloworld.nodejitsu.com/');
    //socket = io.connect('http://localhost:8080/');

    socket.on('news', function (data) {
        chatconsole.innerHTML = chatconsole.innerHTML + "<br />" + data;
        //socket.emit('my other event', { my: 'data' });
    });

    socket.on('connect', function(){
        // this client connected to socket
        connectBtn.style.display = "none";
        el.style.display = "none";
        socket.emit('set nickname', username);
        //document.body.appendChild(pingBtn);

        initCanvas(); // creates canvas & avatar
    });

    socket.on('player connected', function(data){
        // some other player connected.
        console.log(data.nickname + " connected");
        // create avatar representing that other player:
        /*
         var new_avatar = paper.circle(data.x, data.y, 10); // Creates circle at x = 50, y = 40, with radius 10
         new_avatar.attr({
         "title": data.nickname,
         "fill": "#000",
         "stroke": "#eee"
         });
         */
        avatars[data.nickname] = {}; // store reference to new player

        var new_avatar = paper.image("ship01.png", data.x, data.y, 28, 42);
        new_avatar.transform("R" + data.r);
        new_avatar.data('nickname', data.nickname);
        avatars[data.nickname].avatar = new_avatar; // store reference to new avatar

        var new_shot = paper.circle(-100, -100, 5); // Creates circle at x = 50, y = 40, with radius 10;
        new_shot.attr({
            'fill': '#000'
        });
        avatars[data.nickname].shot = new_shot; // store reference to new avatar
    });

    socket.on('player disconnected', function(data){
        // someone disconnected.
        if(username === data.nickname){
            // you died
            console.log("you died");
            playerAvatar.remove();
            // to do : stop requestanimationframe
            //window.cancelAnimationFrame(requestID);
            clearTimeout(timeout);
        } else {
            avatars[data.nickname].avatar.remove(); // remove avatar from screen
            avatars[data.nickname].shot.remove(); // remove shot from screen
            delete avatars[data.nickname]; // remove reference to avatar object
        }
    });

    socket.on('player update', function(data){
        // some other player changed properties.
        //avatars[data.nickname].attr({'cx': data.x});
        avatars[data.nickname].avatar.attr({'x': data.x, 'y': data.y});
        avatars[data.nickname].avatar.transform("R" + data.r);

        if(data.shot){
            avatars[data.nickname].shot.attr({'cx': data.shot.x, 'cy': data.shot.y });
        }
    });
    /*
    socket.on('you died', function(){
        circle.remove();
    });
    */
}

function initCanvas(){
    document.body.appendChild(chatconsole);
    chatconsole.innerHTML =  'CONTROLS >>  W/S: increase/decrease thrust | A/D: rotate craft | B: reset ship';

    var paperW = 1000;//window.innerWidth;
    var paperH = 550;//window.innerHeight;

    /*
    var gamecanvas = document.createElement("div");
    document.body.appendChild(gamecanvas);
    gamecanvas.id = "gamecanvas";
    gamecanvas.style.width = paperW;
    gamecanvas.style.height = paperH;
*/

    paper = Raphael(0, 0, paperW, paperH);

    // create player avatar:
    var initX = ship_x = paperW / 2;
    var initY = ship_y = paperH / 2;
    var initR = ship_r = 90;
    playerAvatar = paper.image("ship01.png", initX, initY, 28, 42);
    playerAvatar.transform("R" + initR);
    /*
     circle = paper.circle(200, 200, 10); // Creates circle at x = 50, y = 40, with radius 10
     circle.attr({
     "title": "You",
     "fill": "#f00",
     "stroke": "#eee"
     });
     */
    //document.body.appendChild(resetBtn);
    socket.emit('register avatar', {"x": initX, "y": initY, "r": initR }); // creates

    //document.onkeydown = showKey; // start listening for keyboard events
    document.onkeydown = onKeyDown; // start listening for keyboard events
    slidetimer();
    //requestID = window.requestAnimationFrame(slidetimer);
}



var dir_x = 0,
dir_y = 0,
dir_r = 0,
ship_x = 0.0,
ship_y = 0.0,
ship_r = 0,
ship_speed = 0,
engine_power = 0,
ship_speed_x = 0.0,
ship_speed_y = 0.0,
mis_r = 0,
mis_y = 0,
mis_x = 0,
mis_speed = 0,
launch = -1;

var updatedata = {};
var update = false;

function onKeyDown(e) {
    e = e || window.event;
    //var key = String.fromCharCode(e.keyCode);
    var key = e.keyCode;

    switch(key) {
        case 66:
            resetAvatar();
            break;
        case 87:
            engine_power += 1;
            break;
        case 83:
            engine_power -= 2;
            break;
        case 65:
            // rotate left
            dir_r = -2;
            break;
        case 68:
            // rotate right
            dir_r = 2;
            break;
        case 32:
            if(launch === -1) {
                launch = 100;
                //$('.misile').css("display","block");
                //missile = paper.image("ship01.png", ship_x + 50, ship_y, 28, 42); // Creates circle at x = 50, y = 40, with radius 10;
                missile = paper.circle(ship_x, ship_y, 5); // Creates circle at x = 50, y = 40, with radius 10;
                missile.attr({
                    'fill': '#f00'
                });
                mis_r = ship_r;
                mis_y = ship_y;
                mis_x = ship_x;
                mis_speed = ship_speed;
            }
            break;
        default:
        //code to be executed
    }
}

function slidetimer() {
    engine_power = Math.max(engine_power,0);
    engine_power = Math.min(engine_power,5);
    ship_r += dir_r;

    ship_inertia_y = Math.cos((Math.PI/180)* ship_r) * -engine_power;
    ship_inertia_x = Math.sin((Math.PI/180)* ship_r) * engine_power;

    ship_speed_x = ship_speed_x - (ship_speed_x - ship_inertia_x) / 100;
    ship_speed_y = ship_speed_y - (ship_speed_y - ship_inertia_y) / 100;
    //ship_speed_y = ship_speed_y + (-(ship_speed_y - ship_inertia_y) / 100);
    //ship_speed_x = Math.round(ship_speed_x * 10) / 10;
    //ship_speed_y = Math.round(ship_speed_y * 10) / 10;
    //console.log("speed x: " + ship_speed_x + " y: " + ship_speed_y);
    //ship_x = ship_x + ship_speed_x;
    //ship_y = ship_y + ship_speed_y;

    var newship_x = ship_x + ship_speed_x;
    newship_x = Math.round(newship_x * 10) / 10;
    var newship_y = ship_y + ship_speed_y;
    newship_y = Math.round(newship_y * 10) / 10;
    //console.log("ship x: " + newship_x + " y: " + newship_y);

    //console.log("Enginepower: "+(20*engine_power)+"%");
    //$('p.engine').text("Enginepower: "+(20*engine_power)+"%");
    //$('p.data1').text("x:"+ship_speed_x);
    //$('p.data2').text("y:"+ship_speed_y);

    //$('div#redbox').css("-moz-transform","rotate("+ship_int_r+"deg)");
    //$('div#redbox').css("top",ship_y+"px");
    //$('div#redbox').css("left",ship_x+"px");
    //console.log("ship_speed_x: " + ship_speed_x + " | ship_speed_y: " + ship_speed_y);

    playerAvatar.attr({x: newship_x});
    playerAvatar.attr({y: newship_y});
    playerAvatar.transform("R" + ship_r);

    if(launch > 0) {
        launch--;
        mis_speed += .1;
        mis_speed = Math.max(mis_speed,5);
        mis_y -= (Math.cos((Math.PI/180)*mis_r))*mis_speed;
        mis_x += (Math.sin((Math.PI/180)*mis_r))*mis_speed;

        missile.attr({'cx': mis_x});
        missile.attr({'cy': mis_y});
        //missile.transform("R" + ship_int_r);
        //$('div.misile').css("-moz-transform","rotate("+mis_r+"deg)");
        //$('div.misile').css("top",mis_y+"px");
        //$('div.misile').css("left",mis_x+"px");

        // check for collision:
        var c_el = paper.getElementByPoint(mis_x, mis_y); // Returns topmost element under given point.
        // check to make sure that the colliding element is not the player.

        if(c_el){
            if(c_el.data('nickname') !== undefined){
                enemyDestroyed(c_el);
                missile.remove();
                launch = -1;
            }
        }
    } else if(launch === 0) {
        // missile out of fuel
        missile.remove();
        launch = -1;
    }

    var xChanged = (newship_x !== ship_x) ? true : false;
    var yChanged = (newship_y !== ship_y) ? true : false;
    var rChanged = (dir_r !== 0) ? true : false;
    if(xChanged || yChanged || rChanged ){
        // either rotation, x,y changed
        //socket.emit('set position', { 'x': newship_x, 'y': newship_y, 'r': ship_r, 'shot': shot}); // send update
        ship_x = newship_x;
        ship_y = newship_y;

        updatedata.x = newship_x;
        updatedata.y = newship_y;
        updatedata.r = ship_r;

        update = true;
    }

    if(launch !== -1){
        // a shot is in progress
        var shot = {};
        shot.x = mis_x;
        shot.y = mis_y;

        updatedata.shot = shot;

        update = true;
    }

    if(update){
        update = false;
        console.log("sending position");
        socket.emit('set position', updatedata); // send update
    }

    dir_r = 0; // reset

    timeout = setTimeout(function() {
        //window.requestAnimationFrame(slidetimer);
        slidetimer();
    }, 1000 / fps);

    //window.requestAnimationFrame(slidetimer);
}

function resetAvatar() {
    dir_x = 0;
    dir_y = 0;
    dir_r = 0;
    ship_x = 300;
    ship_y = 300;
    ship_r = 90;
    ship_speed = 0;
    engine_power = 0;
    ship_speed_x = .0;
    ship_speed_y = .0;
}

function enemyDestroyed(avatar){
    console.log('You destroyed ' + avatar.data('nickname'));
    socket.emit('eliminate avatar', { 'name': avatar.data('nickname')}); // notify server
    //delete avatars[avatar.data('nickname')]; // remove avatar from list
    //avatar.remove(); // remove avatar from screen
}
