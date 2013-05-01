/* -- GLOBAL PROPERTIES: -- */
    // for testing
    pingEl = document.getElementById("ping");
    cycleEl = document.getElementById("cyclespeed");
    // UI:
    var scale = 30; // Scale. Box2D operates in meters: 1 meter = 30 pixels
    var debugcanvas = document.getElementById('canvas');
    var paperW = debugcanvas.width;//window.innerWidth;
    var paperH = debugcanvas.height;//window.innerHeight;
    var paper; // = Raphael(0, 0, paperW, paperH);
    // Game loop:
    var shooting = false;
    var bulletSelfDestructTimeout;
    var gameObjectsModel = {}; // objects for drawing
    var fps = 60; // frames per second
    // Socket:
    var username = "Anonymous user";
    var playerAvatar;
    var socket;
    var chatConsole = document.createElement("div");
    chatConsole.style.position = "absolute";
    chatConsole.style.top = "25px";

/* -- UI: -- */
    function postInChat(message){
        chatConsole.innerHTML = chatConsole.innerHTML + "<br />" + message;
    }

    function initCanvas(){
        document.body.appendChild(chatConsole);
        chatConsole.innerHTML =  'CONTROLS >>  W/S: thrust on/off | A/D: rotate craft | SPACE: shoot';
        // whatever
        paper = Raphael(0, 0, paperW, paperH);
        //console.log("canvas ready for game state updates");

        //window.setInterval(gameLoop, 1000 / fps); // starting game loop
        setTimeout(gameLoop, 1000/fps);

        socket.emit('canvas ready');
        //setInterval(requestGameState, 1000 / fps);
    }

    window.onload = function() {
        // set up log in
        var usernameInput = document.getElementById("usernameInput");
        var connectBtn = document.getElementById("connectBtn");
        connectBtn.onclick = function(){
            username = document.getElementById("usernameInput").value;
            connectBtn.style.display = "none";
            usernameInput.style.display = "none";

            socket.emit('ship launch', username);
        };

        initSocket();
    };

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

    // Debug draw: Draws physical simulation. To be deleted.
    var debugDraw = new b2DebugDraw();
    debugDraw.SetSprite(debugcanvas.getContext("2d"));
    debugDraw.SetDrawScale(scale);
    debugDraw.SetFillAlpha(0.3);
    debugDraw.SetLineThickness(1.0);
    debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
    b2world.SetDebugDraw(debugDraw);
    //

/* -- SOCKET: -- */
    // Real-time client-server communication:
    function initSocket(){
        //socket = io.connect('http://spaceacearena.eu01.aws.af.cm/');
        //socket = io.connect('http://philippesimpson.helloworld.nodejitsu.com/');
        socket = io.connect('');

        socket.on('news', function(data){
            chatConsole.innerHTML = chatConsole.innerHTML + "<br />" + data;
        });

        socket.on('connect', function(){
            // this client connected to socket
            initCanvas(); // creates canvas & avatar
        });

        socket.on('ship launched', function(data){
            //console.log("ship launched: " + data.username);
            if(data.username === username){
                // you successfully launched a ship
                // create player avatar:
                playerAvatar = createShip({'b2Vec2': data.b2Vec2, 'angle': data.angle}, data.density, data.username);
                gameObjectsModel[data.username] = {};
                gameObjectsModel[data.username] = playerAvatar;
                postInChat('<strong>' + data.username + '</strong>, you are spaceborne.');
            } else {
                // some other client launched a ship
                var newShip = createShip({'b2Vec2': data.b2Vec2, 'angle': data.angle}, data.density, data.username);
                gameObjectsModel[data.username] = {};
                gameObjectsModel[data.username] = newShip;
                postInChat('<strong>' + data.username + '</strong> entered space.');
            }
        });

        //socket.on('game state update', function(data){
        var prev = new Date().getTime();
        socket.on('message', function(data){
            var now = new Date().getTime();
            pingEl.innerHTML = "Frekvens: " + (now - prev) + "ms";
            prev = now;
            if(paper){
                // let's synchronize with server:
                window.requestAnimationFrame(function(){
                    var items = data.split(",");
                    for(var i = 0; i < items.length; i++){
                        var item = items[i].split("&");
                        var username = item[0];
                        if(gameObjectsModel[username]){
                            // update physics:
                            var posX = parseFloat(item[1]);
                            var posY = parseFloat(item[2]);
                            var angle = parseFloat(item[3]);
                            var velX = parseFloat(item[4]);
                            var velY = parseFloat(item[5]);
                            //gameObjectsModel[username].SetPosition(new b2Vec2(posX, posY));
                            //gameObjectsModel[username].SetAngle(angle);
                            //gameObjectsModel[username].SetLinearVelocity(new b2Vec2(velX, velY));
                            // update graphics:
                            var graphic = gameObjectsModel[username].GetUserData().graphic;
                            //var graphic = gameObjectsModel[username].ship.userData.graphic;
                            var newX = posX * scale;
                            var newY = posY * scale;
                            var newR = angle * 180 / Math.PI + 90;
                            if(gameObjectsModel[username].GetUserData().type === 'ship'){
                                graphic.attr({
                                    x: newX - graphic.attr('width')/2,
                                    y: newY - graphic.attr('height')/2
                                });
                            }
                            if(gameObjectsModel[username].GetUserData().type === 'bullet'){
                                graphic.attr({
                                    cx: newX,
                                    cy: newY
                                });
                            }
                            graphic.transform("R" + newR);
                        }
                    }
                });
            }
        });

        socket.on('ship destroyed', function(name){
            // someone died.
            if(username === name){
                // you died
                console.log("you died");
            }
            gameObjectsModel[name].GetUserData().graphic.remove(); // remove graphic
            b2world.DestroyBody(gameObjectsModel[name]); // remove physics object
            delete gameObjectsModel[name]; // remove reference
            postInChat('<strong>' + name + '</strong> is no more.');
        });

        socket.on('hit', function(txt){
            postInChat(txt);
        });

        socket.on('shot fired', function(data){
            /*if(name !== username){
                // some other player fired a shot.
            }*/
            var newShot = createBullet(data);
            gameObjectsModel[data.username] = {};
            gameObjectsModel[data.username] = newShot;
        });
        /*
        socket.on('updatecycle', function(time){
            cycleEl.innerHTML = "cyclespeed: " + time + "ms";
        })
        socket.on('pingback', function(time){
            //console.log(time);
            var now = new Date().getTime();
            pingEl.innerHTML = "ping: " + (now - time) + "ms";
            //console.log("ping: " + (now - time) + "ms");
        });

        function ping(){
            var timestamp = new Date().getTime();
            socket.emit('ping', timestamp);
        }
        setInterval(ping, 5000);
        */
    }
    //

