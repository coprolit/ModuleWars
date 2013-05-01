// gloabal objects
// UI:
var pixels_in_a_meter = 30; // Scale. Box2D operates in meters: 1 meter = 30 pixels
var debugcanvas = document.getElementById('canvas');
var paperW = debugcanvas.width;//window.innerWidth;
var paperH = debugcanvas.height;//window.innerHeight;
var paper; // = Raphael(0, 0, paperW, paperH);
// Game loop:
var gameLoopInterval;
var shooting = false;
var bulletSelfDestructTimeout;
var aimationObjects = [];
var fps = 60; // update broadcasts per second
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

        //clearTimeout(bulletSelfDestructTimeout);
        //shooting = false;
        //objsScheduledForRemoval.push(bullet); // queue object for removal

        if(bullet.userData.owner === username){
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
function createShip(pos, density, username){
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

    ship.userData = {'graphic': graphic, 'owner': username, 'type': 'ship'}; // bind ship graphic to physics body
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
    updatedata.username = username;
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
    if(aimationObjects.length > 0){
        //console.log('emitting position');
        //console.log("emitting: " + updatedata.ship.b2Vec2.x + "," + updatedata.ship.b2Vec2.y);
        socket.emit('set position', updatedata); // send update
    }

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
function requestGameState(){
    socket.emit('get game state'); // request state of game
}

/* -- OBJECT DELETION: -- */
window.setInterval(removeObjScheduledForRemoval, 1000 / 10); // Timer to schedule the deletion of the object.
var objsScheduledForRemoval = []; // Collect the objects to be deleted in a Array.
//
function removeObjScheduledForRemoval() {
    for(var i = 0; i < objsScheduledForRemoval.length; i++){
        console.log("removing " +objsScheduledForRemoval[i].userData.type + " of " + objsScheduledForRemoval[i].userData.owner);
        objsScheduledForRemoval[i].userData.graphic.remove();
        b2world.DestroyBody(objsScheduledForRemoval[i]);
        objsScheduledForRemoval[i] = null;

        if(objsScheduledForRemoval[i].userData.owner === username){
            // local player. Stop emitting position.
            clearInterval(gameLoopInterval);
        }
    }
    objsScheduledForRemoval = []; // reset
}
//

/* -- UI: -- */
function initCanvas(){
    document.body.appendChild(chatConsole);
    chatConsole.innerHTML =  'CONTROLS >>  W/S: increase/decrease thrust | A/D: rotate craft | B: reset ship';

    paper = Raphael(0, 0, paperW, paperH);
    console.log("canvas ready for game state updates");

    socket.emit('canvas ready');
    //window.setInterval(gameLoop, 1000 / 60); // starting game loop
    setInterval(requestGameState, 1000 / fps);
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
chatConsole.style.top = "25px";
//
window.onload = function() {
    // set up log in
    var usernameInput = document.getElementById("usernameInput");
    var connectBtn = document.getElementById("connectBtn");
    connectBtn.onclick = function(){
        username = document.getElementById("usernameInput").value;
        connectBtn.style.display = "none";
        usernameInput.style.display = "none";
        //socket.emit('set nickname', username);

        // create player avatar:
        var initX = Math.round(Math.random() * paperW);
        var initY = Math.round(Math.random() * paperH);
        var initR = Math.round(Math.random() * 360);
        //console.log("pos: " + initX + " " + initY + " " + initR);
        playerAvatar = createShip({'x': initX, 'y':initY, 'r': initR}, 50, username);
        aimationObjects.push(playerAvatar);
        //aimationObjects.push(playerAvatar);
        var data = {};
        data.ship = {
            'b2Vec2' : playerAvatar.GetPosition(),
            'angle' : playerAvatar.GetAngle()
        };
        data.username = username;

        socket.emit('launch ship', data);

        //gameLoopInterval = window.setInterval(gameLoop, 1000 / 60); // starting game loop
        gameLoopInterval = window.setInterval(gameLoop, 1000 / fps); // starting game loop
    };

    initSocket();
};
// Real-time client-server communication:
function initSocket(){
    socket = io.connect('http://philippesimpson.helloworld.nodejitsu.com/');
    //socket = io.connect('http://localhost:8080/');

    socket.on('news', function(data){
        chatConsole.innerHTML = chatConsole.innerHTML + "<br />" + data;
        //socket.emit('my other event', { my: 'data' });
    });

    socket.on('connect', function(){
        // this client connected to socket
        //document.body.appendChild(pingBtn);
        initCanvas(); // creates canvas & avatar
    });

    socket.on('ship launched', function(data){
        //console.log("ship launched: " + data.username);
        // some other client launched a ship
        avatars[data.username] = {}; // store reference to new player
        avatars[data.username].avatar = createShip(data.ship, 50, data.username);
    });

    socket.on('ship destroyed', function(data){
        console.log("socket.on(ship destroyed): " + data.username);
        // someone died.
        if(username === data.username){
            // you died
            console.log("you died");
            objsScheduledForRemoval.push(playerAvatar); // queue object for removal
            //playerAvatar.remove();
            // to do : stop requestanimationframe
            //window.cancelAnimationFrame(requestID);

        } else {
            objsScheduledForRemoval.push(avatars[data.username].avatar); // queue object for removal
            //avatars[data.username].avatar.remove(); // remove avatar from screen
            //avatars[data.nickname].shot.remove(); // remove shot from screen

            delete avatars[data.username]; // remove reference to avatar object
        }
    });

    socket.on('new game state', function(data){
        //console.log("socket.on(new game state)");
        //console.log(data);
        for(var i = 0; i < data.items.length; i++){
            var item = data.items[i];
            //console.log(item.username);
            // skip if current item is local client
            if(item.username !== username){
                // skip if current item doesn't exist on client:
                    if(item.ship && avatars[item.username].avatar){
                        // update physics:
                        avatars[item.username].avatar.SetPositionAndAngle(item.ship.b2Vec2, item.ship.angle);
                        // update graphics:
                        var graphic = avatars[item.username].avatar.userData.graphic;
                        var newX = item.ship.b2Vec2.x * pixels_in_a_meter;
                        var newY = item.ship.b2Vec2.y * pixels_in_a_meter;
                        var newR = item.ship.angle * 180 / Math.PI + 90;
                        graphic.attr({
                            x: newX - graphic.attr('width')/2,
                            y: newY - graphic.attr('height')/2
                        });
                        graphic.transform("R" + newR);
                    }
                    if(item.shot && avatars[item.username].shot){
                        // update physics:
                        avatars[item.username].shot.SetPositionAndAngle(item.shot.b2Vec2, item.shot.angle);
                        // update graphics:
                        graphic = avatars[item.username].shot.userData.graphic;
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

            } else {
                //console.log("receiving: " + item.ship.b2Vec2.x + "," + item.ship.b2Vec2.y);
            }
        }
    });

    socket.on('player fired', function(data){
        // some other player fired a shot.
        console.log(data.username + " fired a shot");
        avatars[data.username].shot = shoot(avatars[data.username].avatar);
        avatars[data.username].shot.SetLinearVelocity({'x':0, 'y':0});
    });
}
//