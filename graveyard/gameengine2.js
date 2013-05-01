// gloabal objects
// UI:
var pixels_in_a_meter = 30; // Scale. Box2D operates in meters: 1 meter = 30 pixels
var debugcanvas = document.getElementById('canvas');
var paperW = debugcanvas.width;//window.innerWidth;
var paperH = debugcanvas.height;//window.innerHeight;
var paper; // = Raphael(0, 0, paperW, paperH);
// Game loop:
var shooting = false;
var bulletSelfDestructTimeout;
var aimationObjects = [];
// Socket:
var username = "Anonymous user";
var playerAvatar;
var avatars = {}; // connected clients
var socket;

/* -- PHYSICS SIMULATION: -- */
// Shorthand references to Box2D namespaces:
var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2Fixture = Box2D.Dynamics.b2Fixture;
var b2World = Box2D.Dynamics.b2World;
var b2MassData = Box2D.Collision.Shapes.b2MassData;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
//
// Physics engine environment:
var gravity = new b2Vec2(0,0); // zero gravity on both vectors. It's space after all.
var b2world = new b2World(gravity, true);
//
// Collision detection handling:
var contactListener = new Box2D.Dynamics.b2ContactListener();
contactListener.BeginContact = function(contact) {
    var body1 = contact.m_fixtureA.m_body;
    var body2 = contact.m_fixtureB.m_body;

    var bullet;
    bullet = (body1.IsBullet()) ? body1 : bullet;
    bullet = (body2.IsBullet()) ? body2 : bullet;

    var ship;
    ship = (body1.userData.type === "ship") ? body1 : ship;
    ship = (body2.userData.type === "ship") ? body2 : ship;

    if(ship && bullet){
        // someone was hit!
        console.log(ship.userData.owner + " was hit by " + bullet.userData.owner);
        clearTimeout(bulletSelfDestructTimeout);
        shooting = false;
        //objsScheduledForRemoval.push(ship); // queue object for removal
        objsScheduledForRemoval.push(bullet); // queue object for removal
        if(bullet.userData.owner === playerAvatar.userData.owner){
            // this client shot somebody
            enemyDestroyed(ship);
        }
    }

    /*
     // example to narrow the field
     if( contact instanceof Box2D.Dynamics.Contacts.b2PolyAndCircleContact) {
     // collision of circle to polygon
     console.log("collision of circle to polygon");
     }
     */

};
b2world.SetContactListener(contactListener);
//
// Force manipulation handling:
function push(obj, power) {
    // calculating force vector:
    var angle = obj.GetAngle();
    var x = power * Math.cos(angle);
    var y = power * Math.sin(angle);

    obj.ApplyForce(new b2Vec2(x,y), obj.GetWorldCenter());  // Apply a force at a world point slowly over time, pushing = adds 'kinetic' energy.
    //ApplyImpulse - immediate, hit by a bat
}
function rotate(obj, r) {
    obj.ApplyTorque(r); // Apply a torque = adds angular 'kinetic' energy.
}
//
// Debug draw: Draws physical simulation. To be deleted.
var debugDraw = new b2DebugDraw();
debugDraw.SetSprite(debugcanvas.getContext("2d"));
debugDraw.SetDrawScale(pixels_in_a_meter);
debugDraw.SetFillAlpha(0.3);
debugDraw.SetLineThickness(1.0);
debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
b2world.SetDebugDraw(debugDraw);
//