/* -- GAME OBJECTS FACTORY: -- */
    function createShip(pos, density, username){
        //console.log('creating ship for ' + username);
        var graphic = paper.image("ship01.png", pos.b2Vec2.x * scale - 14, pos.b2Vec2.y * scale - 21, 28, 42);
        graphic.transform("R" + pos.angle * 180 / Math.PI);

        // 'Mass' = Shape size * density value
        var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
        bodyDef.type = b2Body.b2_dynamicBody; //define object type
        /*if(pos.x && pos.y && pos.r){
            bodyDef.position.Set(pos.x / scale, pos.y / scale); // Define position in meters.
            bodyDef.angle = pos.r * Math.PI / 180; // define rotation in radians.
        } else*/ if(pos.b2Vec2 && pos.angle) {
            bodyDef.position.Set(pos.b2Vec2.x, pos.b2Vec2.y); // Define position in meters.
            bodyDef.angle = pos.angle; // define rotation in radians.
        }
        bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction or anti-force.
        //bodyDef.position.Set(10, 10); // define position
        bodyDef.userData = {'graphic': graphic, 'owner': username, 'type': 'ship', 'lastServerState': { 'x': pos.b2Vec2.x, 'y': pos.b2Vec2.y, 'angle': pos.angle, 'vx': 0, 'vy': 0 }}; // bind ship graphic to physics body

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = density; // The density. Usually kg/m^2.
        //fixDef.density = 10.0;
        fixDef.friction = 0; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.6); // The 'hitarea' shape - circle or polygon. Defines the size (in meters).

        var ship = b2world.CreateBody(bodyDef);
        ship.CreateFixture(fixDef);
        ship.SetLinearDamping(.7); // Damping works like friction or anti-force: reduces linear velocity.

        //ship.userData = {'graphic': graphic, 'owner': username, 'type': 'ship'}; // bind ship graphic to physics body
        //aimationObjects.push(ship);
        return ship;
    }
    function createBullet(data){
        var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
        bodyDef.type = b2Body.b2_dynamicBody; //define object type
        bodyDef.angle = data.angle;
        bodyDef.linearVelocity = data.velocity;
        //bodyDef.position.Set(data.b2Vec2.x + (Math.cos(bodyDef.angle)), data.b2Vec2.y + (Math.sin(bodyDef.angle))); // Define position in meters.
        bodyDef.position.Set(data.b2Vec2.x, data.b2Vec2.y); // Define position in meters.
        bodyDef.bullet = true; // prevents tunneling, but increases processing time.

        var graphic = paper.circle(bodyDef.position.x * scale, bodyDef.position.y * scale, 3); // Creates circle at x, y, with radius;
        graphic.attr({
            'fill': '#000'
        });

        bodyDef.userData =  {'graphic': graphic, 'type': 'bullet'}; // bind shot graphic to physics body

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = data.density; // The density. Usually kg/m^2.
        fixDef.friction = 1; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.1); // The 'hitarea' shape - circle or polygon. Takes size (in meters) as parameter.

        var shot = b2world.CreateBody(bodyDef);
        shot.CreateFixture(fixDef);

        // Self destruct mechanism:
        function functRef() {
            //shooting = false;
            graphic.remove(); // remove graphic
            b2world.DestroyBody(shot); // remove physics object
            delete gameObjectsModel[data.username]; // remove reference
        }
        bulletSelfDestructTimeout = setTimeout(functRef, 1500);

        return shot;
    }
    /*function shoot(shootingBody){
        var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
        bodyDef.type = b2Body.b2_dynamicBody; //define object type
        bodyDef.angle = shootingBody.GetAngle();
        // calculating velocity vector:
        var x = 15 * Math.cos(bodyDef.angle);
        var y = 15 * Math.sin(bodyDef.angle);
        bodyDef.linearVelocity = new b2Vec2(x,y);
        // calculating entry point of shot, just in front of ship:
        // positions the center of the object:
        bodyDef.position.x = shootingBody.GetPosition().x + (Math.cos(bodyDef.angle));
        bodyDef.position.y = shootingBody.GetPosition().y + (Math.sin(bodyDef.angle));
        //bodyDef.position.Set(x, y); // Define position.
        //bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction.
        bodyDef.bullet = true; // prevents tunneling, but increases processing time.

        var graphic = paper.circle(bodyDef.position.x * scale, bodyDef.position.y * scale, 3); // Creates circle at x, y, with radius;
        graphic.attr({
            'fill': '#000'
        });

        bodyDef.userData =  {'graphic': graphic, 'type': 'bullet'}; // bind shot graphic to physics body

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = 50; // The density. Usually kg/m^2.
        fixDef.friction = 1; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.1); // The 'hitarea' shape - circle or polygon. Takes size (in meters) as parameter.

        var shot = b2world.CreateBody(bodyDef);
        shot.CreateFixture(fixDef);
        //shot.SetLinearDamping(.7); // Damping works like friction: reduces linear velocity.

        // Self destruct mechanism:
        //var functRef = callLater(shot);
        function functRef() {
            //shooting = false;
            graphic.remove(); // remove graphic
            b2world.DestroyBody(shot); // remove physics object
            //delete gameObjectsModel[shootingBody.GetUserData().owner].shot; // remove reference
        }
        bulletSelfDestructTimeout = setTimeout(functRef, 1500);

        //shooting = true;
        //return shot;
        //gameObjectsModel[shootingBody.GetUserData().owner].shot = shot;
    }
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
        /*
        b2world.Step(
            1 / fps   //frame-rate
            ,  10       //velocity iterations
            ,  10       //position iterations - The quality of the simulation
        );
        b2world.DrawDebugData();
        b2world.ClearForces();

        //Draw the bodies
        if(b2world.GetBodyCount() > 1){
            window.requestAnimationFrame(function(){
                for(var body = b2world.GetBodyList(); body; body = body.GetNext()){
                    if (body.IsActive() && typeof body.GetUserData() !== 'undefined' && body.GetUserData() !== null) {
                        // update graphics:
                        var type = body.GetUserData().type;
                        var graphic = body.GetUserData().graphic;
                        var newX = body.GetPosition().x * scale;
                        var newY = body.GetPosition().y * scale;
                        var newR = body.GetAngle() * 180 / Math.PI + 90;

                        if(type === 'bullet'){
                            graphic.attr({
                                cx: newX,
                                cy: newY
                            });
                        }
                        if(type === 'ship'){
                            graphic.attr({
                                x: newX - graphic.attr('width')/2,
                                y: newY - graphic.attr('height')/2
                            });
                        }
                        graphic.transform("R" + newR);
                    }
                }
            });
        }
        */

        if(playerAvatar !== undefined){
            if(keys[66] === true){
                //resetAvatar();
            }

            if(keys[65] === true){
                // a
                socket.emit('rotate left');
                rotate(playerAvatar, -20);
            }

            if(keys[68] === true){
                // d
                socket.emit('rotate right');
                rotate(playerAvatar, 20);
            }

            if(keys[83] === true){
                // s : thrust down
                socket.emit('thrust down');
                push(playerAvatar, -100);
            }

            if(keys[87] === true){
                // w : thrust up
                socket.emit('thrust up');
                push(playerAvatar, 150);
            }

            if(keys[32] === true){
                 if(!shooting){
                     shooting = true;
                     socket.emit('shoot'); // send update
                     //shoot(playerAvatar);
                     function functRef() {
                         shooting = false;
                     }
                     setTimeout(functRef, 1500);
                 }
            }
        }

        setTimeout(gameLoop, 1000/fps);
    }

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