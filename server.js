var http = require("http");
var url = require("url");
var io = require("socket.io");
var Box2D = require('box2dweb-commonjs');

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

function start(route, handle) {

    var gameObjectsModel = { 'items' : [] }; // store for physics objects data of connected clients
    var id = 0;

    //var timestamp = new Date().getTime();

    function sendGameState(){
        // Sending the state of the server to all clients at a fixed rate
        // process world state for emitting:
        if(gameObjectsModel.items.length > 0){
            //var start = new Date().getTime();
            var data = [];
            for(var i = 0; i < gameObjectsModel.items.length; i++){
                //var pos = gameObjectsModel.items[i].obj.GetPosition();
                //pos.Set(Math.round(pos.x * 1000) / 1000, Math.round(pos.y * 1000) / 1000);
                //var velocity = gameObjectsModel.items[i].obj.GetLinearVelocity();
                //velocity.Set(Math.round(velocity.x * 1000) / 1000, Math.round(velocity.y * 1000) / 1000);
                /*
                var item = {
                    'username': gameObjectsModel.items[i].username,
                    'b2Vec2' : gameObjectsModel.items[i].obj.GetPosition(),
                    'angle' : gameObjectsModel.items[i].obj.GetAngle(),
                    'velocity' : gameObjectsModel.items[i].obj.GetLinearVelocity()
                };
                */
                // compact the state:
                var str = gameObjectsModel.items[i].username;
                function addToItem(value){
                    str = str + "&" + value;
                }
                var obj = gameObjectsModel.items[i].obj;
                addToItem(obj.GetPosition().x); // pos x
                addToItem(obj.GetPosition().y); // pos y
                addToItem(obj.GetAngle()); // angle
                addToItem(obj.GetLinearVelocity().x); // velocity x
                addToItem(obj.GetLinearVelocity().y); // velocity y

                data.push(str);
            }
            //io.sockets.volatile.send(data);

            //var end = new Date().getTime();
            //io.sockets.emit('updatecycle', (end - start));
        }
        io.sockets.volatile.send(data);
        //setTimeout(sendGameState, 1000 / 30); // starting update loop
    }
    //sendGameState(); // starting update clients loop;

    function onRequest(request, response) {
        // handles the HTTP request and sends it on to the router:
        var postData = "";
        var pathname = url.parse(request.url).pathname;
        //console.log("Request for " + pathname + " received.");

        request.setEncoding("utf8");

        request.addListener("data", function(postDataChunk) {
            postData += postDataChunk;
            //console.log("Received POST data chunk '"+ postDataChunk + "'.");
        });

        request.addListener("end", function() {
            route(handle, pathname, response, postData);
        });
    }

    // create server:
    var server = http.createServer(onRequest);
    io = io.listen(server); // io.listen returns a socket.io object to which we can attach our handlers
    io.set('log level', 1); // debug mode off
    server.listen(8080);
    // server and socket are live!

    // socket handling:
    io.sockets.on('connection', function (client) {
        // a client connected
        // 'socket' object = the client

        client.on('disconnect', function() {
            // client disconnected
            // remove references to disconnected if any:
            client.get('username', function (err, name) {
                // client was registered with a username (ship)
                //client.broadcast.emit('ship destroyed', name); // all other clients remove the ship of the disconnected client
                io.sockets.emit('object destroyed', name); // all other clients remove the ship of the disconnected client
                // check if reference to client is stored in game objects model:
                var index = -1;
                for(var i = 0; i < gameObjectsModel.items.length; i++){
                    if(gameObjectsModel.items[i].username === name){
                        index = i;
                        break;
                    }
                }
                if(index !== -1){
                    gameObjectsModel.items.remove(index); // Remove stored reference
                }

                client.get('ship', function (err, ship) {
                        // delete ship physics object
                        b2world.DestroyBody(ship);
                });
            });

        });

        client.on('client ready', function () {
            // client is ready to draw game state updates
            // inform client of other ships:
            //
            for(var i = 0; i < gameObjectsModel.items.length; i++){
                var package = {
                    'username': gameObjectsModel.items[i].username,
                    'type': gameObjectsModel.items[i].obj.GetUserData().type,
                    'b2Vec2' : gameObjectsModel.items[i].obj.GetPosition(),
                    'angle' : gameObjectsModel.items[i].obj.GetAngle()
                };
                client.emit('module launched', package); // new client creates avatars for the other clients
            }
        });

        client.on('module launch', function(_data){
            // new central module
            var data = {};
            data.username = _data.username;

            var initX, initY, initR;
            initX = Math.round(Math.random() * paperW);
            initY = Math.round(Math.random() * paperH);
            initR = -90;//Math.round(Math.random() * 360);
            // create module:
            var density = 50;
            data.obj = createShip({'x': initX, 'y':initY, 'r': initR}, density, data.username);
            gameObjectsModel.items.push(data); // store reference to ship

            client.set('ship', data.obj); // ship object stored on client. Used .on('shoot', ...)
            client.set('username', data.username); // ship name stored on client

            var package = {
                'username': data.username,
                'b2Vec2' : data.obj.GetPosition(),
                'angle' : data.obj.GetAngle(),
                'density': density
            };
            io.sockets.emit('module launched', package); // request all connected clients to create a ship avatar for the new ship
        });

        client.on('module add', function(_data){
            client.get('ship', function (err, ship) {
                client.get('username', function (err, name) {
                    var package = {
                        'username': name,
                        "mainModule": ship,
                        'gridX' : _data.gridX,
                        'gridY' : _data.gridY
                    };

                    var data = {};
                    data.username = name + _data.gridX + _data.gridY;
                    data.obj = moduleExtend(package);
                    gameObjectsModel.items.push(data); // store reference to ship

                    var package2 = {
                        'username': data.username,
                        'b2Vec2' : data.obj.GetPosition(),
                        'angle' : data.obj.GetAngle()
                    };
                    io.sockets.emit('module launched', package2); // request all connected clients to create a ship avatar for the new ship
                });
            });
        });

        client.on('thrust up', function(){
            client.get('ship', function (err, ship) {
                push(ship, 150);
            });
        });

        client.on('thrust down', function(){
            client.get('ship', function (err, ship) {
                push(ship, -100);
            });
        });

        client.on('rotate left', function(){
            client.get('ship', function (err, ship) {
                //rotate(ship, -20);
                rotate(ship, -50);
            });
        });

        client.on('rotate right', function(){
            client.get('ship', function (err, ship) {
                //rotate(ship, 20);
                rotate(ship, 50);
            });
        });

        client.on('shoot', function(){
            client.get('ship', function (err, ship) {
                client.get('username', function (err, name) {
                    var data = {};
                    data.username = name + "_bullet";
                    data.obj = shoot(ship);
                    gameObjectsModel.items.push(data); // store reference to shot

                    var package = {
                        'username': data.username,
                        'velocity' : data.obj.GetLinearVelocity(),
                        'b2Vec2' : data.obj.GetPosition(),
                        'angle' : data.obj.GetAngle(),
                        'density' : 50
                    };
                    io.sockets.emit('shot fired', package); // relay shot data all connected clients
                });
            });
        });

        client.on('ping', function(time){
            client.emit('pingback', time);
        });
    });

    /* -- PHYSICS SIMULATION: -- */
    // Shorthand references to Box2D namespaces:
    var b2Vec2 = Box2D.b2Vec2;
    var b2BodyDef = Box2D.b2BodyDef;
    var b2Body = Box2D.b2Body;
    var b2FixtureDef = Box2D.b2FixtureDef;
    var b2WeldJointDef = Box2D.b2WeldJointDef;
    var b2World = Box2D.b2World;
    var b2CircleShape = Box2D.b2CircleShape;
    var b2ContactListener = Box2D.b2ContactListener;
    //
    // Physics engine environment:
    var scale = 30; // Pixels per meter. Scale. Box2D operates in meters: 1 meter = 30 pixels
    var paperW = 1200; // in pixels
    var paperH = 700; // in pixels
    var gravity = new b2Vec2(0,0); // zero gravity on both vectors. It's space after all.
    var b2world = new b2World(gravity, true);

    // Game loop:
    var fps = 60; // update broadcasts per second
    //var gameLoopInterval = setTimeout(gameLoop, 1000 / fps); // starting game loop;
    //var gameLoopInterval = setInterval(gameLoop, 1000 / fps); // starting game loop;
    var bulletSelfDestructTimeout;

    //
    // Collision detection handling:
    //var contactListener = new Box2D.Dynamics.b2ContactListener();
    var contactListener = new b2ContactListener();
    contactListener.BeginContact = function(contact) {
        var body1 = contact.m_fixtureA.m_body;
        var body2 = contact.m_fixtureB.m_body;

        var bullet;
        bullet = (body1.IsBullet()) ? body1 : bullet;
        bullet = (body2.IsBullet()) ? body2 : bullet;

        var ship;
        ship = (body1.GetUserData().type === "ship") ? body1 : ship;
        ship = (body2.GetUserData().type === "ship") ? body2 : ship;

        if(ship && bullet){
            // someone was hit!
            //console.log(ship.GetUserData().owner + " was hit by " + bullet.GetUserData().owner);
            io.sockets.emit('hit', ship.GetUserData().owner + " was hit by " + bullet.GetUserData().owner);
            //clearTimeout(bulletSelfDestructTimeout);
            //shooting = false;
            //objsScheduledForRemoval.push(bullet); // queue object for removal
            /*
            if(bullet.GetUserData().owner === username){
                // this client shot somebody
                enemyDestroyed(ship);
            }
            */
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

/* -- GAME OBJECTS FACTORY: -- */
    function createShip(pos, density, username){
        // 'Mass' = Shape size * density value
        var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
        bodyDef.type = b2Body.b2_dynamicBody; //define object type
        bodyDef.position.Set(pos.x / scale, pos.y / scale); // Define position in meters.
        bodyDef.angle = pos.r * Math.PI / 180; // define rotation in radians.
        bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction or anti-force.
        bodyDef.userData = {'owner': username, 'type': 'ship'}; // bind ship graphic to physics body

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = density; // The density. Usually kg/m^2.
        fixDef.friction = 0; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.6); // The 'hitarea' shape - circle or polygon. Defines the size (in meters).

        var ship = b2world.CreateBody(bodyDef);
        ship.CreateFixture(fixDef);
        ship.SetLinearDamping(.7); // Damping works like friction or anti-force: reduces linear velocity.

        return ship;
    }

    function moduleExtend(params){
        // params: 'username', 'mainModule', 'gridX', 'gridY'
        // 'Mass' = Shape size * density value
        var cBodyPos = params.mainModule.GetPosition();
        var cBodyAngle = params.mainModule.GetAngle();

        params.mainModule.SetAngle(-90 * Math.PI / 180); // This is cheating. To avoid calculating the position of new module in relation to main module's angle

        var bodyDef = new b2BodyDef; // Bodies have position and velocity. You can apply forces, torques, and impulses to bodies. Bodies can be static, kinematic, or dynamic.
        bodyDef.type = b2Body.b2_dynamicBody; //define object type
        bodyDef.position.Set(cBodyPos.x + params.gridX * 1.5, cBodyPos.y + params.gridY * 1.5); // Define position in meters.
        bodyDef.angle = cBodyAngle; // define rotation in radians.
        bodyDef.angularDamping = 1; // Angular damping is used to reduce the angular velocity. Works like friction or anti-force.
        //bodyDef.position.Set(10, 10); // define position
        bodyDef.userData = {'owner': params.username + params.gridX + params.gridY, 'type': 'ship'}; // bind ship graphic to physics body

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = 50;//params.density; // The density. Usually kg/m^2.
        //fixDef.density = 10.0;
        fixDef.friction = 0; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.6); // The 'hitarea' shape - circle or polygon. Defines the size (in meters).

        var module = b2world.CreateBody(bodyDef);
        module.CreateFixture(fixDef);
        //module.CreateFixture(params.mainModule.GetFixtureList().GetNext());
        module.SetLinearDamping(.7); // Damping works like friction or anti-force: reduces linear velocity.

        var weldJointDef = new b2WeldJointDef();
        weldJointDef.Initialize(params.mainModule, module, params.mainModule.GetWorldCenter());
        b2world.CreateJoint(weldJointDef);

        params.mainModule.SetAngle(cBodyAngle);

        return module;
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
        bodyDef.userData =  {'owner': shootingBody.GetUserData().owner, 'type': 'bullet'};

        var fixDef = new b2FixtureDef; // A fixture binds a shape to a body and adds material properties such as density, friction, and restitution.
        fixDef.density = 50; // The density. Usually kg/m^2.
        fixDef.friction = 1; // The friction coefficient, usually in the range [0,1]. Doesn't seem to have any impact?
        fixDef.restitution = 0.1; // Restitution is used to make objects bounce. The restitution value is usually set to be between 0 and 1.
        fixDef.shape = new b2CircleShape(.1); // The 'hitarea' shape - circle or polygon. Takes size (in meters) as parameter.

        var shot = b2world.CreateBody(bodyDef);
        shot.CreateFixture(fixDef);
        //shot.SetLinearDamping(.7); // Damping works like friction: reduces linear velocity.

        // Self destruct mechanism:
        function selfdestruct() {
            //shooting = false;
            b2world.DestroyBody(shot); // remove physics object
            // check if reference to client is stored in game objects model:
            var index = -1;
            for(var i = 0; i < gameObjectsModel.items.length; i++){
                //console.log("item username: " + gameObjectsModel.items[i].username);
                if(gameObjectsModel.items[i].username === shootingBody.GetUserData().owner + "_bullet"){
                    index = i;
                    break;
                }
            }
            if(index !== -1){
                gameObjectsModel.items.remove(index); // Remove stored reference
            }
            //delete gameObjectsModel[shootingBody.GetUserData().owner].shot; // remove reference
            io.sockets.emit('object destroyed', shootingBody.GetUserData().owner + "_bullet");
        }
        bulletSelfDestructTimeout = setTimeout(selfdestruct, 1500);

        //shooting = true;

        return shot;
        //aimationObjects.push(shot);
    }

/* -- PHYSICS UPDATE LOOP: -- */
    function gameLoop() {
        // so far, this loop only handles simulation of local client
        b2world.Step(
            1 / fps   //frame-rate
            ,  3       //velocity iterations
            ,  3       //position iterations - The quality of the simulation
        );
        //b2world.DrawDebugData();
        b2world.ClearForces();

        sendGameState();

        setTimeout(gameLoop, 1000 / fps);
    }
    gameLoop(); // starting game loop;
}

exports.start = start;