/* -- GAME OBJECTS FACTORY: -- */
function createShip(pos, density, nickname){
    console.log();
    // 'Mass' = Shape size * density value
    var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
    bodyDef.type = b2Body.b2_dynamicBody; //define object type
    if(pos.x && pos.y && pos.r){
        bodyDef.position.Set(pos.x / pixels_in_a_meter, pos.y / pixels_in_a_meter); // Define position in meters.
        bodyDef.angle = pos.r * Math.PI / 180; // define rotation in radians.
    } else if(pos.b2Vec2 && pos.angle) {
        bodyDef.position.Set(pos.b2Vec2.x, pos.b2Vec2.y); // Define position in meters.
        bodyDef.angle = pos.angle; // define rotation in radians.
    }
    bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction or anti-force.
    //bodyDef.position.Set(10, 10); // define position

    var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
    fixDef.density = density; // The density. Usually kg/m^2.
    //fixDef.density = 10.0;
    fixDef.friction = 0; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
    fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
    fixDef.shape = new b2CircleShape(.6); // The 'hitarea' shape - circle or polygon. Defines the size (in meters).

    var ship = b2world.CreateBody(bodyDef);
    ship.CreateFixture(fixDef);
    ship.SetLinearDamping(.7); // Damping works like friction or anti-force: reduces linear velocity.
    /*
     var graphic = paper.path("M300,300m0,-10l5,15l-5,-3l-5,2l5,-15");
     graphic.attr({
     'fill': '#f00'
     });
     */
    var graphic = paper.image("ship01.png", ship.GetPosition().x * pixels_in_a_meter, ship.GetPosition().y * pixels_in_a_meter, 28, 42);
    graphic.transform("R" + ship.GetAngle() * 180 / Math.PI);
    //graphic.data('nickname', nickname); // user name of the owner of this object

    ship.userData = {'graphic': graphic, 'owner': nickname, 'type': 'ship'}; // bind ship graphic to physics body
    //aimationObjects.push(ship);
    return ship;
}
function shoot(shootingBody){
    var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
    bodyDef.type = b2Body.b2_dynamicBody; //define object type
    bodyDef.angle = shootingBody.GetAngle();
    // calculating velocity vector:
    var x = 10 * Math.cos(bodyDef.angle);
    var y = 10 * Math.sin(bodyDef.angle);
    bodyDef.linearVelocity = new b2Vec2(x,y);
    // calculating entry point of shot, just in front of ship:
    // positions the center of the object:
    bodyDef.position.x = shootingBody.GetPosition().x + (Math.cos(bodyDef.angle));
    bodyDef.position.y = shootingBody.GetPosition().y + (Math.sin(bodyDef.angle));
    //bodyDef.position.Set(x, y); // Define position.

    //bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction.
    bodyDef.bullet = true; // prevents tunneling, but increases processing time.

    var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
    fixDef.density = 50; // The density. Usually kg/m^2.
    fixDef.friction = 1; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
    fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
    fixDef.shape = new b2CircleShape(.1); // The 'hitarea' shape - circle or polygon. Takes size (in meters) as parameter.

    var shot = b2world.CreateBody(bodyDef);
    shot.CreateFixture(fixDef);
    //shot.SetLinearDamping(.7); // Damping works like friction: reduces linear velocity.

    var graphic = paper.circle(bodyDef.position.x * pixels_in_a_meter, bodyDef.position.y * pixels_in_a_meter, 3); // Creates circle at x, y, with radius;
    graphic.attr({
        'fill': '#f00'
    });
    //graphic.data('nickname', shootingBody.userData.data('nickname')); // user name of the owner of this object

    shot.userData =  {'graphic': graphic, 'owner': shootingBody.userData.owner, 'type': 'bullet'}; // bind shot graphic to physics body
    // Self destruct mechanism:
    //var functRef = callLater(shot);
    function functRef() {
        console.log("shot faded out");
        //console.log(shot);
        shooting = false;
        objsScheduledForRemoval.push(shot); // queue object for removal
    }
    bulletSelfDestructTimeout = setTimeout(functRef, 1000);

    shooting = true;
    return shot;
    //aimationObjects.push(shot);
}
    /* usage example:
        var lerdue = createShip({'x': 500, 'y':300}, 50, "skyd mig");
        var playerAvatar = createShip({'x': 50, 'y':300}, 50, "philFlame");
    */

/* -- GAME LOOP: -- */
// Multiple key press handling:
var keys = []; // store the currently pressed keys in an array
document.onkeydown = function (e) {
    e = e || window.event; //distinguish between IE’s explicit event object (window.event) and Firefox’s implicit.
    keys[e.keyCode] = true;
};
document.onkeyup = function (e) {
    e = e || window.event; //distinguish between IE’s explicit event object (window.event) and Firefox’s implicit.
    delete keys[e.keyCode];
};
//
// state update and user input handling:
function gameLoop() {
    // so far, this loop only handles simulation of local client
    b2world.Step(
        1 / 60   //frame-rate
        ,  8       //velocity iterations
        ,  3       //position iterations - The quality of the simulation
    );
    b2world.DrawDebugData();
    b2world.ClearForces();

    // Update UI:
    var updatedata = {}; // data container for server update
    for(var i = 0; i < aimationObjects.length; i++){
        var newX = aimationObjects[i].GetPosition().x * pixels_in_a_meter;
        var newY = aimationObjects[i].GetPosition().y * pixels_in_a_meter;
        var newR = aimationObjects[i].GetAngle() * 180 / Math.PI + 90;

        var graphic = aimationObjects[i].userData.graphic;
        graphic.transform("R" + newR);
        if(graphic.type === "circle"){
            // a shot
            graphic.attr({
                cx: newX,
                cy: newY
            });

            updatedata.shot = {
                'b2Vec2' : aimationObjects[i].GetPosition(),
                'angle' : aimationObjects[i].GetAngle()
            }
        } else if(graphic.type === "image") {
            // a ship
            graphic.attr({
                x: newX - graphic.attr('width')/2,
                y: newY - graphic.attr('height')/2
            });

            updatedata.ship = {
                'b2Vec2' : aimationObjects[i].GetPosition(),
                'angle' : aimationObjects[i].GetAngle()
            }
        }


        /*
        var updatedata = {
            ship : {
                'b2Vec2' : aimationObjects[i].GetPosition(),
                'angle' : aimationObjects[i].GetAngle()
            }
        };
        */
        /*
        updatedata.x = aimationObjects[i].GetPosition().x;// newX;
        updatedata.y = aimationObjects[i].GetPosition().y; //newY;
        updatedata.r = aimationObjects[i].GetAngle() * 180 / Math.PI + 90; //newR;
        */

        /*
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

        if(update){
        update = false;
        console.log("sending position");
        socket.emit('set position', updatedata); // send update
        }
        */
    }
    // notify server
    //console.log("updating server: socket.emit('set position')");
    //console.log(updatedata);
    socket.emit('set position', updatedata); // send update

    if(keys[66] === true){
        resetAvatar();
    }

    if(keys[65] === true){
        //push(happyBox, -99, 0);
        rotate(playerAvatar, -20);
    }

    if(keys[68] === true){
        //push(happyBox, 99, 0);
        rotate(playerAvatar, 20);
    }

    if(keys[83] === true){
        push(playerAvatar, -100);
    }

    if(keys[87] === true){
        push(playerAvatar, 100);
    }

    if(keys[32] === true){
        if(!shooting){
            var shot = shoot(playerAvatar);
            aimationObjects.push(shot);
            socket.emit('shoot'); // send update
        }
    }
}
//

