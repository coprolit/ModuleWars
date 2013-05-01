/*
 Responding request handlers with non-blocking operations:
 Instead of bringing the content to the server, we will bring the server to the content.
 To be more precise, we will inject the response object (from our server's callback function onRequest()) through the router into the request handlers.
 The handlers will then be able to use this object's functions to respond to requests themselves.
 server > router > request handler
 */

var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {};
handle["/"] = requestHandlers.start;
handle["/start"] = requestHandlers.start;
handle["/upload"] = requestHandlers.upload;
handle["/socket.io.js"] = requestHandlers.socketIOjs;
handle["/gameengine5.js"] = requestHandlers.gameenginejs;
handle["/raphael-min.js"] = requestHandlers.raphaeljs;
handle["/ship01.png"] = requestHandlers.shipimg;
handle["/Box2dWeb-2.1.a.3.min.js"] = requestHandlers.box2DWeb;
//handle["/show"] = requestHandlers.show;

// start the server:
server.start(router.route, handle);