/* -- OBJECT DELETION: -- */
window.setInterval(removeObjScheduledForRemoval, 1000 / 90); // Timer to schedule the deletion of the object.
var objsScheduledForRemoval = []; // Collect the objects to be deleted in a Array.
//
function removeObjScheduledForRemoval() {
    for(var i = 0; i < objsScheduledForRemoval.length; i++){
        objsScheduledForRemoval[i].userData.graphic.remove();
        b2world.DestroyBody(objsScheduledForRemoval[i]);
        objsScheduledForRemoval[i] = null;
    }
    objsScheduledForRemoval = []; // reset
}
//

/* -- UI: -- */
function initCanvas(){
    console.log('initCanvas()');

    document.body.appendChild(chatConsole);
    chatConsole.innerHTML =  'CONTROLS >>  W/S: increase/decrease thrust | A/D: rotate craft | B: reset ship';

    paper = Raphael(0, 0, paperW, paperH);

    // create player avatar:
    var initX = paperW / 2;
    var initY = paperH / 2;
    var initR = 90;
    playerAvatar = createShip({'x': initX, 'y':initY, 'r': initR}, 50, username);
    aimationObjects.push(playerAvatar);
    //aimationObjects.push(playerAvatar);
    var updatedata = {};
    updatedata.ship = {
        'b2Vec2' : playerAvatar.GetPosition(),
        'angle' : playerAvatar.GetAngle()
    };
    socket.emit('register avatar', updatedata); // creates
    //socket.emit('register avatar', {"x": initX, "y": initY, "r": initR }); // creates

    //requestID = window.requestAnimationFrame(slidetimer);
    window.setInterval(gameLoop, 1000 / 60); // starting game loop
    //window.setInterval(gameLoop, 100000); // starting game loop
}
function resetAvatar() {
    // reset
}
function enemyDestroyed(avatar){
    console.log('You destroyed ' + avatar.userData.owner);
    socket.emit('eliminate avatar', { 'name': avatar.userData.owner }); // notify server
    //delete avatars[avatar.data('nickname')]; // remove avatar from list
    //avatar.remove(); // remove avatar from screen
}

/* -- SOCKET: -- */
var chatConsole = document.createElement("div");
chatConsole.style.position = "absolute";
chatConsole.style.top = 0;
//
window.onload = function() {
    // set up log in
    var usernameInput = document.getElementById("usernameInput");
    var connectBtn = document.getElementById("connectBtn");
    connectBtn.onclick = function(){
        username = document.getElementById("usernameInput").value;
        initSocket();
    };
};
// Real-time client-server communication:
function initSocket(){
    //socket = io.connect('http://philippesimpson.helloworld.nodejitsu.com/');
    socket = io.connect('http://localhost:8080/');

    socket.on('news', function (data) {
        chatConsole.innerHTML = chatConsole.innerHTML + "<br />" + data;
        //socket.emit('my other event', { my: 'data' });
    });

    socket.on('connect', function(){
        // this client connected to socket
        connectBtn.style.display = "none";
        usernameInput.style.display = "none";
        socket.emit('set nickname', username);
        //document.body.appendChild(pingBtn);
        initCanvas(); // creates canvas & avatar
    });

    socket.on('player connected', function(data){
        console.log('player connected');
        console.log(data);
        // some other player connected.
        //console.log(data.nickname + " connected");
        avatars[data.nickname] = {}; // store reference to new player
        // create new avatar representing that other player and store a reference:
        //var x = data.ship.pos.x;
        //var y = data.ship.pos.y;
        //var r = data.ship.pos.r;
        avatars[data.nickname].avatar = createShip(data.ship, 50, data.nickname);
    });

    socket.on('player fired', function(data){
        // some other player fired a shot.
        console.log(data.nickname + " fired a shot");
        avatars[data.nickname].shot = shoot(avatars[data.nickname].avatar);
        avatars[data.nickname].shot.SetLinearVelocity({'x':0, 'y':0});
    });

    socket.on('player disconnected', function(data){
        // someone disconnected.
        if(username === data.nickname){
            // you died
            console.log("you died");
            objsScheduledForRemoval.push(playerAvatar.avatar); // queue object for removal
            //playerAvatar.remove();
            // to do : stop requestanimationframe
            //window.cancelAnimationFrame(requestID);
        } else {
            objsScheduledForRemoval.push(avatars[data.nickname].avatar); // queue object for removal
            //avatars[data.nickname].avatar.remove(); // remove avatar from screen
            //avatars[data.nickname].shot.remove(); // remove shot from screen

            //delete avatars[data.nickname]; // remove reference to avatar object
        }
    });

    socket.on('player update', function(data){
        //console.log("player update");
        //console.log(data);
        // some other player changed properties.
        //avatars[data.nickname].attr({'cx': data.x});
        if(data.ship){
            // update physics:
            avatars[data.nickname].avatar.SetPositionAndAngle(data.ship.b2Vec2, data.ship.angle);
            // update graphics:
            var graphic = avatars[data.nickname].avatar.userData.graphic;
            var newX = data.ship.b2Vec2.x * pixels_in_a_meter;
            var newY = data.ship.b2Vec2.y * pixels_in_a_meter;
            var newR = data.ship.angle * 180 / Math.PI + 90;
            graphic.attr({
                x: newX - graphic.attr('width')/2,
                y: newY - graphic.attr('height')/2
            });
            graphic.transform("R" + newR);
        }
        //avatars[data.nickname].avatar.userData.graphic.attr({'x': data.x, 'y': data.y});
        //avatars[data.nickname].avatar.userData.graphic.transform("R" + data.r);
        //avatars[data.nickname].avatar.attr({'x': data.x, 'y': data.y});
        //avatars[data.nickname].avatar.transform("R" + data.r);

        if(data.shot){
            avatars[data.nickname].shot.SetPositionAndAngle(data.shot.b2Vec2, data.shot.angle);
            graphic = avatars[data.nickname].shot.userData.graphic;
            newX = data.shot.b2Vec2.x * pixels_in_a_meter;
            newY = data.shot.b2Vec2.y * pixels_in_a_meter;
            newR = data.shot.angle * 180 / Math.PI + 90;
            graphic.attr({
                cx: newX,
                cy: newY
            });
            graphic.transform("R" + newR);
            //avatars[data.nickname].shot.userData.graphic.attr({'cx': data.shot.x, 'cy': data.shot.y });
        }
    });

    socket.on('update game state', function(data){
        for(var i = 0; i < data.items.length; i++){
            if(data.items[i].nickname !== username){
                var item = data.items[i];
                if(item.ship){
                    // update physics:
                    avatars[item.nickname].avatar.SetPositionAndAngle(item.ship.b2Vec2, item.ship.angle);
                    // update graphics:
                    var graphic = avatars[item.nickname].avatar.userData.graphic;
                    var newX = item.ship.b2Vec2.x * pixels_in_a_meter;
                    var newY = item.ship.b2Vec2.y * pixels_in_a_meter;
                    var newR = item.ship.angle * 180 / Math.PI + 90;
                    graphic.attr({
                        x: newX - graphic.attr('width')/2,
                        y: newY - graphic.attr('height')/2
                    });
                    graphic.transform("R" + newR);
                }
                if(item.shot){
                    avatars[item.nickname].shot.SetPositionAndAngle(item.shot.b2Vec2, item.shot.angle);
                    graphic = avatars[item.nickname].shot.userData.graphic;
                    newX = item.shot.b2Vec2.x * pixels_in_a_meter;
                    newY = item.shot.b2Vec2.y * pixels_in_a_meter;
                    newR = item.shot.angle * 180 / Math.PI + 90;
                    graphic.attr({
                        cx: newX,
                        cy: newY
                    });
                    graphic.transform("R" + newR);
                    //avatars[data.nickname].shot.userData.graphic.attr({'cx': data.shot.x, 'cy': data.shot.y });
                }
            }
        }
    });
    /*
     socket.on('you died', function(){
     circle.remove();
     });
     */
}
//